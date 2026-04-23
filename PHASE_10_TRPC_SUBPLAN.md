# Phase 10 — tRPC Transport Modernization (Hybrid Incremental)

## Status: Paused (scaffold landed, active work deferred to Phase 9)

## Summary

Phase 9 modernizes transport by introducing tRPC in `apps/apis` without breaking current REST behavior.

The rule for this phase is hybrid operation:

- tRPC and REST run in parallel
- Phase 8 frontend work can adopt tRPC where available
- REST remains fallback until parity is proven

This phase is transport-only. Domain models, DB contracts, and engine behavior are not rewritten here.

## Landed So Far

The initial scaffold pass is complete in `apps/apis`:

- tRPC dependency added (`@trpc/server`)
- typed tRPC app router added with:
  - `characters.*` namespace
  - `content.*` namespace
- tRPC context wiring added (JWT -> user context)
- tRPC fetch handler export added
- package root exports now include the tRPC surface

Landed files:

- `apps/apis/src/trpc.router.ts`
- `apps/apis/src/trpc.context.ts`
- `apps/apis/src/trpc.handler.ts`
- `apps/apis/src/trpc.index.ts`
- `apps/apis/src/index.ts`
- `apps/apis/package.json`

## Pause Decision

Phase 9 implementation is intentionally paused here so the team can focus on Phase 8 frontend delivery.

- Keep REST as the primary active transport during Phase 8.
- Keep tRPC scaffold in place as optional follow-on integration work.
- Resume Phase 9 only when Phase 8 vertical slices are stable enough for transport migration parity work.

## Architecture Decision

- Keep `apps/apis` as the transport package and add a parallel tRPC router.
- Reuse existing services/repositories/queries from `packages/functions` and `packages/db`.
- Reuse existing schema contracts from `packages/schema` for procedure inputs.
- Keep REST endpoints stable until explicit deprecation gate is met.

## Procedure Surface

The canonical tRPC namespaces for this phase are:

- `characters.*`
  - `list`
  - `create`
  - `get`
  - `history`
  - `command`
- `content.*`
  - `classes.{list,get,upsert}`
  - `races.{list,get,upsert}`
  - `spells.{list,get,upsert}`
  - `feats.{list,get,upsert}`
  - `equipment.{list,get,upsert}`
  - `backgrounds.{list,get,upsert}`
  - `creatures.{list,get,upsert}`
  - `vehicles.{list,get,upsert}`
  - `features.{list,get,upsert}`
  - `featGrants.{get,upsert}`
  - `systems.{list,get}`

## Migration Order

1. Character read endpoints (`list`, `get`, `history`) via tRPC.
2. Character command dispatch via tRPC mutation.
3. Content authoring routes via tRPC procedures.
4. REST deprecation only after parity checks pass.

## Test and Parity Gates

- Procedure parity:
  - tRPC result behavior must match REST semantics for migrated endpoints.
- Validation parity:
  - input validation uses the same schema-layer contracts.
  - Zod issues are exposed through tRPC error formatting.
- Concurrency parity:
  - `characters.command` preserves optimistic concurrency behavior.
- Regression gate:
  - existing REST route tests stay green during hybrid period.

## Exit Criteria

- Character read + command flows are consumed successfully through tRPC in the Phase 8 app path.
- Core content authoring flows are available through `content.*` procedures.
- No transport regressions versus current REST behavior on migrated endpoints.
- REST deprecation plan is documented with endpoint-by-endpoint cutover status.

## Assumptions and Defaults

- Hybrid operation is intentional and temporary.
- tRPC replaces transport wiring, not domain logic.
- REST removal is a final Phase 9 closure slice, not an entry condition.
