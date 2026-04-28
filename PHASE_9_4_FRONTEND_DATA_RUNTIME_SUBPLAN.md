# Phase 9.4 - Frontend Data Runtime

## Status: Complete

## Objective

Make `apps/apis` the only product-data boundary and define the shared frontend data runtime used by every route. This tranche turns the current REST adapter idea into the canonical transport layer, wires TanStack Query and SSR hydration around it, and adds explicit provenance and editability contracts so the UI never guesses based on `userId === 'master'`.

## Inputs

- [PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md](PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md)
- `apps/web/src/lib/api.ts`
- `apps/apis/src/routes/*`
- `apps/apis/src/trpc.*`
- `packages/schema/src/api/*`
- DB `is_master` fields and current list queries

## Locked Decisions

- REST is the Phase 9 baseline.
- tRPC stays behind the same frontend adapter and only replaces low-risk reads after parity.
- No product route in `apps/web` may call `@artificer-toolkit/db` or `@artificer-toolkit/functions` directly.
- Master-data copy is implemented as:
  - fetch detail
  - clone into a new draft
  - save as owned content

## Required Contract Changes

Add explicit frontend-facing provenance and permissions to authored content DTOs.

### List item and detail contract additions

- `provenance.kind`: `MASTER` or `OWNED`
- `provenance.ownerUserId`: `string | null`
- `permissions.canEdit`: `boolean`
- `permissions.canCopy`: `boolean`
- `permissions.canView`: `boolean`
- `permissions.canDelete`: `boolean`

These fields should appear on both list items and full authored-resource responses so the UI can render locked-master behavior consistently in lists, detail screens, and forms.

## Landed Decisions

- Authored content list DTOs keep legacy `userId` / `systemId` during migration, but active UI must use `provenance` and `permissions`.
- Authored content detail and upsert responses are normalized to `{ item, provenance, permissions } | null`.
- `apps/apis` overwrites authored `userId` from authenticated request context before save; `apps/web` does not control ownership.
- `/spells` is the representative 9.4 route proving REST-backed list data. Storybook fixtures remain separate from route data.
- Real delete is not exposed through the 9.4 web route until a safe backend delete service is available.
- Legacy `apps/web/src/server/domains/*`, old `src/domains/*`, and old character hooks remain quarantined retirement targets; active Phase 9 routes must not import from them.
- Supabase SSR session cookies are allowed for `apps/web` request/session continuity, while `apps/web` to `apps/apis` product-data calls use `Authorization: Bearer <access_token>`.
- Before production launch, verify Supabase SSR cookie behavior explicitly:
  - HTTPS-only `Secure` behavior in deployed environments
  - `HttpOnly` protection for any refresh/session token material where supported by the Supabase SSR flow
  - appropriate `SameSite` posture for the app's auth routes
  - no long-lived token storage in `localStorage` or JavaScript-readable ad hoc cookies
  - local development exceptions are not treated as production security posture

## Scope

- Shared REST client and domain adapters in `apps/web`
- Query-key conventions
- SSR loader/query hydration conventions
- Authenticated request header handling
- Provenance/editability DTO normalization
- Removal of web-side product mutations via `useServerFn`
- Adapter seam for later tRPC adoption

## Deliverables

- A single web transport layer for:
  - content CRUD
  - character builder flows
  - character sheet reads
  - character commands
  - systems and reference data
- Query conventions for list, detail, edit, and copy flows.
- SSR integration rules for route loaders and first-query hydration.
- Normalized DTOs exposing provenance and permissions.

## Implementation Plan

1. Refactor `apps/web/src/lib/api.ts` into the canonical shared transport adapter instead of one transitional utility.
2. Normalize REST routes and schema DTOs so list and detail responses expose provenance and editability explicitly.
3. Define one query-key and invalidation model for list, detail, create, edit, and copy flows.
4. Define SSR loader/query handoff rules so routes do not duplicate fetch logic.
5. Remove product-data `useServerFn` usage and replace it with transport-backed mutations.
6. Keep a matching adapter interface for future tRPC migration, but leave REST as the active implementation.

## Final Validation Notes

- `build:schema`, `build:db`, `build:functions`, and `build:apis` pass with the 9.4 transport and DTO changes.
- `test:schema` passes. The in-sandbox run hit the known local Corepack `EPERM`, then passed through the approved Yarn command path.
- `apps/web` unit tests pass, including the REST adapter, spell list mapper, and product-data boundary guard.
- App Playwright smoke passes without the TanStack Start server import-protection warning.
- Storybook build and Storybook Playwright smoke pass. Storybook still reports non-blocking chunk-size/plugin-timing warnings.
- `build:web` remains constrained by pre-existing legacy `src/utils` alias/type failures outside the 9.4 runtime. No 9.4 files were implicated.

## Review Gate

- No rebuilt route calls product data outside `apps/apis`.
- Provenance and permissions are explicit in the transport contracts.
- Copying a locked master record can be demonstrated end-to-end.
- SSR auth/session handling uses Supabase-supported cookie plumbing only, and API transport remains header-based.
- Playwright verifies:
  - list fetch
  - detail fetch
  - copy locked master
  - save owned draft

## Exit Criteria

- The frontend has one real data-runtime boundary.
- All later subplans can depend on stable transport, query, and SSR rules.
- Locked master-data behavior is standardized before domain forms ship.
- Phase 9.5 is the next active tranche for shared form runtime and node-map sections.
