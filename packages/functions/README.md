# Functions package

`packages/functions` owns application services and orchestration. It is the leverage point between API procedures and domain/persistence modules.

## Owns and does not own

- Authored-content services own list/detail/draft/activate/duplicate orchestration for the eight root domains and coordinate validation, node normalization, compilation, projection persistence, and revision promotion.
- Node-runtime services resolve registered shared node maps, evaluate visibility/required state, execute trusted relationship plans, forward explicit group presentation, produce options, and normalize hidden or invalid values.
- Character services own Builder resolution/draft orchestration, chosen-grant choices, Sheet command orchestration, and adapters into the pure engine.
- Does not own HTTP routing, frontend state, schema definitions, SQL row layouts, or engine persistence. Those remain in `apps/apis`, `apps/web`, `packages/schema`, `packages/db`, and `packages/shared` respectively.

## Key flow

API procedure → authored-domain service → validate/normalize → compile/resolve → repository persistence and revision activation → authored/DTO result. The node-runtime path is map registry → relationship executor/database query → resolved steps/nodes/options → normalization response.

Character Builder loads a registry of authored/compiled content, derives grants and required choices, validates readiness, and supports draft/preview/commit. Sheet commands update play-state through the character event/repository path and return the updated Sheet projection. Builder is intentionally distinct from node-map authoring.

## Invariants

- Keep `apps/apis` thin: orchestration belongs here, while contracts belong in schema and pure rules belong in shared.
- Node-runtime table/column access is allow-listed; do not bypass the relationship executor with arbitrary identifiers.
- Pure engine calls receive an explicit snapshot, registry, and rules system; services load/adapt those inputs but the engine does not access the DB.

## Focused validation

Use the focused service tests under `src/services/*`, especially `nodeRuntime` and `character`. Run `yarn workspace @artificer-toolkit/functions typecheck` for local contract changes, and add `yarn turbo:typecheck:web` when an API-facing contract crosses into the frontend. Avoid full suites unless the orchestration change spans multiple domains.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Authoring Schema](../../docs/architecture/authoring-schema.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
- [Engine](../../docs/architecture/engine.md)
