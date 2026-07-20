# API workspace

`apps/apis` is the product-data boundary for the web application. It exposes the tRPC router, authenticates procedures, validates transport DTOs, and delegates to application services and repositories.

## Owns and does not own

- `src/trpc/handler.ts` adapts a request to tRPC; `dbContext.ts` creates the request-scoped database/auth context; `router.ts` defines procedures and output parsing.
- `src/routes` contains the character transport adapter; shared authored-domain and node-runtime orchestration lives in `packages/functions`.
- The router groups public application configuration, route IDs, systems, authored content, characters, and node-runtime operations under the exported `appRouter`.
- Does not own domain compilation, character resolution, node-map execution, or SQL persistence. Delegate those to `packages/functions`, `packages/shared`, and `packages/db`.

## Key flow

Request → tRPC handler → Supabase claims/context → authenticated procedure → Zod input parse → functions-owned use case → Zod output parse → response. Authored content procedures share list/detail/draft/activate/duplicate behavior while each domain supplies its schema, map ID, table, and service configuration.

## Invariants

- Product data enters and leaves `apps/web` through this seam; keep procedures thin.
- Do not recreate direct feature/grant/effect or root-domain REST write paths; nested records persist through their owning authored root.
- Procedures require a user and parse both input and output with `packages/schema` contracts.
- `application.featureFlags` is intentionally unauthenticated and exposes only browser-safe booleans parsed from server environment; it must never expose raw environment values or secrets.
- Master content permissions are enforced through the authenticated context; drafts are user-scoped.
- Character Builder preview/commit, draft persistence, Sheet commands, and node-runtime resolution are separate procedures with separate DTOs. Resolved group nodes always carry their shared node-map presentation metadata; the API does not choose UI presentation.

## Focused validation

Run `yarn workspace @artificer-toolkit/apis typecheck` for router changes and the focused tests under `apps/apis/src/trpc` or `apps/apis/src/routes`. Use a character or node-runtime route test when changing those seams.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Transport and tRPC](../../docs/architecture/transport.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
