# Phase 9.8 - Code: Feat

## Status: Complete

## Objective

Rebuild feat authoring on the shared runtime and validate the combined prerequisites, grants, features, and effect-authoring surface. Feat proves that effect-heavy authoring can coexist with the newer section-aware runtime outside the spell domain.

## Prerequisite

- [PHASE_9_6_CODE_SPELL_SUBPLAN.md](PHASE_9_6_CODE_SPELL_SUBPLAN.md)
- [PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md](PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md)
- [PHASE_8_5_FIGMA_FEAT_SUBPLAN.md](PHASE_8_5_FIGMA_FEAT_SUBPLAN.md)

## Surface Set

- feat list route
- feat create route
- feat view or edit route
- locked-master copy flow

## Section Map

Derive sections from `FEAT_NODE_MAP`, the shared authored-form pattern, and the accepted Spell/Background implementation. Exact Feat-specific Figma frames were not treated as canonical where they conflicted with the current shared form direction.

1. Basics
   - `Name`
   - description
   - detail
2. Prerequisites
   - character-facing prerequisite rules
3. Mechanics
   - effect authoring surface
   - optional charge configuration
   - feature and rule grants
4. Features
   - feat-owned feature list

## Transport and Data Requirements

- `GET /content/feats`
- `GET /content/feats/:id`
- `POST /content/feats`
- explicit `provenance` and `permissions`
- reference data for:
  - features
  - prerequisite facets
  - effect editor dependencies

## Implementation Tracks

1. Rebuilt the feat list on the shared `AuthoredListPage` pattern with status/source filters, sortable display metadata, owned/locked-master actions, and fixture-backed Storybook states.
2. Reused the shared full-screen `EffectEditor` through shared effect reference-data helpers so Feat does not depend on Spell-specific form structure.
3. Rendered prerequisites, grants, and charges through node-runtime-backed nested editor modals.
4. Kept user-facing copy plain-language and aligned with the Spell/Background authored-form layout.
5. Routed locked-master copy through the standard fetch-clone-save flow in the route/page layer.
6. Added active `/feats`, `/feats/new`, `/feats/$featId`, and `/feats/$featId/edit` routes with the detail parent rendering an `Outlet`.
7. Added Feat to authenticated navigation after the list route went live.
8. Updated Feat shared/schema/compiler contracts so top-level `grants.feats` is accepted and compiled.
9. Updated `apps/apis` Feat save to use schema-overload validation, server-owned authoring normalization, and `normalizeNodeRuntimeValues({ mapId: 'feat', values })` before persistence.

## Stories, Tests, and Playwright

- Storybook:
  - feat list row states
  - create feat form
  - edit owned feat form
  - locked-master feat view
  - prerequisite, mechanics, grants, charges, and feature-basics sections
- Vitest:
  - feat list mapping
  - empty draft and submit normalization
  - feature-basics add/edit flow
  - locked-master duplicate/read-only behavior
  - shared/schema feat-grant parsing and compilation
- Playwright:
  - Storybook feat list smoke
  - Storybook feat form section flow
  - Storybook locked-master duplicate-only state

## Validation Notes

Passed:

- `yarn build:schema`
- `yarn build:shared`
- `yarn build:functions`
- `yarn build:apis`
- `yarn test:schema`
- `yarn test:shared compiler-scaling node-sections`
- `yarn workspace @artificer-toolkit/web test src/domains/feats/featAuthoring.test.ts src/domains/feats/FeatForm.test.tsx src/data/feats/featListMapper.test.ts`
- `yarn workspace @artificer-toolkit/web test`
- `yarn workspace @artificer-toolkit/web test:e2e:app`
- `yarn workspace @artificer-toolkit/web build-storybook`
- `yarn workspace @artificer-toolkit/web test:e2e:storybook`

Accepted non-blocker:

- `yarn build:web` remains blocked only by the documented legacy `src/utils` alias/type failures outside the active Feat route/runtime work.

Manual review accepted:

- Feat list/form stories are accepted as consistent enough with the shared Spell/Background visual pattern for Phase 9.8 closeout.
- The folder-organization cleanup and Vite/Storybook alias correction landed after implementation so the active Feat code sits in the locked Phase 9 web taxonomy.
- Post-closeout impeccable technical audit completed during 9.9 approval. P1 fixes applied for draft parsing, route-keyed form remounting, and shared typed node-map contracts for Feat prerequisites/grants/charges instead of active-web `as unknown` casts.

## Legacy Cleanup

- retire old feat form assumptions tied to the provisional form stack
- remove legacy mutation paths outside the shared transport adapter

## Exit Criteria

- Feat authoring works on the shared runtime without special-case legacy stores.
- Shared effect authoring is reusable outside the spell domain.
- Locked-master copy behavior remains consistent.
- 9.8 is complete. Follow-up refinements should happen in later domain/runtime passes instead of reopening Feat closeout unless a real bug is found.
