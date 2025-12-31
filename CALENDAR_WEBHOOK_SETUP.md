# Calendar Webhook Setup Checklist

## ✅ Frontend Code (DONE)

- ✅ API methods added to `src/lib/api.ts`
- ✅ NL inputs wired up in `CalendarTab.tsx` (2 places)
- ✅ Event creation flow complete
- ✅ Error handling with toast notifications

---

## 🔧 What YOU Need to Do

### 1. Build the NL Parser Webhook in n8n

**Workflow Name**: `calendar-nl-parse`

**Trigger**: Webhook (POST)
- URL: `https://geronimo.askdavidstone.com/webhook/calendar-nl-parse`
- Authentication: Bearer token (use `VITE_N8N_WEBHOOK_TOKEN`)

**Flow**:
```
Webhook Trigger
  ↓
Extract request.body.text
  ↓
Call OpenAI/Claude with prompt
  ↓
Parse LLM response to JSON
  ↓
Validate structure
  ↓
Return formatted response
```

**LLM Prompt Example**:
```
You are a calendar event parser. Extract structured data from natural language.

Input: "{{ $json.body.text }}"
Context: Today is {{ $json.body.context.currentDate }}

Extract and return ONLY valid JSON (no explanation):
{
  "success": true,
  "parsed": {
    "title": "Event title",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "start_time": "HH:MM:SS or null",
    "end_time": "HH:MM:SS or null",
    "all_day": true/false,
    "category": "vacation|holiday|travel|medical|social|work|personal|null",
    "notes": "any notes or null",
    "affects_row_appearance": true only if travel,
    "priority": 5 (default, 7 for travel),
    "is_pto": true if mentions PTO/paid time off/day off,
    "source_pattern_id": null
  }
}

Rules:
- If text mentions "PTO", "paid time off", "day off" → is_pto: true
- If category is travel → affects_row_appearance: true, priority: 7
- For multi-day: "vacation Dec 20-25" → start_date: 2024-12-20, end_date: 2024-12-25
- For relative dates: "tomorrow" → calculate from context.currentDate
- If cannot parse → return { "success": false, "error": "Could not understand date" }
```

**Response Node**: Return JSON from LLM

---

### 2. Add Webhook Node to Pattern Generation Workflow

**Update your existing `calendar-pattern-cron-generate` workflow:**

**Add at the beginning (parallel to cron trigger):**
```
Webhook Trigger (optional manual trigger)
  ↓
[Merge with existing flow at "Calculate Period" node]
```

This allows manual triggering via:
```
POST https://geronimo.askdavidstone.com/webhook/calendar-generate-pattern-events
{
  "pattern_id": "optional-uuid",
  "generate_for_period": {
    "start_date": "2024-12-01",
    "end_date": "2024-12-31"
  }
}
```

---

### 3. Update Webhook URLs (IMPORTANT!)

In `src/lib/api.ts`, update these placeholder URLs:

```typescript
// Line ~752 - NL Parser
const WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/calendar-nl-parse';

// Line ~781 - Pattern Generator  
const WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/calendar-generate-pattern-events';
```

**Replace with your actual n8n webhook URLs once you create them!**

---

### 4. Add Authentication (Recommended)

The frontend already uses `VITE_N8N_WEBHOOK_TOKEN` for other webhooks. Update the API methods to include auth:

```typescript
// In parseNaturalLanguageEvent method:
const N8N_WEBHOOK_TOKEN = import.meta.env.VITE_N8N_WEBHOOK_TOKEN || '';

const response = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`
  },
  body: JSON.stringify({ text, context })
});
```

Then configure your n8n webhook to check this token.

---

### 5. Create Unique Constraint (Database)

Run this migration to prevent duplicate pattern-generated events:

```sql
-- Prevents same pattern from creating duplicate events
CREATE UNIQUE INDEX idx_calendar_events_pattern_date 
ON calendar_events(source_pattern_id, start_date, start_time) 
WHERE source_pattern_id IS NOT NULL;
```

---

## 🧪 Testing

### Test NL Parser

**In frontend:**
1. Open calendar
2. Click NL input (top or sticky month)
3. Type: "Doctor appointment tomorrow at 2pm"
4. Press Enter
5. **Expected**: Event appears on tomorrow's row

**Check n8n execution log** to see the LLM output.

### Test Pattern Generator (Manual)

**Create test pattern:**
```sql
INSERT INTO calendar_patterns (name, pattern_type, category, rule_json, start_date, is_active)
VALUES (
  'Weekly Test',
  'recurring',
  'work',
  '{"frequency": "weekly", "days": ["monday"], "start_time": "10:00", "all_day": false}'::jsonb,
  CURRENT_DATE,
  true
);
```

**Manually trigger n8n workflow** (click Execute)

**Check results:**
```sql
SELECT title, start_date, start_time, source_pattern_id 
FROM calendar_events 
WHERE source_pattern_id IS NOT NULL 
ORDER BY start_date 
LIMIT 10;
```

**Expected**: 8-9 Monday events for next 60 days.

---

## 🐛 Troubleshooting

### "Could not understand event"
- Check n8n execution log
- Verify LLM returned valid JSON
- Check for typos in prompt

### "Webhook returned 401"
- Verify `VITE_N8N_WEBHOOK_TOKEN` is set
- Check n8n webhook authentication settings

### "Webhook returned 404"
- Verify webhook URLs in `src/lib/api.ts`
- Check n8n workflow is active

### Pattern generates no events
- Check `is_active = true` in database
- Verify `rule_json` format matches expected structure
- Check date range (start_date to end_date)

---

## 📊 Environment Variables

Make sure these are set:

```bash
# .env or .env.local
VITE_N8N_WEBHOOK_TOKEN=your_webhook_token_here
```

**In production (Docker):**
Already configured in `docker-compose.yml` ✅

---

## 🚀 Current Status

### ✅ Complete
- Frontend API methods
- NL input wiring (2 locations)
- Pattern generation cron workflow
- Database schema
- Event display with colored dots
- Multi-day, PTO, row coloring

### ⏸️ Pending
1. Build NL parser webhook in n8n
2. Add webhook trigger to pattern generator
3. Test end-to-end flow
4. Add authentication headers

---

## 📝 Quick Start

**Minimal steps to get working:**

1. **Create n8n workflow** called `calendar-nl-parse`
2. **Add Webhook trigger** → Function (LLM call) → Response
3. **Update webhook URL** in `src/lib/api.ts` (line ~752)
4. **Set environment variable**: `VITE_N8N_WEBHOOK_TOKEN`
5. **Test**: Type "Meeting tomorrow at 3pm" in calendar NL input

That's it! The rest is optional enhancements.

---

## 🎯 Next Steps After Setup

Once webhooks work:

1. **Pattern Management UI** (optional)
   - Add UI to create/edit patterns
   - Currently can be done via SQL

2. **Advanced NL Features**
   - "Every Monday" → Suggest pattern creation
   - "5 dates by March" → Create goal pattern

3. **Monitoring**
   - Log webhook calls
   - Track pattern generation stats
   - Alert on failures

4. **User Feedback**
   - Show parsing confidence
   - Suggest corrections
   - Preview before saving






