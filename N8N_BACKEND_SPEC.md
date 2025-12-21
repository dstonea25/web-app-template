# n8n Backend Integration Specification

## Overview
The calendar frontend is ready for n8n + LLM integration. This document specifies what the backend needs to provide.

---

## 1. Natural Language Event Parser

### Endpoint
`POST /webhook/calendar-nl-parse`

### Request
```json
{
  "text": "Doctor appointment next Tuesday at 2pm",
  "context": {
    "currentDate": "2024-12-14",
    "defaultYear": 2024
  }
}
```

### Expected Response
```json
{
  "success": true,
  "parsed": {
    "title": "Doctor appointment",
    "start_date": "2024-12-17",
    "end_date": "2024-12-17",
    "start_time": "14:00:00",
    "end_time": null,
    "all_day": false,
    "category": "medical",
    "notes": null,
    "affects_row_appearance": false,
    "priority": 5,
    "is_pto": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Could not parse date from input",
  "suggestion": "Try: 'Event name on MM/DD/YYYY at HH:MM'"
}
```

### Frontend Integration Points
The NL input appears in 3 places:
1. **Top header panel** (desktop)
2. **Sticky month dropdown** (when scrolled)
3. **Mobile bottom sheet**

All three call the same handler and should POST to this webhook.

---

## 2. Pattern to Event Generator

### Patterns Table Structure
Frontend stores patterns in `calendar_patterns` table:

```sql
CREATE TABLE calendar_patterns (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  pattern_type TEXT NOT NULL,  -- 'recurring', 'goal', 'one_off_template'
  category TEXT,
  notes TEXT,
  start_date DATE,
  end_date DATE,
  rule_json JSONB NOT NULL,  -- Flexible rule storage
  default_affects_row_appearance BOOLEAN,
  default_priority INTEGER,
  is_active BOOLEAN,
  created_by TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Pattern Types & Rule JSON Examples

#### Type 1: Recurring Pattern
```json
{
  "id": "uuid",
  "name": "Weekly Team Meeting",
  "pattern_type": "recurring",
  "category": "work",
  "rule_json": {
    "frequency": "weekly",
    "days": ["monday"],
    "time": "10:00",
    "duration_minutes": 60,
    "end_time": "11:00"
  },
  "start_date": "2024-01-01",
  "end_date": null,  // null = ongoing
  "is_active": true
}
```

**Expected Behavior**: Generate an event every Monday at 10am, indefinitely (until pattern is deactivated).

#### Type 2: Goal Pattern
```json
{
  "id": "uuid",
  "name": "Date Nights",
  "pattern_type": "goal",
  "category": "social",
  "rule_json": {
    "type": "count",
    "target": 5,
    "prompt": "Go on dates",
    "deadline": "2024-03-31"
  },
  "start_date": "2024-01-01",
  "end_date": "2024-03-31",
  "is_active": true
}
```

**Expected Behavior**: Track progress toward goal. User manually creates events and links them to pattern via `source_pattern_id`. Backend can send reminders or suggest dates.

#### Type 3: One-Off Template
```json
{
  "id": "uuid",
  "name": "Monthly Rent Payment",
  "pattern_type": "one_off_template",
  "category": "personal",
  "rule_json": {
    "template": "Pay rent",
    "day_of_month": 1,
    "time": null,
    "all_day": true
  },
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "is_active": true
}
```

**Expected Behavior**: Generate one event per month on the 1st day.

---

## 3. Pattern → Event Generation Webhook

### Endpoint
`POST /webhook/calendar-generate-pattern-events`

### Request
```json
{
  "pattern_id": "uuid",
  "generate_for_period": {
    "start_date": "2024-12-01",
    "end_date": "2024-12-31"
  }
}
```

### Expected Response
```json
{
  "success": true,
  "events_created": [
    {
      "id": "generated-uuid",
      "title": "Weekly Team Meeting",
      "start_date": "2024-12-02",
      "end_date": "2024-12-02",
      "start_time": "10:00:00",
      "end_time": "11:00:00",
      "all_day": false,
      "category": "work",
      "source_pattern_id": "pattern-uuid"
    },
    {
      "id": "generated-uuid-2",
      "title": "Weekly Team Meeting",
      "start_date": "2024-12-09",
      "end_date": "2024-12-09",
      "start_time": "10:00:00",
      "end_time": "11:00:00",
      "all_day": false,
      "category": "work",
      "source_pattern_id": "pattern-uuid"
    }
    // ... more events
  ],
  "count": 5
}
```

### Automation Strategy
**Option A**: Cron job that runs daily
- Fetches all active patterns
- Generates events for next 30-60 days
- Checks for duplicates before inserting

**Option B**: On-demand generation
- User requests "Generate from patterns"
- Webhook generates events immediately
- Frontend refreshes calendar

---

## 4. Event CRUD via Frontend

### Create Event
Frontend directly calls: `apiClient.createCalendarEvent(input)`

This **already works** - goes straight to Supabase. No n8n needed.

### Update Event
Frontend directly calls: `apiClient.updateCalendarEvent(id, patch)`

Already works via Supabase.

### Delete Event
Frontend directly calls: `apiClient.deleteCalendarEvent(id)`

Already works via Supabase.

**Note**: Events created from patterns have `source_pattern_id` set, so you can track which pattern generated them.

---

## 5. Frontend API Client Methods

### Already Implemented (No n8n needed)
```typescript
// Events
apiClient.createCalendarEvent(input)
apiClient.updateCalendarEvent(id, patch)
apiClient.deleteCalendarEvent(id)
apiClient.fetchCalendarEventsForYear(year)
apiClient.fetchCalendarEventsForDate(date)

// Patterns
apiClient.createCalendarPattern(input)
apiClient.updateCalendarPattern(id, patch)
apiClient.deleteCalendarPattern(id)
apiClient.fetchCalendarPatterns()
apiClient.fetchActiveCalendarPatterns()
```

### Needs n8n Integration
```typescript
// TODO: Add to apiClient
async parseNaturalLanguageEvent(text: string): Promise<CalendarEventInput> {
  const response = await fetch('/webhook/calendar-nl-parse', {
    method: 'POST',
    body: JSON.stringify({ text, context: { currentDate: new Date() } })
  });
  return response.json();
}

// TODO: Add to apiClient
async generatePatternEvents(patternId: string, period: { start_date, end_date }): Promise<void> {
  await fetch('/webhook/calendar-generate-pattern-events', {
    method: 'POST',
    body: JSON.stringify({ pattern_id: patternId, generate_for_period: period })
  });
}
```

---

## 6. LLM Prompt Examples

### For Natural Language Parsing

```
You are a calendar event parser. Extract structured data from natural language.

Input: "Doctor appointment next Tuesday at 2pm"
Context: Today is 2024-12-14 (Saturday)

Extract:
- title: string
- start_date: YYYY-MM-DD
- end_date: YYYY-MM-DD (same as start_date for single-day)
- start_time: HH:MM:SS (null if not specified or all-day)
- end_time: HH:MM:SS (null if not specified)
- all_day: boolean
- category: vacation|holiday|travel|medical|social|work|personal|null
- is_pto: boolean (true if mentions "PTO", "paid time off", "day off")
- affects_row_appearance: boolean (true only for travel)
- priority: 1-10 (default 5, travel=7)

Output JSON only, no explanation.
```

### For Pattern Rule Parsing

```
You are a calendar pattern parser. Extract recurrence rules from natural language.

Input: "Team meeting every Monday at 10am"

Extract:
- name: string (descriptive name)
- pattern_type: recurring|goal|one_off_template
- category: string
- rule_json: {
    frequency: daily|weekly|monthly|yearly
    days: [monday, tuesday, ...] (if weekly)
    day_of_month: number (if monthly)
    time: HH:MM
    duration_minutes: number (default 60)
  }

Output JSON only.
```

---

## 7. Data Flow Diagram

### Natural Language Event Creation
```
User types NL text
    ↓
Frontend sends to n8n webhook
    ↓
n8n calls LLM (OpenAI/Claude)
    ↓
LLM returns structured JSON
    ↓
n8n validates & returns to frontend
    ↓
Frontend calls apiClient.createCalendarEvent()
    ↓
Event saved to Supabase
    ↓
Calendar refreshes
```

### Pattern-Based Event Generation
```
Cron triggers daily (or user requests)
    ↓
n8n fetches active patterns from Supabase
    ↓
For each pattern:
  - Calculate next 30 days of events
  - Check for duplicates
  - Insert events with source_pattern_id
    ↓
Frontend polls or receives webhook
    ↓
Calendar refreshes with new events
```

---

## 8. Priority Implementation Order

### Phase 1: NL Event Creation (MVP)
1. ✅ Frontend UI (done)
2. ⏸️ n8n webhook endpoint
3. ⏸️ LLM integration (OpenAI/Claude)
4. ⏸️ Wire frontend NL inputs to webhook

**Impact**: Users can create events with natural language

### Phase 2: Pattern Management
1. ✅ Database schema (done)
2. ✅ Frontend API methods (done)
3. ⏸️ Pattern management UI (optional, can be manual SQL for now)

**Impact**: Users can define recurring patterns

### Phase 3: Pattern → Event Generation
1. ⏸️ Generation webhook
2. ⏸️ Cron job or manual trigger
3. ⏸️ Duplicate detection logic

**Impact**: Events auto-generate from patterns

---

## 9. Testing Checklist

### NL Parser Tests
- [ ] "Dentist appointment tomorrow at 3pm" → single event with time
- [ ] "Vacation Dec 20-25" → multi-day event
- [ ] "PTO on Friday" → single day with is_pto=true
- [ ] "Weekly standup every Monday at 9am" → suggests pattern creation
- [ ] "Trip to Hawaii next week" → travel category, multi-day

### Pattern Generation Tests
- [ ] Weekly recurring → generates 4-5 events per month
- [ ] Monthly recurring → generates 1 event per month
- [ ] Pattern with end_date → stops generating after that date
- [ ] Disabled pattern → no events generated
- [ ] Duplicate prevention → doesn't create same event twice

---

## 10. Error Handling

### NL Parsing Failures
If LLM can't parse:
```json
{
  "success": false,
  "error": "Could not understand date",
  "suggestion": "Try: 'Event name on MM/DD/YYYY'"
}
```

Frontend should:
- Show toast error
- Keep NL input open with user's text
- Suggest using manual form instead

### Pattern Generation Failures
If generation fails:
- Log error to Supabase logs
- Send notification to user (optional)
- Retry on next cron run

---

## Summary

**What's Ready Now:**
✅ Database schema (events + patterns)
✅ TypeScript types
✅ API client methods
✅ Frontend UI (NL inputs, manual forms, event display)
✅ Row coloring, PTO tracking, multi-day events

**What Needs n8n/LLM:**
⏸️ NL text → structured event JSON (webhook)
⏸️ Pattern → event generation (cron + webhook)
⏸️ Duplicate detection logic

**Next Steps:**
1. Build `/webhook/calendar-nl-parse` endpoint in n8n
2. Connect to OpenAI/Claude for parsing
3. Wire up frontend NL inputs to call webhook
4. Test with real examples
5. Add pattern generation cron (Phase 2)

The frontend is **100% ready** - just needs the backend webhooks! 🚀

