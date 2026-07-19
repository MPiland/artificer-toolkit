# Shared package

`packages/shared` is the domain vocabulary and pure-logic layer. It supplies stable core constants/types, authored models, compilers, node-map definitions, character assembly/engine contracts, and deterministic resolution functions.

## Owns and does not own

- `domains/*/core` defines shared codes and core domain types; `authored` models authoring-shaped records; `compilers` turns authored records into runtime-ready forms; `maps` defines the node-map DSL and map trees.
- `domains/engine` contains `CharacterBuildSnapshot`, `CharacterAssemblyRegistry`, `RulesSystem`, `runEngine`, and pure resolution helpers.
- Vocabulary is authored reference data (for example skills, speeds, damage types, and currencies), not a substitute for engine calculations.
- Does not own SQL, HTTP/tRPC, request auth, React state, or application orchestration.

## Key flow

Vocabulary and authored DTOs are validated at the boundaries, compiled into normalized runtime forms, assembled into character snapshots/registries, then consumed by pure engine functions. Node maps are definitions; backend runtime resolution lives in `packages/functions`, while frontend rendering lives in `apps/web`.

Character Builder is intentionally distinct from node-map authoring. Builder intent/state and provenance are domain models; node maps provide reusable authored-content structure, option relationships, and explicit group presentation consumed by the authoring runtime.

## Invariants

- Pure shared logic must not load from the database or mutate application state.
- `runEngine(snapshot, registry, rules)` is deterministic; the caller supplies compiled records and the system-specific `RulesSystem`.
- Preserve the distinction between vocabulary, authored, compiled, persisted, and engine shapes.
- Treat Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle as authored roots; features/options/grants/effects are nested aggregate parts.
- Every Authoring Schema group declares presentation explicitly. Object groups support inline or branch editing; array groups additionally support table, summary, branch, and focused behavior. Keep direct staged-leaf child groups inline/table so platform adapters never stack focused editors.
- Resolve the compatible D&D-5e-family rules policy from explicit ruleset code/version and fail closed for unsupported identities; route materially different games to system-specific engine contracts.
- Prefer focused package exports (`@artificer-toolkit/shared/core`, `/authored`, `/compilers`, `/maps`, `/engine/resolution`) over new root-barrel coupling.

## Focused validation

Use `yarn workspace @artificer-toolkit/shared test` for maps, compilers, character, and engine behavior; use `yarn workspace @artificer-toolkit/shared typecheck` for contract changes. For rule-order changes, read the system-specific rule-order document alongside tests.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Authoring Schema](../../docs/architecture/authoring-schema.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
- [Engine](../../docs/architecture/engine.md)
