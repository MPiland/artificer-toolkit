# Phase 9.14 - Character Builder

## Status: Not Started

## Objective

Rebuild the character builder as an engine-backed structural editing surface. This tranche must implement the locked `CC*` and `EC*` flows, keep structural choices in the builder, and delete the legacy character hook and step-store architecture as the new builder routes cut over.

## Prerequisite

- [PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md](PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md)
- [PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md](PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md)
- [PHASE_8_12_FIGMA_CHARACTER_WIZARD_SUBPLAN.md](PHASE_8_12_FIGMA_CHARACTER_WIZARD_SUBPLAN.md)
- character-content domains needed by the builder are available through the new transport adapter

## Screen Set

### Creation flow

- `CC1 - Character Basics`
- `CC2 - Character Race`
- `CC3 - Character Classes`
- `CC4 - Character Background`
- `CC5 - Character Details`
- `CC6 - Character Personality & Notes`
- `CC7 - Character Abilities & Hit Points`
- `CC8 - Character Equipment & Currency`
- `CC9 - Character Review`

### Structural edit flow

- `EC1 - Edit Character Basics`
- `EC2 - Edit Character Race`
- `EC3 - Edit Character Classes`
- `EC4 - Edit Character Background`
- `EC5 - Edit Character Details`
- `EC6 - Edit Character Personality & Notes`
- `EC7 - Edit Character Abilities & Hit Points`
- `EC8 - Edit Character Equipment Choices`
- `EC9 - Edit Character Review`
- `EC10 - Edit Save Preview`

## Transport Requirements

- `POST /characters/draft`
- `GET /characters/:id`
- `POST /characters/resolve`
- `POST /characters/preview-save`
- `POST /characters/upsert`

The builder consumes authored character state plus backend resolution and preview results. Structural rules are not reimplemented in the web layer.

## Locked Decisions

- Use `Race`, never `Species`.
- No standalone `Selections` screen.
- No persistent readiness or edit-rules dashboard.
- Source-local choices remain on the granting screen.
- Invalid multiclass options stay visible but disabled.
- Selected classes render as expandable cards with contextual `Overview`, `Features`, and conditional `Spells`.
- Save preview remains a plain-language consequence modal.

## Implementation Tracks

1. Rebuild the characters index and builder route entry points on the new shell.
2. SSR the builder shell and initial draft or existing character payload.
3. Render the builder screens around backend-driven resolution state instead of legacy local derivation hooks.
4. Keep structural edits localized to the relevant screen and surface source-local choices where they are granted.
5. Implement the edit-save preview modal from backend preview data, not frontend guesswork.
6. Remove legacy builder hook composition and step-store behavior as routes cut over.

## Stories, Tests, and Playwright

- Storybook:
  - builder step shells
  - class card states
  - disabled multiclass option states
  - review screen states
  - save preview modal
- Vitest:
  - builder route-state transformations
  - preview payload rendering
  - local UI state around class-card expansion
- Playwright:
  - create character through the builder
  - edit existing character
  - preview save consequences
  - verify removed concepts do not appear

## Legacy Cleanup

- delete `hooks/characterLogic/*` as new builder routes replace old ones
- delete builder-specific step-store behavior from the old global store
- remove any builder UI that still says `Species`, exposes global `Selections`, or centers on readiness dashboards

## Exit Criteria

- The builder is engine-backed and structurally focused.
- Removed builder concepts stay removed.
- The legacy character-builder runtime is no longer on the active route path.
