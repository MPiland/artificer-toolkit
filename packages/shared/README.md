# Shared package

`packages/shared` is the domain vocabulary and pure-logic layer. It supplies stable core constants/types, authored models, compilers, node-map definitions, and reusable character state contracts.

## Owns and does not own

- `domains/*/core` defines shared codes and core domain types; `authored` models authoring-shaped records; `compilers` turns authored records into runtime-ready forms; `maps` defines the node-map DSL and map trees.
- `domains/character/ruleSnapshot.ts`, `ruleRegistry.ts`, and `ruleFacts.ts` retain the mechanics-neutral Character state and fact contracts consumed at package boundaries. The superseded `domains/engine` implementation has been removed; game-system mechanics execute through the versioned Zen models in `packages/functions`.
- Vocabulary is authored reference data (for example skills, speeds, damage types, and currencies), not a substitute for engine calculations.
- Does not own SQL, HTTP/tRPC, request auth, React state, or application orchestration.

## Key flow

Vocabulary and authored DTOs are validated at the boundaries, compiled into normalized runtime forms, and assembled into rule facts by `packages/functions`. Versioned rule-pack models are evaluated by the embedded Zen runtime there. Node maps are definitions; backend runtime resolution lives in `packages/functions`, while frontend rendering lives in `apps/web`.

Character Builder is intentionally distinct from node-map authoring. Builder intent/state and provenance are domain models; node maps provide reusable authored-content structure, option relationships, and explicit group presentation consumed by the authoring runtime.

## Invariants

- Pure shared logic must not load from the database or mutate application state.
- Preserve the distinction between vocabulary, authored, compiled, persisted, normalized rule-fact, and evaluated result shapes.
- Treat Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle as authored roots; features/options/grants/effects are nested aggregate parts.
- Every Authoring Schema group declares presentation explicitly. Object groups support inline or branch editing; array groups additionally support table, summary, branch, and focused behavior. Keep direct staged-leaf child groups inline/table so platform adapters never stack focused editors.
- Resolve a compatible pinned rule-pack revision from explicit ruleset code/version and fail closed for unsupported identities; system-specific rule models live under `packages/functions/src/services/rules/systems/`.
- Prefer focused package exports (`@artificer-toolkit/shared/core`, `/authored`, `/compilers`, and `/maps`) over new root-barrel coupling.

## Focused validation

Use `yarn workspace @artificer-toolkit/shared test` for maps, compilers, and character-domain behavior; use `yarn workspace @artificer-toolkit/shared typecheck` for contract changes. Rule-model validation and system-specific parity tests live in `packages/functions`.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Authoring Schema](../../docs/architecture/authoring-schema.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
- [Engine](../../docs/architecture/engine.md)
