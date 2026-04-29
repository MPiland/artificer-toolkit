# Phase 9.8 - Code: Feat

## Status: Active

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

Derive sections from `FEAT_NODE_MAP` and the locked Figma screens:

1. Overview
   - `Name`
   - description
   - detail
2. Prerequisites
   - character-facing prerequisite rules
3. Effects
   - effect authoring surface
4. Charges
   - optional charge configuration
5. Grants
   - feature and rule grants
6. Features
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

1. Rebuild the feat list on the shared list pattern.
2. Reuse the spell effect-authoring affordances where the feat domain needs them, without pulling in spell-specific form structure.
3. Render prerequisites, grants, and charges through the shared nested editor runtime.
4. Keep user-facing copy plain-language and avoid schema wording in the feat UI.
5. Route locked-master copy through the standard fetch-clone-save flow.

## Stories, Tests, and Playwright

- Storybook:
  - feat list row states
  - prerequisite section
  - grants section
  - charges section
  - locked-master feat view
- Vitest:
  - prerequisite section rendering
  - grant draft updates
  - copy-to-edit behavior
- Playwright:
  - create feat
  - edit feat
  - copy locked-master feat

## Legacy Cleanup

- retire old feat form assumptions tied to the provisional form stack
- remove legacy mutation paths outside the shared transport adapter

## Exit Criteria

- Feat authoring works on the shared runtime without special-case legacy stores.
- Shared effect authoring is reusable outside the spell domain.
- Locked-master copy behavior remains consistent.
