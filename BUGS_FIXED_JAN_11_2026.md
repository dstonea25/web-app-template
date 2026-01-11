# Bug Fixes - January 11, 2026

## Issues Fixed

### 1. Challenges Not Refreshing Every Week ✅

**Problem:** 
- User never saw fresh uncompleted challenges at the start of a new week
- Challenges appeared to be pre-completed or never reset

**Root Causes (3 issues found):**
1. **n8n Schedule Timing**: Workflow runs at **4:05 AM UTC = 10:05 PM CST Sunday**, not Monday morning
2. **Database Timezone**: Function used `CURRENT_DATE` (UTC) instead of Chicago timezone  
3. **Frontend Never Refreshes**: Component only fetches challenges once on mount, never checks for new week

**Fixes Applied:**

1. ✅ **Database Timezone**: Updated `get_or_create_weekly_challenges` to use Chicago timezone
   ```sql
   v_chicago_date := (NOW() AT TIME ZONE 'America/Chicago')::date;
   v_year := EXTRACT(isoyear FROM v_chicago_date)::integer;
   v_week_number := EXTRACT(week FROM v_chicago_date)::integer;
   ```

2. ⚠️ **n8n Schedule** (MANUAL ACTION REQUIRED):
   - Go to: https://geronimo.askdavidstone.com/workflow/6dfAoVnqLXhBMOWs
   - Click "Monday 6 AM Chicago" schedule trigger
   - Change **triggerAtHour** from `4` to `12` (12 PM UTC = 6 AM CST)
   - Keep **triggerAtMinute** at `5`
   - Save and activate

3. ✅ **Frontend Auto-Refresh**: Added automatic week detection
   - Checks for new week every minute when tab is visible
   - Automatically refetches challenges when new week detected
   - Shows toast notification: "Challenges refreshed"

**Verification:**
```sql
-- Test that the function returns correct week for Chicago timezone
SELECT 
  (get_or_create_weekly_challenges()->>'week')::jsonb->>'week_number' AS current_week,
  EXTRACT(WEEK FROM (NOW() AT TIME ZONE 'America/Chicago')::date) AS expected_week;
-- Returns: current_week = 2, expected_week = 2 ✅
```

---

### 2. Habit Goals Badges Reset Too Early (Sunday Midnight Issue) ✅

**Problem:**
- At 12:21 AM on Sunday Jan 11, the habit goals badges showed as "reset" (appearing as a new week)
- This was incorrect because ISO week 2 runs Monday Jan 5 - Sunday Jan 11
- Sunday at 12:21 AM should still show week 2, not week 3

**Root Cause:**
- Frontend week calculation was using browser's local timezone
- Potential timezone inconsistency between browser and database
- The calculation wasn't explicitly aligned with Chicago timezone used by backend

**Fix Applied:**
- ✅ **Frontend**: Updated `HabitWeeklyAchievementGrid.tsx` to explicitly use Chicago timezone:
  ```typescript
  // Get current date in Chicago timezone
  const now = new Date();
  const chicagoTimeString = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const chicagoDate = new Date(chicagoTimeString);
  
  // Calculate ISO week number using Chicago date
  // ... ISO week calculation ...
  ```

**Verification:**
- Week 2 (Jan 5-11) should show as current until Sunday Jan 11 at 11:59 PM CST
- Week 3 should start Monday Jan 12 at 12:00 AM CST

---

## How to Complete the Fix

### Manual Step Required: Update n8n Workflow Schedule

1. Go to n8n: https://geronimo.askdavidstone.com
2. Open workflow: "Weekly Challenges Generator" (ID: 6dfAoVnqLXhBMOWs)
3. Click on the "Monday 6 AM Chicago" schedule trigger node
4. Update the cron expression:
   - **Old:** `0 6 * * 1` (6 AM UTC = Midnight CST)
   - **New:** `0 12 * * 1` (12 PM UTC = 6 AM CST/CDT)
5. Save and activate the workflow

### Alternative: Use n8n Timezone Setting
If n8n supports timezone in schedule triggers, you can set:
- Cron: `0 6 * * 1`
- Timezone: `America/Chicago`

---

## Testing Instructions

### Test 1: Challenge Refresh
Wait until next Monday (Jan 12) at 6 AM CST and verify:
1. New challenges are created for week 3
2. Check in database:
   ```sql
   SELECT year, week_number, week_start_date, 
          generated_at AT TIME ZONE 'America/Chicago' AS generated_at_chicago
   FROM weekly_challenge_sets
   WHERE year = 2026 AND week_number = 3;
   ```
3. Should show generated_at_chicago = "2026-01-12 06:XX:XX" (Monday 6 AM)

### Test 2: Habit Badges
1. Check badges on Sunday night (Jan 11) at 11:30 PM CST
   - Should still show week 2 as current
2. Check badges on Monday morning (Jan 12) at 12:30 AM CST  
   - Should now show week 3 as current
3. Verify the week number displayed matches database week:
   ```sql
   SELECT EXTRACT(WEEK FROM (NOW() AT TIME ZONE 'America/Chicago')::date);
   ```

---

## Summary

- ✅ **Database timezone fix** - Challenges now use Chicago timezone
- ✅ **Frontend habit badges** - Now use Chicago timezone 
- ✅ **Frontend auto-refresh** - Automatically detects and fetches new week
- ⚠️ **Manual action needed** - Update n8n workflow hour from `4` to `12`

### What Was Really Happening

You'd open the app, see challenges with checkmarks, and think "these never reset!" But actually:
1. New challenges WERE being created (with `completed: false`)
2. They were created Sunday 10 PM CST (not Monday morning)
3. Frontend never refetched them, so you kept seeing old week's completed challenges
4. The new uncompleted challenges existed in database but frontend never showed them!

Now the frontend checks every minute for a new week and auto-refreshes. You'll see fresh challenges Monday morning! 🎉
