# OKR Draft State Fix

## Problem

The quarterly OKR creation flow had a **transactional integrity issue**: OKRs were created directly in the database with `status='active'` immediately when the creation modal opened. If the user canceled mid-flow or encountered an error, the partially-created OKRs remained in the database, causing:

1. **Wrong quarter displayed** - The app thought the next quarter was Q3 2026 instead of Q2 2026 because Q2 was accidentally created prematurely on Jan 13
2. **Future quarter confusion** - System showing "Set Q3 OKRs" when user should be working on Q1 2026 (current quarter)
3. **Data inconsistency** - Orphaned OKRs in the database from canceled creation flows

### What Happened in Your Case

- **Q4 2025** (Oct-Dec 2025) - Your completed quarter ✅
- **Q1 2026** (Jan-Mar 2026) - Your **CURRENT** quarter (we're on Jan 18) ✅
- **Q2 2026** (Apr-Jun 2026) - **PREMATURELY CREATED** on Jan 13 when you canceled mid-flow ❌

This caused the system to think Q3 2026 was next, even though you should be working on Q1 2026.

## Solution: Draft State Workflow

Implemented a **two-phase commit pattern** for OKR creation:

### Phase 1: Draft Creation
- OKRs are created with `status='draft'` initially
- Draft OKRs are **invisible** to all queries and views
- User can edit, review, and modify in the modal

### Phase 2: Commit or Cleanup
- **On "Create" button**: Commit drafts → `status='active'` (atomic operation)
- **On "Cancel" button**: Delete all drafts for that quarter (cleanup)
- **On error**: Automatic cleanup of any draft OKRs created

## Changes Made

### Database Migration (`migrations/add_draft_okr_support.sql`)

1. **Updated `okrs_with_progress` view**
   - Filters out OKRs and Key Results with `status='draft'`
   - Only shows active/committed OKRs

2. **Added `commit_draft_okrs(quarter)` function**
   - Changes status from 'draft' to 'active' for a quarter
   - Updates both OKRs and their Key Results atomically

3. **Added `delete_draft_okrs(quarter)` function**
   - Deletes all draft OKRs and Key Results for a quarter
   - Used for cleanup on cancel or error

### Code Changes

#### `src/lib/okrs.ts`
- Updated `createQuarterOKRs()` to accept `draft` parameter (default: `true`)
- Added `commitDraftOkrs(quarter)` function
- Added `deleteDraftOkrs(quarter)` function

#### `src/pages/HomeTab.tsx`
- Updated `handleCreateQuarterOKRs()`:
  - Creates OKRs as drafts first
  - Commits drafts on success
  - Cleanup drafts on error
- Added `handleCancelQuarterlySetup()`:
  - Cleanup draft OKRs when user cancels
  - Called when modal is closed

## Workflow

```
User opens "Set Q2 2026 OKRs" modal
  ↓
[No OKRs created yet - data only in React state]
  ↓
User edits objectives and key results
  ↓
User clicks "Create Q2 2026 OKRs" button
  ↓
1. createQuarterOKRs(quarter, ..., draft=true)
   → OKRs created with status='draft'
   → NOT visible in okrs_with_progress view
  ↓
2. commitDraftOkrs(quarter)
   → Changes status to 'active'
   → OKRs now visible everywhere
  ↓
Success! Q2 2026 OKRs are active
```

**If user cancels:**
```
User opens "Set Q2 2026 OKRs" modal
  ↓
User edits some fields
  ↓
User clicks "Cancel" or X button
  ↓
deleteDraftOkrs(quarter)
  → Any draft OKRs are deleted
  → No orphaned data
```

**If error occurs:**
```
User clicks "Create Q2 2026 OKRs"
  ↓
createQuarterOKRs(...) succeeds
  ↓
commitDraftOkrs(...) fails
  ↓
Catch block executes:
  deleteDraftOkrs(quarter)
  → Cleanup any drafts
  → No orphaned data
```

## Benefits

1. ✅ **No more orphaned OKRs** - Canceling mid-flow leaves no trace
2. ✅ **Atomic commits** - OKRs are either fully created or not at all
3. ✅ **Error recovery** - Automatic cleanup on failures
4. ✅ **Consistent state** - Quarter detection logic now works correctly
5. ✅ **Safe testing** - Can preview/test OKR creation without side effects

## Testing

To test the fix:

1. **Normal flow**: Create Q2 2026 OKRs normally - should work as before
2. **Cancel flow**: Open modal, edit some fields, click Cancel - no orphaned OKRs
3. **Error handling**: Simulate an error during commit - drafts should cleanup
4. **View filtering**: Draft OKRs should never appear in the main OKR module

## Current Database State

After cleanup:
- ✅ **Q4 2025** (Oct-Dec 2025) - Completed quarter
- ✅ **Q1 2026** (Jan-Mar 2026) - **CURRENT** quarter (72 days left)
- ⏰ **Q2 2026** button will appear when ready to plan next quarter

The premature Q2 2026 OKRs have been deleted, and the system now correctly shows Q1 2026 as your current quarter.
