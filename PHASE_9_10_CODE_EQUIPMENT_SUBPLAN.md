# Phase 9.10 - Code: Equipment

## Status: Complete

## Objective

Rebuild equipment authoring on the shared runtime and validate the category-sensitive authoring flow for items, variants, containers, modifiers, restrictions, and effects. Equipment is a broad authoring surface and should prove that the new runtime handles dense authored records without falling back to legacy monolith forms.

## Prerequisite

- [PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md](PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md)
- [PHASE_8_8_FIGMA_EQUIPMENT_SUBPLAN.md](PHASE_8_8_FIGMA_EQUIPMENT_SUBPLAN.md)

## Surface Set

- equipment list route
- equipment create route
- equipment view or edit route
- locked-master copy flow

## Section Map

Derive sections from `EQUIPMENT_NODE_MAP` and the locked Figma screens:

1. Overview
   - `Name`
   - quote
   - description
   - category
   - rarity
2. Inventory and Cost
   - cost
   - weight
   - capacity
   - max stack
3. Mechanics
   - attributes
   - properties
   - armor class
   - max bonus
   - charges
4. Relationships
   - contains
   - parent equipment for variants
   - restrictions
5. Features and Effects
   - features
   - modifiers
   - effects

## Transport and Data Requirements

- `GET /content/equipment`
- `GET /content/equipment/:id`
- `POST /content/equipment`
- explicit `provenance` and `permissions`
- reference data for:
  - currencies
  - rarities
  - equipment relationships
  - restrictions and modifier inputs
  - effect-related system data

## Implementation Tracks

1. Rebuild the equipment list and support category and property filters on the shared list pattern.
2. Render category-aware equipment sections through the shared runtime without hand-coded category forms.
3. Keep nested `contains` and parent-equipment relationships honest in the UI instead of flattening them into fake summaries.
4. Reuse shared effect and modifier editing primitives where applicable.
5. Support locked-master copy the same way as other authored domains.

## Implementation Notes

- Equipment now has active `/equipment`, `/equipment/new`, `/equipment/$equipmentId`, and `/equipment/$equipmentId/edit` routes on the shared Phase 9 stack.
- Equipment REST routes support list/detail plus draft `get`, `save`, `discard`, and `activate`, with activation using node-runtime normalization before strict DTO persistence.
- Equipment list data maps provenance, permissions, status, category, and source metadata into the shared authored-list pattern.
- Equipment form uses TanStack Form composition, the shared authored-form frame, node-runtime-backed options/visibility, draft sidecar persistence, and locked-master duplicate-only behavior.
- Base equipment and variants use the same form runtime while hiding base-only Inventory and Contents steps for variants.
- Nested equipment structures are editable through focused runtime-backed editors:
  - features use the equipment feature map
  - restrictions use the equipment restrictions/facet map
  - modifiers use the shared modifier grant map
  - charges use the equipment charge map
  - contents use the shared contains map
- The shared equipment node map now exposes typed child maps for equipment-owned features, restrictions, charges, and modifiers.

## Stories, Tests, and Playwright

- Storybook:
  - equipment list states
  - overview section
  - relationships section
  - effects and modifiers section
  - locked-master equipment view
- Vitest:
  - category-driven rendering
  - nested `contains` updates
  - locked-master copy behavior
- Playwright:
  - create equipment
  - edit equipment
  - copy locked-master equipment

## Legacy Cleanup

- retire old equipment step components
- remove any remaining equipment mutations that bypass the shared transport adapter

## Exit Criteria

- Equipment authoring works on the shared runtime without domain-specific fallback architecture.
- Nested inventory relationships render honestly.
- Locked-master equipment copy is stable.

## Validation

- Passed: `yarn build:schema`
- Passed: `yarn build:shared`
- Passed: `yarn build:functions`
- Passed: `yarn build:db`
- Passed: `yarn build:apis`
- Passed: `yarn workspace @artificer-toolkit/web test`
- Passed: `yarn workspace @artificer-toolkit/web typecheck` except documented legacy `src/utils` blockers
- Passed: `yarn workspace @artificer-toolkit/web build-storybook`
- Passed: `yarn workspace @artificer-toolkit/web test:e2e:app`
- Passed: `yarn workspace @artificer-toolkit/web test:e2e:storybook`
- Accepted non-blocker: `yarn build:web` still fails only on the documented legacy `src/utils` alias/type issues outside the active Phase 9 Equipment implementation.
- Accepted non-blocker: Storybook build reports existing large chunk warnings.
- Accepted non-blocker: app Playwright smoke reports the known TanStack Start dev-style warning for Mantine ScrollArea CSS while tests pass.
- Accepted non-blocker: Storybook Playwright reports existing Tiptap duplicate extension warnings while tests pass.
