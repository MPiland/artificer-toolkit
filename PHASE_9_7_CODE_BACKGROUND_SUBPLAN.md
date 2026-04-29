# Phase 9.7 - Code: Background

## Status: Active

## Objective

Rebuild the background authoring surfaces on the shared list and form runtime. Background is the first non-effect-heavy authored domain and validates the reusable section, longform, proficiency, and starting-equipment patterns.

## Prerequisite

- [PHASE_9_6_CODE_SPELL_SUBPLAN.md](PHASE_9_6_CODE_SPELL_SUBPLAN.md)
- [PHASE_9_6_1_NODE_MAP_RESOLVER_SUBPLAN.md](PHASE_9_6_1_NODE_MAP_RESOLVER_SUBPLAN.md)
- [PHASE_8_4_FIGMA_BACKGROUND_SUBPLAN.md](PHASE_8_4_FIGMA_BACKGROUND_SUBPLAN.md)

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

## Legacy Cleanup

- retire old background step components
- retire any background-specific web mutation path outside the shared adapter
- remove outdated placeholder assumptions carried over from the old UI

## Exit Criteria

- Background surfaces run on the shared list and form runtime.
- Longform and nested-equipment editing are approved.
- Locked-master copy works the same way as spell.
