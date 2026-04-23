# Phase 10 - tRPC Transport Modernization (Hybrid Incremental)

## Status: Partially Landed / Deferred Behind Phase 9 REST Baseline

## Summary

Phase 10 modernizes transport by adding tRPC to `apps/apis` without breaking the active REST contract. The scaffold is already present, but frontend adoption stays intentionally behind the Phase 9 execution sequence so the new frontend can first normalize around one stable REST adapter.

This phase remains transport-only:

- no domain-model rewrites
- no DB contract rewrites just to satisfy tRPC
- no bypass of `apps/apis`
- no replacement of the Phase 9 review gates

## Relationship to Phase 9

- Phase 9 establishes:
  - the public and authenticated shells
  - the shared frontend data adapter
  - explicit provenance and permissions contracts
  - the authored-form runtime
  - the rebuilt route families
- Phase 10 only swaps selected reads from REST to tRPC after the shared adapter exists and parity is proven.

## Landed So Far

The initial scaffold pass is complete in `apps/apis`:

- `apps/apis/src/trpc.router.ts`
- `apps/apis/src/trpc.context.ts`
- `apps/apis/src/trpc.handler.ts`
- `apps/apis/src/trpc.index.ts`
- package exports for the tRPC surface

## Locked Decisions

- REST remains the Phase 9 baseline.
- tRPC and REST run in parallel during the transition.
- `apps/web` consumes tRPC only through the same frontend adapter boundary used by REST.
- Builder write flows stay on REST until parity is proven.
- Character sheet reads can migrate earlier than builder writes.

## Procedure Surface

The canonical procedure namespaces remain:

- `characters.*`
  - `list`
  - `get`
  - `sheet`
  - `history`
  - `command`
- `content.*`
  - `backgrounds.{list,get,upsert}`
  - `classes.{list,get,upsert}`
  - `equipment.{list,get,upsert}`
  - `feats.{list,get,upsert}`
  - `races.{list,get,upsert}`
  - `spells.{list,get,upsert}`
  - `creatures.{list,get,upsert}`
  - `vehicles.{list,get,upsert}`
  - `features.{list,get,upsert}`
  - `featGrants.{get,upsert}`
  - `systems.{list,get}`

## Adoption Order

1. Systems reads
2. Content list reads
3. Content detail reads
4. Character list and history
5. Character sheet reads
6. Remaining low-risk read surfaces
7. Write surfaces only after explicit parity review

## Entry Conditions for Any tRPC Cutover

Do not switch a surface from REST to tRPC until all of the following are true:

- the REST and tRPC responses match the same schema-backed DTO shape
- the shared frontend adapter can swap implementations without route-level changes
- Storybook and Playwright coverage already exist for the affected surface
- route behavior has been compared side-by-side against REST

## Explicit Hold Line

Keep these on REST until later:

- character builder draft
- character builder resolve
- character builder preview-save
- character builder upsert

These flows depend on the engine-backed builder semantics and should not be migrated until the tRPC surface is genuinely equivalent.

## Exit Criteria

- tRPC is additive, verified, and never the cause of a frontend domain rewrite.
- The frontend transport layer can mix REST and tRPC behind one adapter.
- REST deprecation is considered only after endpoint-by-endpoint parity has been demonstrated.
