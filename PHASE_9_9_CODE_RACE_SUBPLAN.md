# Phase 9.9 - Code: Race

## Status: Not Started

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
- explicit `provenance` and `permissions`
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
5. Use the standard locked-master copy flow for authored race data.

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
