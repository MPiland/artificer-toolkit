# Character services

This module orchestrates the character Builder and Sheet workflows. It is the application-service seam between API procedures, repositories, shared authored/compiled models, and the pure engine.

## Owns and does not own

- `builderService.ts` loads a `CharacterBuilderRegistry` and orchestrates resolution. Eligibility, hit points, spell selection, starting equipment, reconciliation, presentation, and DTO view construction belong to their named sibling modules.
- `characterApplicationService.ts` owns authenticated Builder/Sheet use cases; `characterBuilderView.ts` maps resolved Builder state into API DTOs. Transport adapters only parse requests and bind user-scoped database context.
- `chosenGrantChoiceResolver.ts` derives required chosen-grant options and reconciles persisted selections with provenance and timing.
- `characterEngine.ts` adapts resolved Character state into a `CharacterBuildSnapshot`/registry and runs the pure engine.
- `sheetProjection.ts`, `sheetRestService.ts`, `sheetCommandReducer.ts`, and `sheetCommandValidation.ts` own Sheet reads, completed-rest policy, pure state transitions, and command policy respectively. `sheetService.ts` owns prospective persistence state plus transaction/idempotency orchestration.
- Does not own tRPC procedure definitions, database row layouts, node-map definitions, or the pure engine algorithm.

## Key flow

Builder request → load authored/compiled registry → resolve provenance, grants, choices, and validation → save draft or preview destructive changes → commit through repositories. Sheet read → project current character/typed state through the engine. Sheet command → validate and reduce pure state → persist typed changes and event atomically → return the authoritative projection.

Builder is intentionally distinct from node-map authoring: node maps structure authored content forms; Builder resolves a character's intent and progression.

## Invariants

- Provenance and acquisition timing are carried through grants, choices, and history; do not reduce them to bare IDs.
- Proficiency candidate eligibility is derived from effective fixed and chosen grants across all active sources. Do not add an authored eligibility flag or silently delete a stale conflicting selection; disable it with a reason and return a blocking validation.
- Selected-class proficiency groups are presentation projections. They combine granted catalog labels and player-facing choice instructions with top-level choice IDs, while feature-owned choices stay with their feature; they are never written into canonical character intent.
- Multiclass requirement evaluation is a shared pure rule used by both server validation and Builder class-option eligibility. A first class is unrestricted; a multiclass proposal requires complete abilities and every proposed class to pass its own requirement groups.
- Builder references carry canonical option labels and numeric metadata for abilities, advancement, ability generation, hit-point methods, Standard Array, and Point Buy. Web and future native clients may add contextual presentation, but must not duplicate those registries or costs.
- Builder references and step views are presentation projections: background descriptions/details, ancestry feature previews, and feature detail rows are read from authored records without changing character intent. Redundant proficiency and spell choices remain visible with their granting source so the resolver stays authoritative.
- Starting-equipment choice labels are server-generated from authored selection filters plus canonical equipment category/property metadata. Clients render those labels and candidate records without duplicating equipment vocabulary.
- Starting-gold intent stores the class dice formula as text alongside the player-entered total; the formula is not an authored equipment-option reference.
- Selected-class grant summaries are normalized on the server by availability level, authored presentation order, and stable kind/ID. Background references are compact derived projections; clients must not re-sort or persist them.
- Preview is separate from commit and must surface destructive removals/status downgrades before persistence.
- Engine input is ephemeral; services assemble it from current persisted state and never persist the snapshot itself.
- Sheet commands mutate play-state through the event/repository path and return a refreshed, engine-derived Sheet.
- Typed resource usage is persisted through its typed repository path; the pure command reducer validates resource operations without copying usage into `CharacterAuthored.state.resources`.
- Campaign-owner projection preserves authoritative mechanics while removing Character-owner-private custom names, notes, spell customizations, and labels derived from them. The GM command allowlist cannot mutate those fields or reset the private Character maximum-hit-point adjustment during rest.

## Focused validation

Run the focused owner tests: `builderEligibility.test.ts`, `builderHitPoints.test.ts`, `builderSpellSelection.test.ts`, `builderStartingEquipment.test.ts`, `builderPresentation.test.ts`, `characterBuilderView.test.ts`, the `sheet*.test.ts` files, and the related API character contract/route tests. Use shared engine tests when changing snapshot assembly or engine resolution.

## Canonical references

- [Character Builder and Sheet](../../../../../docs/architecture/character.md)
- [Data lifecycle](../../../../../docs/architecture/data-lifecycle.md)
- [Engine](../../../../../docs/architecture/engine.md)
- [Persistence and Kysely](../../../../../docs/architecture/persistence.md)
