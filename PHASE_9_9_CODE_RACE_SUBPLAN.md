# Phase 9.9 - Code: Race

## Status: Complete

## Objective

Rebuild race authoring using the shared runtime while preserving locked product language and category-aware authoring behavior. This tranche must keep race-domain authoring honest to the shared model while preserving the player-facing `Race` terminology used in the rest of the product.

## Prerequisite

- [PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md](PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md)
- [PHASE_8_7_FIGMA_RACE_SUBPLAN.md](PHASE_8_7_FIGMA_RACE_SUBPLAN.md)

## Surface Set

- race list route
- race create route
- race view or edit route
- locked-master copy flow
- save draft / resume draft / activate draft flow through `authored_subject_drafts`

## Section Map

Derive sections from `RACE_NODE_MAP` and the locked Figma screens:

1. Overview
   - `Name`
   - quote
   - description
   - category
2. Core Details
   - details
   - heritages or parent race
   - selection mode
   - size
   - speeds
3. Ancestry
   - ancestry definition and options
4. Features
   - race-owned features

## Transport and Data Requirements

- `GET /content/races`
- `GET /content/races/:id`
- `POST /content/races`
- `GET /content/races/:id/draft`
- `POST /content/races/draft`
- `DELETE /content/races/:id/draft`
- `POST /content/races/:id/draft/activate`
- explicit `provenance` and `permissions`
- list/detail loaders merge owned drafts using the Phase 9.8.1 sidecar model
- reference data for:
  - heritages
  - base races for subrace relationships
  - features
  - size and speed system data

## Implementation Tracks

1. Rebuild the race list and include clear category filtering for base race vs subrace records.
2. Render category-specific sections through node-map metadata instead of ad hoc conditional form code.
3. Keep player-facing UI copy aligned to `Race`, never `Species`.
4. Build ancestry-option editing on the shared nested collection runtime.
5. Use the standard locked-master copy flow for authored race data, creating an owned draft sidecar instead of immediately writing normalized rows.
6. Keep normalized race upserts strict; incomplete base race/subrace drafts stay in `authored_subject_drafts` until activation.

## Stories, Tests, and Playwright

- Storybook:
  - race list states
  - base race overview
  - subrace overview
  - ancestry section
  - locked-master race view
- Vitest:
  - category-driven section visibility
  - ancestry-option nested edits
  - copy-to-edit behavior
  - save draft, resume draft, discard draft, and activate draft behavior
- Playwright:
  - create base race
  - create subrace
  - edit owned race
  - copy locked-master race

## Legacy Cleanup

- retire old race step components and sub-entity editing assumptions that do not match the locked Figma/runtime model
- remove race web mutations outside the shared transport adapter

## Exit Criteria

- Race authoring works through the shared runtime with category-aware sections.
- The UI preserves `Race` terminology.
- Locked-master copy and nested ancestry editing are stable.

## Implementation Notes

- Race now follows the Phase 9 stack: REST through `apps/apis`, draft sidecar persistence, SSR-aware TanStack Query loaders, shared authored list/form shells, TanStack Form composition, and node-runtime-backed options/visibility.
- Race routes are live at `/races`, `/races/new`, `/races/$raceId`, and `/races/$raceId/edit`; the detail parent renders an `Outlet`.
- Race is modeled as two category-driven records only: `BASE` and `SUBRACE`. `VARIANT` remains excluded from 9.9.
- Base-race and subrace forms use the Figma Races frames as flow guidance: BF1-BF4 for base race and SF1-SF2 for subrace, with subrace inherited content shown as summary rather than inline parent editing.
- `RACE_NODE_MAP` now marks category-specific fields with hidden clearing/required metadata so the runtime can clear base-only/subrace-only values.
- List rows preserve draft-only category metadata, so Base Race/Subrace filters work before activation.

## Validation Notes

- Passed: `yarn build:schema`
- Passed: `yarn build:shared`
- Passed: `yarn build:db`
- Passed: `yarn build:functions`
- Passed: `yarn build:apis`
- Passed: `yarn test:schema`
- Passed: `yarn vitest run apps/apis/src/routes/authoredContent.test.ts`
- Passed: `yarn workspace @artificer-toolkit/web test`
- Passed: `yarn workspace @artificer-toolkit/web build-storybook`
- Passed: `yarn workspace @artificer-toolkit/web test:e2e:storybook`
- Passed: `yarn workspace @artificer-toolkit/web test:e2e:app`
- Accepted non-blocker: `yarn build:web` still fails only on the documented legacy `apps/web/src/utils` alias/type failures outside the active Phase 9.9 Race implementation.
- Accepted warning: app e2e still logs the existing TanStack Start dev-style collection warning for Mantine `ScrollArea.module.css.mjs`; tests pass and no Race route failure is exposed.
- Manual review accepted for Phase 9.9. Deeper real-world UI feedback is deferred until the remaining authored domains are wired together, but each later tranche should still run an impeccable critique/audit/polish pass before closeout.
- Post-approval impeccable technical audit completed. P1 fixes applied for route-keyed form remounting and typed node option fallback without weakening the node-map contract in active Race code.
