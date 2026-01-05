# PTO (Paid Time Off) Feature Guide

## ✅ What's Been Added

### Database
- ✅ `is_pto` boolean field added to `calendar_events` table
- ✅ Index created for efficient PTO queries
- ✅ Migration applied successfully

### Visual Indicators

#### 1. **PTO-Only Days** → Golden Background
When a day ONLY has PTO (no other events with row appearance):
- **Row color**: Golden/yellow tint (`bg-yellow-950/40`)
- **Border**: Yellow accent (`border-yellow-700/50`)
- **Use case**: Taking a day off with no other events

#### 2. **PTO + Other Events** → Primary Color + Gold Dot
When PTO overlaps with vacation/trip/medical:
- **Row color**: Shows the higher priority event color (e.g., vacation purple)
- **Gold dot**: Small gold circle indicator appears next to the date
- **Use case**: Taking PTO during a vacation trip

#### 3. **No PTO** → Normal Coloring
Regular events without PTO flag:
- No gold indicators
- Standard priority-based row coloring

---

## 📊 Examples

### Scenario 1: PTO-Only Day
```
Event: "Day Off"
  - is_pto: true
  - category: personal
  - affects_row_appearance: false (or true, doesn't matter)

Result: Golden background, no other indicators
```

### Scenario 2: PTO + Vacation
```
Event 1: "Hawaii Trip" 
  - is_pto: false
  - category: vacation
  - affects_row_appearance: true
  - priority: 10

Event 2: "PTO - Hawaii"
  - is_pto: true
  - category: vacation
  - affects_row_appearance: false (doesn't need to be true)

Result: Purple vacation background + gold dot indicator
```

### Scenario 3: Weekend + PTO
```
Day: Saturday (weekend)
Event: "PTO Day"
  - is_pto: true

Result: Golden background (PTO-only overrides weekend green)
```

---

## 🎨 Visual Priority Logic

The system now follows this hierarchy:

1. **Check for PTO events** on the day
2. **Check for non-PTO events** with `affects_row_appearance = true`

**If PTO exists AND no other visual events:**
- → Golden background (PTO-only mode)

**If PTO exists AND other visual events exist:**
- → Show highest priority event color as background
- → Add gold dot indicator next to date

**If no PTO:**
- → Standard priority system (vacation > holiday > medical > travel > weekend > work > social)

---

## 🖊️ Event Editor Changes

The event form now includes:

```
☐ All-day event
☑ Paid Time Off (PTO) • Shows gold indicator
```

- **Checkbox**: Mark any event as PTO
- **Color**: Yellow checkbox to match gold theme
- **Hint text**: Explains what it does
- **Works with any category**: You can have vacation + PTO, personal + PTO, etc.

---

## 💡 Usage Recommendations

### Best Practices:

1. **Vacation trips with PTO**:
   - Create one "Hawaii Trip" event (vacation category, affects_row_appearance = true)
   - Mark it as PTO ✓
   - Result: Purple vacation rows with gold dot

2. **Single PTO days**:
   - Create "Day Off" event
   - Mark as PTO ✓
   - No need to check "affects_row_appearance"
   - Result: Golden row

3. **Medical appointments with PTO**:
   - Create "Doctor Visit" (medical category, affects_row_appearance = true, priority = 8)
   - Mark as PTO ✓
   - Result: Orange medical row with gold dot

4. **PTO tracking**:
   - All PTO events are marked with `is_pto = true`
   - Easy to query: `SELECT * FROM calendar_events WHERE is_pto = true`
   - Can build reports: "Total PTO days used in 2024"

---

## 🔍 At-a-Glance PTO Visibility

### What You See:

**Calendar View:**
```
┌─────────────────────────────────────────┐
│ Dec 20  Wed [Vacation Trip ×]       🟡  │  ← Gold dot = PTO + Vacation
│ Purple background                        │
├─────────────────────────────────────────┤
│ Dec 21  Thu [Vacation Trip ×]       🟡  │
│ Purple background                        │
├─────────────────────────────────────────┤
│ Dec 22  Fri [Vacation Trip ×]       🟡  │
│ Purple background                        │
├─────────────────────────────────────────┤
│ Dec 23  Sat [Vacation Trip ×]       🟡  │  ← Weekend + Vacation + PTO
│ Purple background (vacation wins)        │
├─────────────────────────────────────────┤
│ Dec 26  Tue                              │  ← PTO-only day
│ Golden background                        │
└─────────────────────────────────────────┘
```

### Event Detail Panel:
```
Vacation Trip
Dec 20 → Dec 25, 2024
vacation • Priority 10
[🟡 PTO]  ← PTO badge

Notes: Family trip to Hawaii
```

---

## 🧪 Testing Checklist

- [ ] Create PTO-only event → Verify golden row
- [ ] Create vacation + PTO → Verify purple row with gold dot
- [ ] Create weekend + PTO → Verify golden row (PTO overrides weekend)
- [ ] Edit event and toggle PTO → Verify colors update
- [ ] Delete PTO event → Verify gold indicators disappear
- [ ] Multi-day PTO event → Verify all days show appropriate indicators

---

## 📈 Future Enhancements (Optional)

Possible additions:
1. **PTO Balance Tracking**: Show "X PTO days remaining"
2. **PTO Categories**: Sick leave, vacation leave, personal leave
3. **PTO Approval Status**: pending, approved, denied
4. **PTO Reports**: "PTO usage by month/quarter"
5. **Automatic Calculations**: Link to HR systems for accrual

---

## 🎯 Technical Details

### Database Schema:
```sql
calendar_events:
  - is_pto BOOLEAN DEFAULT false
  - (indexed for performance)
```

### TypeScript Types:
```typescript
interface CalendarEvent {
  // ... other fields
  is_pto: boolean;
}
```

### Color Values:
```typescript
ROW_COLORS.pto = {
  bg: 'bg-yellow-950/40',    // Dark golden tint
  border: 'border-yellow-700/50'  // Yellow accent border
}
```

Gold dot indicator:
```tsx
<span className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-300" />
```

---

## ✨ Summary

You can now:
- ✅ Mark any event as PTO
- ✅ See golden rows for PTO-only days
- ✅ See gold dots when PTO overlaps with trips/vacations
- ✅ Quickly identify PTO days at a glance
- ✅ Track PTO usage across the year

The system intelligently handles overlapping events, showing the most important visual information (vacation color) while still indicating PTO status (gold dot).











