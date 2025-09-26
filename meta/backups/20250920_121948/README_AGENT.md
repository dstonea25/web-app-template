# Meta Directory - Agent Only

**Meta is agent-only** (planning & self-audit). App must NOT import /meta at runtime.

## Structure
- `/meta/global/` - Global style, scope, and function definitions
- `/meta/tabs/` - Tab-specific meta files for agent context
- `/meta/backups/` - Versioned backups before edits

## Rules
- Back up metas before edits
- Acceptance in metas is binding
- Runtime code must use `src/config/tabs.ts` and `src/theme/config.ts`
- Never add runtime meta loaders or imports

## Adding New Tabs
1. Create 3 meta files under `/meta/tabs/<id>/` (scope/functions/styles)
2. Update `TAB_REGISTRY` in `src/config/tabs.ts`
3. Create page at `src/pages/<NewTab>.tsx`
4. Follow existing patterns - runtime remains decoupled from meta
