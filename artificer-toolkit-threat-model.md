# Artificer Toolkit Threat Model

Last updated: 2026-05-08

## Scope

This threat model covers the current public-deployment baseline for `artificer-toolkit`:

- `apps/web`: TanStack Start frontend and same-origin server entry.
- `apps/apis`: product-data transport boundary and tRPC router.
- `packages/functions`: application services and route wrappers.
- `packages/db`: Kysely persistence and repository layer.
- `packages/schema`: DTO validation boundary.
- Supabase Auth with SSR cookies as the session source.

Campaign sharing is future work. Day-one data isolation means unrelated users cannot read or mutate each other's homebrew, drafts, characters, sheets, or history. Future campaign/DM sharing must add explicit membership and ACL checks rather than weakening owner isolation.

## Security Goals

- Credentials and Supabase tokens never appear in URLs, route context, rendered HTML, logs, or product-data query payloads.
- Product data flows through same-origin `/api/trpc`, not browser-visible bearer tokens.
- State-changing cookie-authenticated requests reject cross-site attempts.
- User-owned records remain isolated by authenticated user id and DB session context.
- Master/SRD records can be viewed and copied without becoming directly editable.
- Request input reaches SQL only through schema validation, typed repositories, and parameterized Kysely queries.
- User-authored rich text does not create executable script, event handler, URL, or embedded-object sinks.

## Assets

- Supabase session cookies and refresh/session material.
- User identity and owner id.
- Homebrew authored records and drafts.
- Character builder data, sheets, play-state commands, and history.
- Master/SRD reference content.
- Database credentials and deployment environment variables.
- tRPC procedure names, inputs, and responses.

## Trust Boundaries

- Browser to TanStack Start server: untrusted HTTP request, cookies attached by browser.
- TanStack Start server to Supabase Auth: server validates cookies with `getUser()`.
- TanStack Start server to `apps/apis`: trusted in-process call carrying only `userId`.
- `apps/apis` to `packages/functions`/`packages/db`: trusted server-side code boundary.
- DB session context: `withUserContext(db, userId, ...)` sets the request user for RLS-aware queries.
- Future campaign sharing: separate boundary requiring explicit membership/role checks.

## Primary Abuse Paths And Mitigations

| Threat | Abuse path | Current mitigation |
| --- | --- | --- |
| Token exposure | Access token serialized into route context, HTML, URL, tRPC query input, or Authorization header from web. | `apps/web/src/server/trpc.ts` passes only `userId`; `apps/apis/src/trpc/dbContext.ts` scopes DB work with `withUserContext`; tRPC procedures call repositories/services directly without synthetic bearer headers; router context tests assert no token strings. |
| CSRF | Attacker site submits cookie-authenticated mutations. | `/api/trpc` requires same-origin marker plus Origin/Referer/Sec-Fetch-Site checks; logout/password/resend server functions validate Origin/Referer/Sec-Fetch-Site. |
| Cross-user reads/writes | User guesses another user's content or character id. | Procedures require auth; tRPC enters `withUserContext`; legacy route wrappers also enter `withUserContext`; authoring helpers reject foreign/master direct writes; character sheet commands reject foreign ownership. |
| SQL injection | Request input reaches string-built SQL. | DTO schemas validate inputs; Kysely builders parameterize values; static test rejects `sql.raw(` in active runtime code. |
| XSS via rich text | Authored HTML contains script, event attributes, javascript URLs, forms, frames, or objects. | `renderSanitizedRichHtml` removes executable tags, event/style/srcdoc attrs, and unsafe URLs before rendering authored prose. |
| Clickjacking | App embedded in a hostile frame. | `X-Frame-Options: DENY` and enforced CSP `frame-ancestors 'none'`. |
| MIME confusion | Browser sniffs content as executable. | `X-Content-Type-Options: nosniff`. |
| Over-broad browser APIs | Compromised page uses camera, mic, geolocation, payment, etc. | App-owned `Permissions-Policy` denies unused capabilities. |
| Referrer leakage | Sensitive paths leak in outbound referrers. | `Referrer-Policy: strict-origin-when-cross-origin`. |

## Residual Risks

- Script and style CSP is report-only first because TanStack Start dev/runtime and Mantine styles need compatibility validation before enforcement.
- HSTS is intentionally not enabled until production HTTPS/domain ownership is final.
- Static generated SVG icon components now render JSX children instead of raw HTML injection.
- Public deployment needs edge or platform rate limiting for auth, tRPC mutations, and expensive sheet/runtime operations.
- MFA is out of scope while the Supabase plan does not support the desired setup.
- Campaign sharing needs a new ACL model with membership, roles, invite lifecycle, audit events, and tests for non-member denial.

## Required Future Controls Before Public Launch

- Enable HTTPS everywhere and add HSTS after domain ownership is settled.
- Add production rate limits and abuse logging at the hosting edge or server adapter.
- Add CSP report collection before moving script/style directives from report-only to enforce.
- Confirm Supabase RLS policies cover every user-owned table and that service-role keys never reach web bundles.
- Add campaign ACL migrations and cross-member/non-member tests before shared campaigns ship.
