# Shared package

`packages/shared` is the domain vocabulary and pure-logic layer. It supplies stable core constants/types, authored models, compilers, node-map definitions, and reusable character state contracts.

## Owns and does not own

- `domains/*/core` defines shared codes and core domain types; `authored` models authoring-shaped records; `compilers` turns authored records into runtime-ready forms; `maps` defines the node-map DSL and map trees.
- `domains/character/ruleSnapshot.ts`, `ruleRegistry.ts`, and `ruleFacts.ts` retain the mechanics-neutral Character state and fact contracts consumed at package boundaries. The superseded `domains/engine` implementation has been removed; installed game-system mechanics execute through `packages/rules-runtime`.
- Vocabulary is authored reference data (for example skills, speeds, damage types, and currencies), not a substitute for engine calculations.
- Does not own persistence, transport, request authentication, React state, or application orchestration.

## Key flow

Vocabulary and authored DTOs are validated at native boundaries and compiled into normalized runtime
forms. `packages/authoring` resolves node maps, `packages/rules-runtime` assembles and evaluates
installed System facts, `apps/apis/convex` owns authorized orchestration, and `apps/web` owns rendering.

Character Builder is intentionally distinct from node-map authoring. Builder intent/state and provenance are domain models; node maps provide reusable authored-content structure, option relationships, and explicit group presentation consumed by the authoring runtime.

## Invariants

- Pure shared logic must not load from the database or mutate application state.
- Preserve the distinction between vocabulary, authored, compiled, persisted, normalized rule-fact, and evaluated result shapes.
- Treat Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle as authored roots; features/options/grants/effects are nested aggregate parts.
- Every Authoring Schema group declares presentation explicitly. Object groups support inline or branch editing; array groups additionally support table, summary, branch, and focused behavior. Keep direct staged-leaf child groups inline/table so platform adapters never stack focused editors.
- Resolve an installed System capability from exact System identity and fail closed for unsupported identities; system-specific policies live under `packages/rules-runtime`.
- Prefer focused package exports (`@artificer-toolkit/shared/core`, `/authored`, `/compilers`, and `/maps`) over new root-barrel coupling.

## Focused validation

`@artificer-toolkit/shared/social/rateLimits` owns the fixed-hour/day Social allowances. Native Convex
domain functions consume the pure policy and own authorization, timestamps, persistence and rollback.

`@artificer-toolkit/shared/account/ageAttestation` owns the pure UTC 18+ birthday check used by
Social viewing preferences. It stores nothing and does not perform identity or age verification;
the native owner stores only a successful self-attestation timestamp.

`@artificer-toolkit/shared/canonicalJson` owns persistence JSON normalization and the SHA-256
protocol. Undefined object entries are omitted and undefined array entries become null. This is
distinct from the strict JSON-only rules document codec under `/rules`; do not substitute one
checksum protocol for the other. Its compatibility test uses independent Web Crypto.

Use `yarn workspace @artificer-toolkit/shared test` for maps, compilers, and character-domain behavior;
use `yarn workspace @artificer-toolkit/shared typecheck` for contract changes. Installed System
validation and execution are implemented in `packages/rules-runtime` and tested through the Convex
domain tests in `apps/apis`.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Authoring Schema](../../docs/architecture/authoring-schema.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
- [Rules Runtime](../../docs/architecture/rules-runtime.md) (the former [Engine](../../docs/architecture/engine.md) guide is historical)
