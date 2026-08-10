# ADR 0001: Package boundaries and the product-data seam

- **Status:** decision
- **Date:** 2026-07-10
- **Scope:** monorepo package ownership and web-to-backend data access
- **Update when:** a package gains a new dependency direction, a product-data route bypasses `apps/apis`, or orchestration ownership moves
- **Verification:** workspace manifests; `apps/apis/src/trpc/router.ts`; `apps/apis/src/trpc/procedures.ts`; the owning `apps/apis/src/trpc/*Router.ts`; `apps/apis/src/trpc/dbContext.ts`

## Context

The repository contains shared domain contracts, persistence, application services, transport, and a web client. Without an explicit direction, frontend code can reach persistence details and transport handlers can accumulate domain behavior. This is especially risky while the character creator and authored-content platform are being rebuilt together.

## Decision

`apps/apis` is the only product-data boundary for `apps/web`. Web code calls API procedures and consumes API/schema contracts; it does not import Kysely, repositories, SQL, or application-service internals.

The intended dependency direction is:

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

## Consequences

New product-data features must have an API procedure (or an explicitly documented non-product-data path) before web usage. Reusable behavior belongs below the API seam, not in route handlers. A package dependency that points upward across this direction requires a new decision or a deliberate boundary change.

The current source has a database context helper in `apps/apis`; that helper establishes request-scoped DB/RLS context and does not make the API layer the owner of repository behavior.
