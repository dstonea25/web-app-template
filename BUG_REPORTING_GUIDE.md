# Bug Reporting Guide

## Overview

Your Dashboard now has a built-in bug reporting feature! This allows you to quickly capture bugs while using the app in production without having to remember them later.

## How to Report a Bug

1. **Click the Bug Icon** in the top navigation bar (red bug icon)
2. **Describe the bug** in the text area - include:
   - What you were doing
   - What went wrong
   - What you expected to happen
3. **Press Submit** (or use `⌘ Enter` / `Ctrl Enter`)

The bug is automatically saved to your database with:
- Your description
- The current URL where the bug occurred
- Your browser information (user agent)
- A timestamp

## How to Review and Fix Bugs with AI

When you want to fix bugs, just come to this chat and ask:

### Examples:

**"Can you summarize open bugs?"**
I'll query your database and list all bugs with status='open', showing you what needs fixing.

**"Show me all bugs from the last week"**
I'll query bugs created in the past 7 days.

**"Can you fix the bug about [description]?"**
I'll search for that bug, read the description, analyze your codebase, and implement a fix.

**"Mark bug ID [uuid] as fixed"**
I'll update the status in the database to 'fixed'.

## Database Schema

The bugs are stored in the `bugs` table with these columns:

- `id` (UUID) - Unique identifier
- `description` (TEXT) - Your bug description
- `status` (TEXT) - open | in_progress | fixed | closed
- `url` (TEXT) - Page where bug occurred
- `user_agent` (TEXT) - Browser info
- `notes` (TEXT) - Additional notes (can be added later)
- `user_id` (TEXT) - For multi-user support
- `created_at` (TIMESTAMPTZ) - When reported
- `updated_at` (TIMESTAMPTZ) - Last update
- `fixed_at` (TIMESTAMPTZ) - When marked as fixed

## Example Workflow

1. **Using the app**: You notice the habit tracker shows the wrong streak
2. **Report it**: Click bug icon → "Habit tracker shows wrong streak count on mobile"
3. **Later in AI chat**: "Can you summarize open bugs and try to fix them?"
4. **AI fixes the bugs**: I'll read the bugs, analyze your code, implement fixes
5. **Manual status update**: You can manually update bug status in the database or ask me to do it

## Tips for Better Bug Reports

- Be specific but concise
- Include what page/component you were on
- Mention if it's mobile-specific, timing-related, etc.
- Don't worry about perfect grammar - just capture the essence

## Querying Bugs via Supabase MCP

I have access to your Supabase database through the MCP tools, so I can:

- Query bugs: `SELECT * FROM bugs WHERE status = 'open' ORDER BY created_at DESC;`
- Update status: `UPDATE bugs SET status = 'fixed', fixed_at = NOW() WHERE id = '...';`
- Add notes: `UPDATE bugs SET notes = '...' WHERE id = '...';`
- Delete bugs: `DELETE FROM bugs WHERE id = '...';`

## Future Enhancements

If you want, we could add:
- A bugs management page in the UI
- Severity levels (low, medium, high, critical)
- Categories/tags for bugs
- Assignment to different people
- Attachments or screenshots
- Integration with GitHub Issues
