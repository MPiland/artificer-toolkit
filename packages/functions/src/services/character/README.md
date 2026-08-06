# Character services

This module orchestrates the character Builder and Sheet workflows. It is the application-service seam between API procedures, repositories, shared authored/compiled models, and the pure engine.

## Owns and does not own

- `builderService.ts` loads a `CharacterBuilderRegistry`, resolves intent into summaries/grants/choices, validates readiness, and supports draft/preview/commit decisions.
- `characterApplicationService.ts` owns the authenticated Builder/Sheet use cases and maps resolved domain state into API DTOs; transport adapters only parse requests and bind user-scoped database context.
- `chosenGrantChoiceResolver.ts` derives required chosen-grant options and reconciles persisted selections with provenance and timing.
- `sheetService.ts` loads the character, compiles the required records, builds a `CharacterBuildSnapshot`/registry, runs the engine, formats Sheet DTOs, and dispatches play-state commands/events.
- Does not own tRPC procedure definitions, database row layouts, node-map definitions, or the pure engine algorithm.

## Key flow

Builder request → load authored/compiled registry → resolve provenance, grants, choices, and validation → save draft or preview destructive changes → commit through repositories. Sheet read/command → load current character/events → assemble snapshot and registry → `runEngine` with the active rules system → format overview/resources/provenance and persist command state when needed.

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

## Focused validation

Run `builderService.test.ts`, `characterApplicationService.test.ts`, `sheetService.test.ts`, `sheetService.execute.test.ts`, and the related API character contract/route tests. Use shared engine tests when changing snapshot assembly or engine resolution.

## Canonical references

- [Character Builder and Sheet](../../../../../docs/architecture/character.md)
- [Data lifecycle](../../../../../docs/architecture/data-lifecycle.md)
- [Engine](../../../../../docs/architecture/engine.md)
- [Persistence and Kysely](../../../../../docs/architecture/persistence.md)
