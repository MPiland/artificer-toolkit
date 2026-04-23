# Phase 9.12 - Code: Vehicle

## Status: Not Started

## Objective

Rebuild vehicle authoring as one shared vehicle flow. This tranche intentionally avoids category-specific vehicle forms and instead validates that the shared authored-form runtime can support a single truthful flow across land, water, air, and spelljammer vehicle records.

## Prerequisite

- [PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md](PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md)
- [PHASE_8_10_FIGMA_VEHICLE_SUBPLAN.md](PHASE_8_10_FIGMA_VEHICLE_SUBPLAN.md)

## Surface Set

- vehicle list route
- vehicle create route
- vehicle view or edit route
- locked-master copy flow

## Section Map

Derive sections from `VEHICLE_NODE_MAP` and the locked Figma screens:

1. Overview
   - `Name`
   - description
   - category
   - size
2. Stats
   - armor class
   - hit points
   - speed
   - speed note
3. Crew and Capacity
   - crew minimum
   - crew maximum
   - passenger capacity
   - cargo capacity
4. Cost and Properties
   - cost
   - properties
5. Features and Details
   - features
   - ordered details

## Transport and Data Requirements

- `GET /content/vehicles`
- `GET /content/vehicles/:id`
- `POST /content/vehicles`
- explicit `provenance` and `permissions`
- reference data for:
  - size
  - currencies
  - vehicle category system values

## Implementation Tracks

1. Rebuild the vehicle list on the shared list pattern.
2. Implement one shared vehicle form instead of splitting by category.
3. Preserve truthful field treatment for capacity, crew, and property structure.
4. Support copy-to-edit for master vehicle records.

## Stories, Tests, and Playwright

- Storybook:
  - vehicle list states
  - stats section
  - crew and capacity section
  - locked-master vehicle view
- Vitest:
  - single-flow section rendering
  - nested detail updates
  - copy-to-edit behavior
- Playwright:
  - create vehicle
  - edit vehicle
  - copy locked-master vehicle

## Legacy Cleanup

- retire any category-specific vehicle assumptions carried over from old placeholder planning
- remove vehicle mutation paths outside the shared adapter

## Exit Criteria

- Vehicle authoring ships as one shared flow.
- Locked-master copy behavior is stable.
- The shared runtime handles vehicle-specific data without special-case route architecture.
