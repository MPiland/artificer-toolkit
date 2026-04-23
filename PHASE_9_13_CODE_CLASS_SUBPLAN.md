# Phase 9.13 - Code: Class

## Status: Not Started

## Objective

Rebuild class authoring with separate base-class and subclass flows that match the locked Figma direction. This tranche should validate the most structurally dense authored domain while preserving honest starting-equipment structure, multiclass messaging, and separate subclass authoring instead of embedding subclass forms inside the base-class flow.

## Prerequisite

- [PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md](PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md)
- [PHASE_8_11_FIGMA_CLASS_SUBPLAN.md](PHASE_8_11_FIGMA_CLASS_SUBPLAN.md)

## Surface Set

- class list route
- base-class create route
- base-class view or edit route
- subclass create route
- subclass view or edit route
- locked-master copy flow for both base classes and subclasses

## Section Map

Derive sections from `CLASS_NODE_MAP` and the locked Figma screens.

### Base class flow

1. Overview
   - `Name`
   - description
   - details
   - attributes
2. Proficiencies
3. Hit Points and Starting Package
   - hitpoint
   - starting gold
   - starting equipment
4. Multiclass
   - requirement groups
   - multiclass proficiencies
5. Spellcasting
6. Resources
7. Features

### Subclass flow

1. Overview
   - `Name`
   - description
   - details
2. Parent Class
3. Attributes
4. Features
5. Specializations

## Transport and Data Requirements

- `GET /content/classes`
- `GET /content/classes/:id`
- `POST /content/classes`
- explicit `provenance` and `permissions`
- reference data for:
  - parent classes
  - currencies
  - proficiencies
  - starting equipment
  - spellcasting support data
  - features

## Implementation Tracks

1. Rebuild the class list with clear segmentation or filtering for base class vs subclass.
2. Build separate route and form entry points for base-class and subclass authoring.
3. Render starting equipment as honest nested structure, not flattened summary text.
4. Communicate multiclass requirements through the right UI behavior instead of validation panels divorced from the form.
5. Keep locked-master copy consistent for both base classes and subclasses.

## Stories, Tests, and Playwright

- Storybook:
  - class list states
  - base-class overview
  - subclass overview
  - multiclass section
  - starting-equipment section
  - locked-master class view
- Vitest:
  - base vs subclass section visibility
  - nested starting-equipment updates
  - copy-to-edit behavior
- Playwright:
  - create base class
  - create subclass
  - edit owned class
  - copy locked-master class

## Legacy Cleanup

- retire old inline subclass assumptions and stepper structures that conflict with the locked Figma
- remove class mutations outside the shared adapter

## Exit Criteria

- Base class and subclass authoring are separate flows.
- Starting equipment and multiclass behavior are represented honestly in the UI.
- Locked-master copy is stable for both class categories.
