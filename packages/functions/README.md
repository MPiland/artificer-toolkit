# Functions package

`packages/functions` owns application services and orchestration. It is the leverage point between API procedures and domain/persistence modules.

## Owns and does not own

- Authored-content services own list/detail/draft/activate/duplicate orchestration for the eight root domains and coordinate validation, node normalization, compilation, projection persistence, and revision promotion.
- Node-runtime services resolve registered shared node maps, evaluate visibility/required state, execute trusted relationship plans, forward explicit group presentation, produce options, and normalize hidden or invalid values.
- Character services own Builder resolution/draft orchestration, chosen-grant choices, Sheet projection, rest policy, command validation/reduction/persistence, and adapters into the pure engine.
- Campaign services own lifecycle/authority, content, inventory, chat and rolls, notebooks, and Sessions. Chat, notebook, and Session modules are direct owners rather than one collaboration facade.
- Encounter services own template/run orchestration, actor state, projections, and actor-filtered timelines.
- Does not own HTTP routing, frontend state, schema definitions, SQL row layouts, or engine persistence. Those remain in `apps/apis`, `apps/web`, `packages/schema`, `packages/db`, and `packages/shared` respectively.

## Key flow

API procedure → application service → validate/resolve → repository transaction → schema DTO result. The node-runtime path is map registry → relationship executor/database query → resolved steps/nodes/options → normalization response.

Character Builder loads a registry of authored/compiled content, derives grants and required choices, validates readiness, and supports draft/preview/commit. `builderService` retains loading and resolution orchestration; eligibility, hit points, spell selection, starting equipment, reconciliation, presentation, and DTO view construction live in their named sibling modules. Sheet reads, engine adaptation, rest policy, pure command reduction, command validation, and transactional persistence likewise live in their named modules. Builder is intentionally distinct from node-map authoring.

## Invariants

- Keep `apps/apis` thin: orchestration belongs here, while contracts belong in schema and pure rules belong in shared.
- Node-runtime table/column access is allow-listed; do not bypass the relationship executor with arbitrary identifiers.
- Parse node-runtime and portable authored inputs at the functions boundary even when a caller bypasses the API adapter. Persist only schema-valid normalized authored payloads.
- Pure engine calls receive an explicit snapshot, registry, and rules system; services load/adapt those inputs but the engine does not access the DB.
- Campaign and Encounter authority is resolved before repository access. Visibility filters that affect pagination belong in repository queries before cursor/order/limit.

## Focused validation

Use the focused service tests under `src/services/*`, especially `nodeRuntime` and `character`. Run `yarn turbo run typecheck --filter=@artificer-toolkit/functions` for local contract changes, and add `yarn turbo:typecheck:web` when an API-facing contract crosses into the frontend. Avoid full suites unless the orchestration change spans multiple domains.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Authoring Schema](../../docs/architecture/authoring-schema.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
- [Engine](../../docs/architecture/engine.md)
