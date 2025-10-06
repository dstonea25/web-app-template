## Allocations Availability Backend Spec

### Objective
Move all availability/derived calculations from the frontend to the backend/database so the frontend can fetch a fully-computed state for the Allotments/Allocations tab.

### Overview
Given an allotments configuration (items with quota, cadence, optional multiplier) and a ledger of redemption events, compute and return:
- available: items with remaining quota in the current window
- coming_up: items that will become available soon, with days-until
- unavailable: items exhausted in the current window, with last redeemed and YTD count
- stats: usageCounts (all-time in loaded ledger), percentages (this-period usage), nextReset (end of current window)

### Inputs
- Allotments config (two accepted shapes):
  - Format A:
    ```json
    {
      "year": 2025,
      "items": [
        { "type": "Caloric Beverage", "quota": 3, "cadence": "weekly", "multiplier": 1 }
      ]
    }
    ```
  - Format B:
    ```json
    {
      "allotments": {
        "Caloric Beverage": { "quota": 3, "cadence": "weekly", "multiplier": 1 }
      }
    }
    ```

- Ledger JSONL string (one JSON per line). Two event formats are supported per line:
  - Simple:
    ```json
    { "id": "evt_1", "date": "2025-01-15", "type": "Caloric Beverage" }
    ```
  - n8n-shaped (only count type === "redeem"):
    ```json
    { "type": "redeem", "item": "Caloric Beverage", "qty": 1, "ts": "2025-01-15T10:02:03.000Z", "id": "evt_x" }
    ```

### Normalization Rules
- cadence normalization (case/alias-insensitive):
  - "week"|"weekly" → weekly
  - "month"|"monthly" → monthly
  - "quarter"|"quarterly" → quarterly
  - "year"|"yearly" → yearly
- multiplier default: 1 (if missing)
- quota default: 0 (if missing); ensure numbers

### Ledger Parsing Rules
- Split JSONL by lines; parse JSON for each non-empty line.
- If the parsed object has fields `{ item, ts }`:
  - Only count if `type === 'redeem'`
  - Compute `date = ts.slice(0,10)` (YYYY-MM-DD)
  - Map to `{ id, date, type: item, ts }`
- Else assume shape `{ id, date, type }`.
- Ignore non-redeem events for availability math (e.g., `type: 'failed'`).

### Timezone and Windowing
- All period math is performed relative to a local timezone. Frontend currently uses device timezone.
- Weekly windows start on Monday 00:00 local time.
- Monthly windows start on day 1, 00:00 local time.
- Quarterly windows are treated as month-based windows stepped in 3-month blocks (anchor at month start, step by 3 months).
- Yearly windows start on Jan 1, 00:00 local time.
- Window end is exclusive: [start, end).

### Multiplier (Anchored Windows)
- If `multiplier <= 1`: use the natural current window: `[startNow(cadence, now), step(start, 1))`.
- If `multiplier > 1`:
  - Gather redemption timestamps for the item (from `ts` if present; else from `date` at 00:00 local).
  - If there are no redemptions: start at current natural start and extend by `multiplier` windows.
  - If there are redemptions: anchor on the first redemption’s natural start and step forward by `multiplier` windows until the window contains `now`.

### Per-Item Derivation Steps
For each `AllotmentItem { type, quota, cadence, multiplier }`:
1. Compute current window `[periodStart, periodEnd)` using cadence and multiplier rules above.
2. `usedThisPeriod` = count of ledger events for this `type` whose (local) event date is in `[periodStart, periodEnd)`.
3. `remaining = max(0, quota - usedThisPeriod)`.
4. Hybrid rule for anchored windows: if `multiplier > 1` AND `quota === 1` AND `usedThisPeriod > 0` AND `now ∈ [periodStart, periodEnd)`, then force `remaining = 0` for the rest of that window.
5. `percentages[type] = round(min(100, (usedThisPeriod / quota) * 100))` (0 if quota ≤ 0).
6. `nextReset[type] = local date of periodEnd` as `YYYY-MM-DD`.
7. Bucketing:
   - If `remaining > 0`: push to `available` as `{ type, remaining, total: quota }`.
   - Else:
     - Push to `unavailable` as `{ type, lastRedeemed, countThisYear }`, where:
       - `countThisYear` = count of ledger events for `type` where `event.date` year equals current year.
       - `lastRedeemed` = date of most recent such event in current year, else "Never".
     - Also consider `coming_up`: if `daysUntil(periodEnd) <= threshold(cadence)` then push `{ type, daysUntil, quotaAvailable: quota }`.

### Coming Up Thresholds
- weekly: 3 days
- monthly/quarterly/yearly: 14 days

### Sorting
- `coming_up`: ascending by `daysUntil`.
- `unavailable`: descending by `countThisYear`.
- `available`: no specific sort (frontend groups by cadence for display).

### Stats
- `usageCounts[type]`: tally of all ledger events for that type (from the loaded ledger, not limited to the current window).
- `percentages[type]`: computed per item as above.
- `nextReset[type]`: computed per item as above.

### Output Schema (Returned to Frontend)
```json
{
  "year": 2025,
  "items": [
    { "type": "Caloric Beverage", "quota": 3, "cadence": "weekly", "multiplier": 1 }
  ],
  "ledger": [
    { "id": "evt_1", "date": "2025-01-15", "type": "Caloric Beverage" }
  ],
  "available": [
    { "type": "Caloric Beverage", "remaining": 2, "total": 3 }
  ],
  "coming_up": [
    { "type": "Cheat Meal", "daysUntil": 2, "quotaAvailable": 1 }
  ],
  "unavailable": [
    { "type": "Dessert", "lastRedeemed": "2025-02-02", "countThisYear": 5 }
  ],
  "stats": {
    "usageCounts": { "Caloric Beverage": 10 },
    "percentages": { "Caloric Beverage": 33 },
    "nextReset": { "Caloric Beverage": "2025-01-20" }
  }
}
```

### API/DB Implementation Notes
- Provide a way to pass the client timezone (e.g., `America/Los_Angeles`) or decide on a canonical timezone for all users; frontend relied on device timezone.
- Ensure window start/end calculations are done in local time for the chosen timezone, with the end treated as exclusive.
- For quarterly cadence, step windows in 3-month increments from a month start anchor.
- Only `redeem` events contribute to usage math; other event types can be stored but ignored for availability.
- Consider adding a server-side filter for a specific year if ledger sizes grow, but current logic reads full ledger and derives `countThisYear` based on `event.date` year.

### Optional Endpoint Sketch
Request:
```json
{
  "tz": "America/Los_Angeles",
  "allotments": { "year": 2025, "items": [ { "type": "Caloric Beverage", "quota": 3, "cadence": "weekly", "multiplier": 1 } ] },
  "ledgerJsonl": "{\"type\":\"redeem\",\"item\":\"Caloric Beverage\",\"ts\":\"2025-01-15T10:02:03.000Z\",\"id\":\"evt_1\"}\n..."
}
```

Response: the Output Schema above.

### Frontend Dependencies on Shape
- The UI consumes `available`, `coming_up`, `unavailable`, and `stats` exactly as specified above.
- `nextReset` is displayed in the Unavailable table for the "Next Available" column.
- Frontend groups `available` by cadence for display; grouping is not required in the payload.

### Non-Functional / Frontend-only Behavior (can be ignored server-side)
- Local overrides/manual additions were merged via localStorage in the frontend for testing; not required on the backend.
- The frontend caches the computed `AllocationState` client-side; server need not manage caching for correctness.


