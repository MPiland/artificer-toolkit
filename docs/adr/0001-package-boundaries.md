# ADR 0001: Package boundaries and the product-data seam

- **Status:** decision — product-data isolation retained; SQL/Kysely/tRPC package topology superseded by [ADR 0029](0029-convex-backend-cutover.md)
- **Date:** 2026-07-10
- **Scope:** monorepo package ownership and web-to-backend data access
- **Update when:** a package gains a new dependency direction, a product-data route bypasses `apps/apis`, or orchestration ownership moves
- **Verification:** workspace manifests; `apps/apis/convex`; shared schema and domain packages; [ADR 0029](0029-convex-backend-cutover.md)

## Context

The repository contains shared domain contracts, persistence, application services, transport, and a web client. Without an explicit direction, frontend code can reach persistence details and transport handlers can accumulate domain behavior. This is especially risky while the character creator and authored-content platform are being rebuilt together.

## Retained decision

`apps/apis` remains the only product-data boundary for `apps/web`. Web code calls typed Convex product functions and consumes shared contracts; it does not import persistence or application-service internals.

## Historical implementation topology

Before the Convex cutover, that boundary used the following SQL/Kysely, service-package, and tRPC topology. [ADR 0029](0029-convex-backend-cutover.md) supersedes this topology while retaining the dependency-isolation rule above.

The intended dependency direction was:

```text
packages/schema  +  packages/shared
        ↓                 ↓
      packages/db  →  packages/functions
                              ↓
                         apps/apis
                              ↓
                          apps/web
```

- `packages/shared` owns domain types, authored/compiled models, node-map definitions, compilers, and pure engine logic. It does not depend on `apps/apis` or `apps/web`.
- `packages/schema` owns reusable validation and transport contracts and remains independent of application orchestration.
- `packages/db` owns database clients, repositories, row mapping, and persistence operations.
- `packages/functions` owns application services and orchestration. It composes shared logic and repositories without becoming a transport layer.
- `apps/apis` owns authentication/context binding, tRPC procedure shape, DTO validation at the boundary, error mapping, and API-to-service wiring. It stays thin.
- `apps/web` owns user-facing flows and rendering and reaches product data through `apps/apis`.

## Current consequences

New product-data features must expose a typed Convex product function through `apps/apis` before web usage. Reusable behavior belongs below the web adapter seam. A package dependency that bypasses this direction requires a new decision or a deliberate boundary change.

The former request-scoped database context helper and RLS topology are historical implementation details superseded by ADR 0029.
