# Phase 7: API Transport Stabilization

## Objective

Reconnect the API transport to the stabilized domain, schema, db, server, and engine layers without reintroducing cross-layer coupling. Frontend work is deferred to the later frontend rewrite phase.

## API Strategy

- keep API thin over server/application services
- validate transport with shared schemas
- keep the surface compatible with future tRPC adoption

## Future Compatibility

- web and mobile should share transport/application semantics
- tRPC can later sit on top of the same server services
- no client should depend on Kysely directly

## Deliverables

- API reattachment plan
- stable contract notes for the later frontend rewrite
- transport and contract compatibility notes
