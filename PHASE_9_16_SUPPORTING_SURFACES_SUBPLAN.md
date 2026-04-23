# Phase 9.16 - Supporting Surfaces and Final Cleanup

## Status: Not Started

## Objective

Finish the remaining admin and utility surfaces on the new architecture and remove the legacy frontend code that should no longer survive Phase 9. This tranche also closes the loop on Features, feat grants, systems, and any remaining route families that were intentionally held until the main locked surfaces were complete.

## Prerequisite

- [PHASE_9_13_CODE_CLASS_SUBPLAN.md](PHASE_9_13_CODE_CLASS_SUBPLAN.md)
- [PHASE_9_15_CHARACTER_SHEET_SUBPLAN.md](PHASE_9_15_CHARACTER_SHEET_SUBPLAN.md)

## Scope

- Features
- feat grants
- systems
- remaining admin or utility surfaces that still need to migrate to the new shell, transport, and form runtime
- final cleanup of provisional or bypassed frontend code

## Surface Rules

- Do not invent new UX that conflicts with locked Figma.
- Where standalone Figma is thinner for supporting surfaces, prefer stable admin UX on the new shell rather than resurrecting stale placeholder-era patterns.
- Supporting surfaces still follow the same transport, Storybook, Playwright, and review-gate rules as the primary domains.

## Implementation Tracks

1. Rebuild Features on the shared runtime and shell.
2. Rebuild feat grants on the shared runtime and shell.
3. Rebuild systems browsing and selection on the shared list and data runtime.
4. Migrate any remaining utility routes onto the new architecture.
5. Remove the old provisional frontend code once each replacement route is live.

## Final Cleanup Targets

- `apps/web/src/server/domains/*`
- direct product-data imports from `@artificer-toolkit/db`
- direct product-data imports from `@artificer-toolkit/functions`
- legacy Supabase `upsert_*` write paths from `apps/web`
- old `Form`, `List`, and `Detail` abstractions that encode outdated product structure
- `useDomainForm`
- `formStore`
- stale web-local type unions that no longer match the backend contracts
- dead placeholder routes and provisional shell code

## Stories, Tests, and Playwright

- Storybook:
  - supporting shared components
  - feature and feat-grant sections
  - systems list states
- Vitest:
  - any remaining supporting-store or adapter logic
  - cleanup-sensitive regressions
- Playwright:
  - systems navigation
  - features and feat-grant create or edit flows as applicable
  - regression sweep across surviving route families

## Review Gate

- No remaining active route depends on the old provisional architecture.
- Supporting surfaces are on the same shell, transport, and runtime stack as the primary domains.
- Regression sweep passes before any broader transport cutovers continue.

## Exit Criteria

- The frontend rebuild is functionally complete for the Phase 9 scope.
- Legacy provisional frontend code is off the active route path or deleted.
- The repo is ready for subsequent tRPC cutover work without still carrying the old UI architecture as a parallel implementation.
