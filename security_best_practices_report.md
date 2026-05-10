# Security Best Practices Report

Last updated: 2026-05-08

## Summary

The app is now hardened around the tRPC-first, cookie-authenticated design. The important shift is that browser-visible product-data calls no longer need or receive Supabase bearer material. The web server validates the Supabase SSR cookie, extracts `userId`, and calls `apps/apis` through same-origin `/api/trpc`.

## Implemented Controls

- App-owned HTTP headers in `apps/web/src/server/securityHeaders.ts`:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` denying unused browser capabilities
  - `X-Frame-Options: DENY`
  - Enforced CSP for `frame-ancestors`, `object-src`, `base-uri`, and `form-action`
  - Report-only CSP for script/style/connect hardening
- CSRF protections:
  - `/api/trpc` requires the `x-artificer-trpc: 1` same-origin marker on state-changing requests.
  - tRPC and auth server functions reject mismatched `Origin`, mismatched `Referer`, and `Sec-Fetch-Site: cross-site`.
  - Auth forms keep `method='post'`.
- Token non-exposure:
  - `apps/web/src/server/trpc.ts` no longer calls `getSession()` or passes access tokens.
  - `apps/apis/src/trpc/dbContext.ts` accepts only `userId` and scopes DB work with `withUserContext`.
  - tRPC procedures call repositories and application services directly instead of synthesizing `Authorization` headers or proxying through route handlers.
  - `packages/functions/src/utils/requestUser.ts` keeps bearer validation only for legacy REST-style route wrappers.
- XSS hardening:
  - Authored rich text now renders through `apps/web/src/ui/primitives/renderSanitizedRichHtml.tsx`.
  - Executable tags, forms, frames, event handlers, inline styles, `srcdoc`, and unsafe URL protocols are stripped.
  - Static SVG icons render JSX children instead of `dangerouslySetInnerHTML`.
- SQL-injection posture:
  - Active runtime code continues to use Kysely/query builders and schema DTOs.
  - Static security tests reject `sql.raw(` in active API/functions/db runtime code.
  - Request-derived values should remain schema-validated before reaching repositories.
- Tenant isolation:
  - tRPC procedures require authenticated server context.
  - Route wrappers run DB work under `withUserContext(db, userId, ...)`.
  - Existing authoring tests reject foreign/master direct writes and character sheet commands for foreign characters.
  - Campaign sharing is documented as a future ACL boundary.

## Added Or Updated Tests

- `apps/web/src/server/securityHeaders.test.ts`
- `apps/web/src/lib/trpcRequestSecurity.test.ts`
- `apps/web/src/ui/primitives/renderSanitizedRichHtml.test.tsx`
- `apps/web/src/lib/securityStatic.test.ts`
- `apps/apis/src/trpc/router.test.ts`

Existing relevant tests still cover router context token non-serialization, tRPC adapter no-token requests, authored ownership checks, vehicle/class authoring ownership, and character sheet command ownership.

## Deployment Checklist

- Use HTTPS for every public environment.
- Add HSTS only after production domain ownership and HTTPS behavior are final.
- Configure platform or edge rate limiting for auth endpoints, `/api/trpc`, and expensive character sheet/runtime mutations.
- Add CSP report collection, review reports, then graduate script/style directives from report-only to enforced.
- Keep Supabase service-role keys server-only and outside web-exposed env variables.
- Review Supabase RLS policies after every schema migration that introduces user-owned data.
- Add centralized security logging for rejected CSRF requests, auth failures, ownership denials, and rate-limit events.

## Fast Follows

- Add full database-backed cross-user tRPC integration tests once the local test harness can cheaply seed two authenticated users.
- Design campaign sharing as explicit ACL tables with roles, invite state, ownership transfer rules, and non-member denial tests.
- Consider Trusted Types after CSP script/style enforcement has been validated.
