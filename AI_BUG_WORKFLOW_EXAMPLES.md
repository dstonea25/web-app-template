# AI Bug Workflow Examples

This document shows you exactly what to say to me to manage your bugs using the new bug reporting feature.

## 🔍 Querying Bugs

### See All Open Bugs
```
You: "Can you summarize open bugs?"
or
You: "Show me all open bugs"
or
You: "What bugs are currently open?"
```

I'll run:
```sql
SELECT id, description, url, created_at, status 
FROM bugs 
WHERE status = 'open' 
ORDER BY created_at DESC;
```

And give you a nice formatted list with:
- Bug ID
- Description
- When it was reported
- What page it was on

### See All Bugs (Any Status)
```
You: "Show me all bugs"
or
You: "List all bugs including fixed ones"
```

### See Bugs from Specific Timeframe
```
You: "Show bugs from the last week"
You: "What bugs were reported in the last 3 days?"
You: "Show bugs from January 2026"
```

### Search for Specific Bug
```
You: "Find the bug about habit streaks"
You: "Show me the bug related to calendar events"
```

## 🔧 Fixing Bugs

### Fix a Specific Bug
```
You: "Can you fix the bug about habit tracker showing wrong streak?"
```

I will:
1. Query the database to find the bug by description
2. Read the full bug details including URL
3. Search your codebase for relevant code
4. Analyze the issue
5. Implement a fix
6. Ask if you want me to update the bug status

### Fix Multiple Bugs
```
You: "Can you try to fix all open bugs?"
```

I'll:
1. Get all open bugs
2. Work through them one by one
3. Fix what I can
4. Report which ones I fixed and which need more info

### Just Analyze (Don't Fix)
```
You: "Can you look at bug ID abc-123 and tell me what might be wrong?"
```

I'll analyze without making changes, useful for:
- Understanding complexity
- Getting fix suggestions
- Planning approach

## ✅ Updating Bug Status

### Mark as Fixed
```
You: "Mark bug abc-123 as fixed"
or
You: "Update the habit streak bug to fixed status"
```

I'll run:
```sql
UPDATE bugs 
SET status = 'fixed', fixed_at = NOW() 
WHERE id = 'abc-123';
```

### Mark as In Progress
```
You: "Mark bug abc-123 as in progress"
```

### Close a Bug
```
You: "Close bug abc-123"
```

### Add Notes to a Bug
```
You: "Add a note to bug abc-123: 'This only happens on mobile Safari'"
```

I'll run:
```sql
UPDATE bugs 
SET notes = 'This only happens on mobile Safari' 
WHERE id = 'abc-123';
```

## 🗑️ Deleting Bugs

### Delete a Single Bug
```
You: "Delete bug abc-123"
```

### Delete All Fixed Bugs
```
You: "Delete all bugs with status fixed"
```

I'll run:
```sql
DELETE FROM bugs WHERE status = 'fixed';
```

## 📊 Statistics and Reporting

### Bug Count by Status
```
You: "How many bugs are open vs fixed?"
```

I'll run:
```sql
SELECT status, COUNT(*) as count 
FROM bugs 
GROUP BY status;
```

### Recent Activity
```
You: "What bugs were fixed this week?"
```

### Priority Analysis
```
You: "Which bugs are on the home page?"
```

I'll search for bugs where `url` contains `/home` or similar.

## 🔄 Complete Workflow Example

```
You: "Show me all open bugs"

Me: [Lists 3 bugs]
- Bug 1: Habit tracker shows wrong count
- Bug 2: Calendar event time picker broken
- Bug 3: Ideas table not sorting correctly

You: "Can you fix the habit tracker bug?"

Me: [Analyzes code, finds issue, implements fix]
"I found the issue in HabitStatsModule.tsx. The streak calculation 
was using the wrong date format. I've fixed it. Would you like me to 
mark this bug as fixed?"

You: "Yes, mark it as fixed"

Me: [Updates database]
"Done! Bug abc-123 is now marked as fixed with timestamp."

You: "Now show me the remaining open bugs"

Me: [Shows 2 remaining bugs]

You: "Can you fix the calendar bug next?"

Me: [Repeats process]
```

## 💡 Pro Tips

### Be Specific When Reporting
When you initially report bugs via the UI, be specific enough that I can understand the context later:

**Good:**
- "Habit streak resets to 0 after completing a habit on mobile"
- "Calendar event modal doesn't save time when clicking Save button"
- "Ideas table shows newest at bottom instead of top"

**Less Good:**
- "Something is broken"
- "Not working"
- "Bug in calendar"

### Group Related Work
```
You: "Show me all bugs related to habits, then fix them"
```

### Combine Operations
```
You: "Fix the calendar bug, mark it as fixed, then show me remaining open bugs"
```

### Ask for Context
```
You: "Before fixing the habit bug, can you show me the related code?"
```

## 🚀 Advanced Usage

### Export Bugs for Documentation
```
You: "Export all bugs to a markdown report"
```

I can format them nicely for documentation.

### Create GitHub Issues
```
You: "Create a GitHub issue for bug abc-123"
```

(If you have GitHub integration set up)

### Batch Operations
```
You: "Close all bugs fixed more than 30 days ago"
```

### Analysis Queries
```
You: "What's the most common type of bug?"
You: "Show me bugs that mention 'mobile'"
You: "Which page has the most bugs?"
```

## 📝 Remember

- I can see everything in your `bugs` table
- I have full access to your codebase to fix issues
- I can update the database directly
- You can always manually check/update via Supabase dashboard
- The bug descriptions serve as context for me to understand and fix issues

Happy bug hunting! 🐛✨
