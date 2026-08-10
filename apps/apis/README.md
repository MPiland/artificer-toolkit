# API workspace

`apps/apis` is the product-data boundary for the web application. It exposes the tRPC router, authenticates procedures, validates transport DTOs, and delegates to application services and repositories.

## Owns and does not own

- `src/trpc/handler.ts` adapts a request to tRPC; `dbContext.ts` creates the request-scoped database/auth context; `procedures.ts` owns the shared tRPC setup and middleware; domain router modules own procedure wiring; `router.ts` only composes them.
- `src/routes` contains the authenticated import/export REST boundary. Character product data uses tRPC; shared authored-domain and node-runtime orchestration lives in `packages/functions`.
- The composed router groups public application configuration, route IDs, systems, authored content, characters, Campaigns, Encounters, rolls, media, and node-runtime operations under the exported `appRouter`.
- Does not own domain compilation, character resolution, node-map execution, or SQL persistence. Delegate those to `packages/functions`, `packages/shared`, and `packages/db`.

## Key flow

Request → tRPC handler → Supabase claims/context → authenticated procedure → Zod input parse → functions-owned use case → declared tRPC output parse → response. Authored content procedures share list/detail/draft/activate/duplicate behavior while each domain supplies its schema, map ID, table, and service configuration.

## Invariants

- Product data enters and leaves `apps/web` through this seam; keep procedures thin.
- Do not recreate direct feature/grant/effect or root-domain REST write paths; nested records persist through their owning authored root.
- Procedures require a user and parse both input and output with `packages/schema` contracts.
- Unexpected failures return a generic internal error. Provider, database, configuration, credential, and token details must not cross this boundary.
- Import preview and commit are the only product-data REST exception; they retain same-origin authentication and shared byte, entry, fanout, depth, and node limits.
- `application.featureFlags` is intentionally unauthenticated and exposes only browser-safe booleans parsed from server environment; it must never expose raw environment values or secrets.
- Master content permissions are enforced through the authenticated context; drafts are user-scoped.
- Character Builder preview/commit, draft persistence, Sheet commands, and node-runtime resolution are separate procedures with separate DTOs. Resolved group nodes always carry their shared node-map presentation metadata; the API does not choose UI presentation.

## Focused validation

Run `yarn turbo run typecheck --filter=@artificer-toolkit/apis` for router changes and the focused owning tests under `apps/apis/src/trpc` or `apps/apis/src/routes`. Use the character, node-runtime, or import/export tests when changing those seams.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Transport and tRPC](../../docs/architecture/transport.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
