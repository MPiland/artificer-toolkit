# Schema package

`packages/schema` defines the Zod-backed contracts shared by transport callers and servers. It is the boundary for API DTOs, authored subject inputs, feature/grant/effect shapes, shared value contracts, vocabulary, and node-runtime request/response models.

## Owns and does not own

- `src/api` contains app-facing request/response contracts for content, characters, node runtime, route IDs, and systems. The node-runtime response validates explicit platform-neutral presentation on every group node, including array-only `focused` editing.
- `src/subjects`, `src/features`, `src/grants`, `src/effects`, `src/shared`, and `src/vocabulary` hold reusable domain contracts and parsing helpers.
- Package exports provide narrow subpaths such as `@artificer-toolkit/schema/api/characters` and `.../subjects/class`.
- Does not own database rows, orchestration, React form state, or engine resolution. It describes interfaces between those modules.

## Key flow

API and web adapters parse at their seam, then pass typed values to `packages/functions` or render DTOs. The API router parses procedure inputs and outputs; `apps/web/src/lib/api.ts` parses responses again before query/mutation adapters expose them to routes.

## Invariants

- Prefer a shared schema over an ad-hoc local shape.
- Keep authored input contracts distinct from API response DTOs and from compiled/engine data.
- Keep presentation metadata in the node-runtime contract; do not add web-local copies of the presentation vocabulary.
- Keep the eight authored root DTOs exact across shared models, node maps, persistence hydration, and API transport; nested content remains part of its owning root payload.
- Character intent, Builder draft/preview/commit, and Sheet command contracts are explicit and should not be collapsed into generic content-authoring DTOs.

## Focused validation

Use `yarn workspace @artificer-toolkit/schema test` for parsing/contract changes and `yarn workspace @artificer-toolkit/schema typecheck` for type changes. Add or update the nearest contract test when a DTO changes.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Transport and tRPC](../../docs/architecture/transport.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
