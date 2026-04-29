# Phase 9.7 - Code: Background

## Status: Complete

## Objective

Rebuild the background authoring surfaces on the shared list and form runtime. Background is the first non-effect-heavy authored domain and validates the reusable section, longform, proficiency, and starting-equipment patterns.

## Prerequisites

- [PHASE_9_6_CODE_SPELL_SUBPLAN.md](PHASE_9_6_CODE_SPELL_SUBPLAN.md)
- [PHASE_9_6_1_NODE_MAP_RESOLVER_SUBPLAN.md](PHASE_9_6_1_NODE_MAP_RESOLVER_SUBPLAN.md)
- Shared Figma file, `Backgrounds` page:
  - `IF1 - Background Basics`
  - `IF2 - Background Content`
  - `IF3 - Background Details`

Older `PHASE_8_4_FIGMA_BACKGROUND_SUBPLAN.md` prose is treated as archival where it conflicts with the current Figma frames.

## Surface Set

- background list route
- background create route
- background view or edit route
- locked-master copy flow

## Section Map

Derive sections from `BACKGROUND_NODE_MAP` and the locked Figma screens:

1. Overview
   - `Name`
   - description
2. Details
   - ordered details
3. Proficiencies
   - skills, tools, languages, and related grants
4. Features
   - background-owned feature list
5. Starting Equipment
   - starting equipment package and quantities

## Transport and Data Requirements

- `GET /content/backgrounds`
- `GET /content/backgrounds/:id`
- `POST /content/backgrounds`
- explicit `provenance` and `permissions`
- node-map runtime resolution for:
  - rendered sections and visible nodes
  - required state
  - hidden-value behavior
  - proficiencies
  - equipment
  - features
  - systems and currencies where required by starting equipment
- explicit page-level reference data only where the UI needs data outside field option resolution
- 9.6.1 runtime status:
  - use `POST /node-runtime/resolve` for Background root and nested editor scopes
  - use `POST /node-runtime/normalize-values` before saving rebuilt Background drafts
  - do not add Background-specific reference loaders for node-map field options unless the node-map DSL is missing required metadata

## Implementation Notes

- Added active Background routes:
  - `/backgrounds`
  - `/backgrounds/new`
  - `/backgrounds/$backgroundId`
  - `/backgrounds/$backgroundId/edit`
- The detail route is a nested parent with an `Outlet`, so the edit child mounts correctly.
- Added Background to the authenticated app navigation once the route became live.
- Background list now uses the generalized authored-list display metadata instead of Spell-only fields.
- Background create/edit/detail pages use the Phase 9.4 REST adapter and TanStack Query helpers.
- Background save in `apps/apis` normalizes through `normalizeNodeRuntimeValues({ mapId: 'background', values })` before persistence.
- Root Background form uses the shared TanStack Form runtime and node-runtime bridge for active draft values and hidden clear-path behavior.
- Nested Background scopes use the node-runtime resolver:
  - `proficiencyGrant`
  - `startingEquipmentItem`
- Details, proficiencies, features, and starting equipment use focused full-screen nested editors instead of deeply nested inline forms.
- Locked master Backgrounds render read-only, hide save/edit affordances, and expose duplicate-to-edit.
- The old provisional Background implementation is moved under `apps/web/src/legacy/domains/backgrounds` so active routes no longer import the legacy `useDomainForm` path.
- Added `@artificer-toolkit/shared/utils` package subpath and moved form runtime imports to that narrower utility export to avoid pulling the full shared root into Storybook/runtime stories.
- Corrected the 9.6 Spell form before 9.7 closeout so it no longer stays on a purely hand-wired top-level option path:
  - `SPELL_NODE_MAP` now owns material-description visibility and `CLEAR` behavior.
  - the isolated Spell form consumes `POST /node-runtime/resolve` for top-level class, school, component, attribute, and material-description runtime metadata while preserving the Figma-aligned custom layout.
  - shared form runtime helpers expose resolved-node option, visibility, requiredness, and clear-path utilities for custom form layouts that cannot be rendered as a generic node-map section.
  - Storybook/MSW now includes a Spell node-runtime response fixture so Spell stories exercise the resolver-backed path.
- Corrected the authored-form component boundary after review:
  - Spell and Background now share `AuthoredFormRoot`, `AuthoredFormHeader`, `AuthoredFormShell`, `AuthoredFormSectionStack`, `AuthoredFormSection`, and `AuthoredFormFooter`.
  - domain files now own only domain-specific flow, collection editing, field grid sizing, and effect/background-specific behavior.
  - removed stale per-domain copies of the form shell, header, section panel, footer, and input styling from active Spell/Background CSS.

## Implementation Tracks

1. Rebuild the background list with the shared list pattern and locked-master affordances.
2. Render the background form from shared node-map sections rather than hand-written step components.
3. Use proper textarea or rich-text treatment for longform description fields.
4. Build starting-equipment editing on the shared nested object and relationship-picker runtime, using the node-map runtime resolver for visibility, required state, hidden behavior, and `DATA` sources instead of hard-wired Background reference loaders or web-local condition logic.
5. Keep save, edit, and copy flows entirely transport-backed through `apps/apis`.

## Stories, Tests, and Playwright

- Storybook:
  - list states
  - description field states
  - proficiency section
  - starting equipment section
  - locked-master background view
- Vitest:
  - background section resolution
  - nested starting-equipment updates
  - read-only locked-master rendering
- Playwright:
  - create background
  - edit background
  - copy locked-master background

## Validation Notes

- `yarn build:schema` passes.
- `yarn build:shared` passes.
- `yarn build:functions` passes.
- `yarn build:apis` passes.
- `yarn workspace @artificer-toolkit/web test` passes.
- `yarn workspace @artificer-toolkit/web test:e2e:app` passes.
- `yarn workspace @artificer-toolkit/web build-storybook` passes with the existing Storybook/Vite chunk-size warning.
- `yarn workspace @artificer-toolkit/web test:e2e:storybook` passes, including Background list/form/locked-master stories.
- Manual Storybook review accepted the Background and corrected Spell authored-form stories.
- Latest Spell correction validation:
  - `yarn test:shared node-sections` passes.
  - `yarn build:shared` passes.
  - `yarn build:functions` passes.
  - `yarn workspace @artificer-toolkit/web test src/components/Form/runtime/FormRuntime.test.tsx src/domains/spells/spellAuthoring.test.ts` passes.
  - `yarn workspace @artificer-toolkit/web test src/domains/backgrounds/BackgroundForm.test.tsx src/domains/spells/spellAuthoring.test.ts src/components/Form/runtime/FormRuntime.test.tsx` passes after the shared authored-form layout extraction.
  - `yarn workspace @artificer-toolkit/web test:e2e:storybook --grep "spell form"` passes.
  - `yarn workspace @artificer-toolkit/web test:e2e:storybook --grep "background form|spell form"` passes after the shared authored-form layout extraction.
  - `yarn workspace @artificer-toolkit/web build-storybook` passes with the existing Storybook/Vite chunk-size warning.
- `yarn build:web` still fails only on the documented legacy `apps/web/src/utils` alias/type failures.

## Accepted Non-Blockers

- Full `build:web` remains blocked by known legacy `apps/web/src/utils` failures unrelated to 9.7.
- Full authenticated app Playwright coverage for Background create/edit/duplicate still needs the seeded auth/backend route-flow harness. Current coverage includes route matching tests plus Storybook Playwright for the Background list, edit form, and locked-master states.
- Deep Feature effect/grant authoring inside Background remains intentionally minimal until standalone Features work.
- Delete remains omitted from active Background UI because a safe backend delete path is not part of this tranche.

## Legacy Cleanup

- retire old background step components
- retire any background-specific web mutation path outside the shared adapter
- remove outdated placeholder assumptions carried over from the old UI

## Exit Criteria

- Background surfaces run on the shared list and form runtime.
- Longform and nested-equipment editing are approved.
- Locked-master copy works the same way as spell.
