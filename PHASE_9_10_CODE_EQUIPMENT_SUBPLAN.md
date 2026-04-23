# Phase 9.10 - Code: Equipment

## Status: Not Started

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
