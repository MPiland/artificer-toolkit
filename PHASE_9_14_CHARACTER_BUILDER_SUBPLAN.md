# Phase 9.14 - Character Builder

## Status: Active - Builder Choice Flow Implemented

## Objective

Rebuild the character builder as an engine-backed structural editing surface. This tranche implements the locked `CC*` and `EC*` flows, keeps structural choices in the builder, stores incomplete work in a builder draft sidecar, and avoids the legacy character hook and step-store architecture on active routes.

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

## Architecture Decision

The Character Builder is intentionally not an authored-content node-driven form in 9.14. Authored domains use node maps because their field structure is mostly record authoring. Character building is a higher-order orchestration problem: race, class, subclass, background, feature grants, ability generation, HP, equipment, and readiness all interact.

The accepted pattern is a hybrid:

- Route loaders provide the first builder payload and sheet placeholder payload.
- `apps/apis` remains the only product-data boundary for `apps/web`.
- TanStack Form owns local builder values.
- Step components use TanStack `withForm`; no legacy global form store, no `useFormContext`, and no fake form prop casts.
- Frontend steps render focused UX for the builder, but do not own game-rule graph logic.
- Backend resolver output supplies options, disabled reasons, summaries, outstanding choices, readiness, and the recommended next section.
- Save Draft writes only the `character_builder_drafts` sidecar.
- Draft payloads store a strict active `character` snapshot plus draft-only `builderIntent` cache data so reversible creation intent is not lost. For example, rolled ability groups must survive switching to point buy and saving a draft, while finalize only commits the currently active ability method.
- Finalize validates readiness and writes normalized character rows transactionally, deleting the sidecar only after success.
- `/characters/:id` is a sheet placeholder until the character sheet gets a dedicated 9.15 craft/design pass.

## Transport Requirements

- `POST /characters/draft`
- `GET /characters/:id`
- `GET /characters/:id/builder-draft`
- `POST /characters/:id/builder-draft`
- `DELETE /characters/:id/builder-draft`
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
- Character Sheet is deferred to 9.15 and is represented by a lightweight placeholder route in this tranche.

## Implementation Tracks

1. Rebuild the characters index and builder route entry points on the new shell.
2. SSR the builder shell and initial draft or existing character payload.
3. Render the builder screens around backend-driven resolution state instead of legacy local derivation hooks.
4. Keep structural edits localized to the relevant screen and surface source-local choices where they are granted.
5. Implement the edit-save preview modal from backend preview data, not frontend guesswork.
6. Add `character_builder_drafts` sidecar persistence so incomplete work never writes fake normalized child rows.
7. Keep `/characters/:id` as a sheet placeholder with edit/resume actions until the sheet is designed.
8. Remove legacy builder hook composition and step-store behavior from the active route path.

## Remaining Builder Work

- Complete closeout validation and review hardening:
  - focused API/schema/web tests for PR feedback regressions
  - Storybook build and visual inspection for the builder step states
  - an impeccable audit/polish pass before marking 9.14 complete
- Keep source-local choices on their granting steps, not a global selections screen.
- Do not fake completion by writing placeholder IDs or bypassing backend readiness.

## Implemented Builder Choice Coverage

- Race, subrace, ancestry, and race-owned feature choices render from resolver view state.
- Class rows render resolver-approved class, subclass, specialization, feature choice, spell choice, and granted summary state.
- Background-owned feature choices render on the Background step.
- Class and background starting equipment decisions render on the Equipment step.
- Ability method draft intent preserves inactive method data in `builderIntent` while finalization only commits the active method.
- Review blockers render from backend readiness and keep finalize unavailable until the resolver marks the build ready.

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
  - draft payload normalization
  - list mapping for draft-only and active character rows
- Playwright:
  - create character through the builder
  - edit existing character
  - preview save consequences
  - verify removed concepts do not appear

## Legacy Cleanup

- keep `hooks/characterLogic/*` and old global step-store behavior off active routes as new builder routes replace old ones
- retire legacy character route/domain code after builder and sheet cutover
- remove any active builder UI that still says `Species`, exposes global `Selections`, or centers on readiness dashboards

## Exit Criteria

- The builder is engine-backed and structurally focused.
- Removed builder concepts stay removed.
- The legacy character-builder runtime is no longer on the active route path.
- Incomplete builder work saves to `character_builder_drafts`, not normalized character child tables.
- Inactive builder branches such as alternate ability-generation choices remain recoverable from the draft sidecar.
- Finalize keeps the active version unchanged until normalized commit succeeds.
- Character sheet mechanics remain deferred to 9.15.
