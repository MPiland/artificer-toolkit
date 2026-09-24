# Artificer Toolkit Threat Model

Last updated: 2026-09-22

## Current Phase 8.2 model

The current product boundary is TanStack Start plus generated Convex queries, mutations and actions.
Better Auth supplies identity and sessions. Convex owns product authorization, persistence,
transactions, replay and durable live-session state. The Session Durable Object accepts authenticated
room tickets and carries transient previews; it does not own product data. Private R2 stores media
bytes under Convex-owned metadata and short-lived signed permissions. Resend receives only
server-scheduled transactional email.

### Security goals

- Session, signing, provider and storage secrets never enter browser variables, URLs, rendered HTML,
  logs or product payloads.
- Every product read and write derives identity from Better Auth and rechecks document ownership,
  Campaign membership or DM authority in Convex.
- Shared contracts validate public inputs and outputs; clients cannot submit an actor ID as authority.
- Durable commands preserve atomicity, idempotency, replay, rollback, privacy and exact authority
  epochs.
- Worker tickets bind the user, Campaign, Session, Scene, role and expiry. Removing access closes the
  active room admission without periodic database polling.
- Media permissions bind an authorized asset and operation for a short duration. Object keys and
  provider credentials remain server-only.
- Authored rich text is sanitized before rendering, and browser security headers deny framing,
  MIME sniffing and unused device capabilities.

### Current trust boundaries

| Boundary                            | Required control                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Browser or SSR to Convex            | Better Auth identity, exact shared validators, per-document authorization and no client-supplied authority |
| Browser to Better Auth HTTP actions | Origin/CSRF protection for cookie operations, sensitive-session checks and bounded error responses         |
| Browser to Session Worker           | Signed short-lived room ticket, exact room scope and server-confirmed durable commits                      |
| Session Worker to Convex            | Private shared secret, authority epoch, request ID, replay-safe journal/outbox and bounded payloads        |
| Convex to R2                        | Server-only bucket credentials, scoped signed transfer/delivery and reference-aware cleanup                |
| Convex to Resend                    | Server-only credentials, recipient-scoped scheduled delivery and no provider body in logs                  |

### Primary abuse paths

| Threat                              | Mitigation                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-user or cross-Campaign access | Native functions derive the profile from auth and check the owning record, membership and role before reads or writes.                               |
| Stale or forged live command        | Room ticket scope, current authority epoch, scene/session versions, command IDs and exact replay receipts reject it.                                 |
| Partial durable mutation            | Convex transactions commit the complete state change or roll it back; deferred cleanup uses persisted bounded jobs where one transaction cannot fit. |
| Private-state disclosure            | Queries return recipient projections; transient fanout uses recipient-specific payloads and rejects unauthorized admission.                          |
| Credential or token exposure        | Secrets stay in Convex, Worker or build environments; logs and retained evidence redact sensitive values.                                            |
| Media substitution or orphaning     | Convex owns asset identity, quota and references; finalization validates stored bytes and cleanup rechecks live references.                          |
| XSS and browser embedding           | Sanitized rich text, CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff` and a restrictive Permissions Policy.                         |

### Remaining release controls

R08 must pass the complete final-source local lifecycle and request audit. R09 must verify managed
secrets, permissions, R2, email, Worker admission and network behavior. Production and retired-service
shutdown require their separate approvals. HTTPS/HSTS, enforced CSP reporting, managed rate limits and
rollback identifiers must be confirmed during those promotion gates.

## Historical pre-cutover model

The May 2026 model below is retained only as migration history. Its Supabase, tRPC, Kysely,
`packages/functions`, `packages/db` and future-Campaign statements do not describe the current
application.

### Scope

This section records the May 2026 public-deployment baseline for `artificer-toolkit`:

- `apps/web`: TanStack Start frontend and same-origin server entry.
- `apps/apis`: product-data transport boundary and tRPC router.
- `packages/functions`: application services and route wrappers.
- `packages/db`: Kysely persistence and repository layer.
- `packages/schema`: DTO validation boundary.
- Supabase Auth with SSR cookies as the session source.

Campaign sharing was future work at this point. Day-one data isolation means unrelated users cannot read or mutate each other's homebrew, drafts, characters, sheets, or history. Future campaign/DM sharing must add explicit membership and ACL checks rather than weakening owner isolation.

### Security goals

- Credentials and Supabase tokens never appear in URLs, route context, rendered HTML, logs, or product-data query payloads.
- Product data flows through same-origin `/api/trpc`, not browser-visible bearer tokens.
- State-changing cookie-authenticated requests reject cross-site attempts.
- User-owned records remain isolated by authenticated user id and DB session context.
- Master/SRD records can be viewed and copied without becoming directly editable.
- Request input reaches SQL only through schema validation, typed repositories, and parameterized Kysely queries.
- User-authored rich text does not create executable script, event handler, URL, or embedded-object sinks.

### Assets

- Supabase session cookies and refresh/session material.
- User identity and owner id.
- Homebrew authored records and drafts.
- Character builder data, sheets, play-state commands, and history.
- Master/SRD reference content.
- Database credentials and deployment environment variables.
- tRPC procedure names, inputs, and responses.

### Trust boundaries

- Browser to TanStack Start server: untrusted HTTP request, cookies attached by browser.
- TanStack Start server to Supabase Auth: server validates cookies with `getUser()`.
- TanStack Start server to `apps/apis`: trusted in-process call carrying only `userId`.
- `apps/apis` to `packages/functions`/`packages/db`: trusted server-side code boundary.
- DB session context: `withUserContext(db, userId, ...)` sets the request user for RLS-aware queries.
- Future campaign sharing: separate boundary requiring explicit membership/role checks.

### Primary abuse paths and mitigations

| Threat                  | Abuse path                                                                                                 | Current mitigation                                                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token exposure          | Access token serialized into route context, HTML, URL, tRPC query input, or Authorization header from web. | `apps/web/src/server/trpc.ts` passes only `userId`; `apps/apis/src/trpc/dbContext.ts` scopes DB work with `withUserContext`; tRPC procedures call repositories/services directly without synthetic bearer headers; router context tests assert no token strings. |
| CSRF                    | Attacker site submits cookie-authenticated mutations.                                                      | `/api/trpc` requires same-origin marker plus Origin/Referer/Sec-Fetch-Site checks; logout/password/resend server functions validate Origin/Referer/Sec-Fetch-Site.                                                                                               |
| Cross-user reads/writes | User guesses another user's content or character id.                                                       | Procedures require auth; tRPC enters `withUserContext`; legacy route wrappers also enter `withUserContext`; authoring helpers reject foreign/master direct writes; character sheet commands reject foreign ownership.                                            |
| SQL injection           | Request input reaches string-built SQL.                                                                    | DTO schemas validate inputs; Kysely builders parameterize values; static test rejects `sql.raw(` in active runtime code.                                                                                                                                         |
| XSS via rich text       | Authored HTML contains script, event attributes, javascript URLs, forms, frames, or objects.               | `renderSanitizedRichHtml` removes executable tags, event/style/srcdoc attrs, and unsafe URLs before rendering authored prose.                                                                                                                                    |
| Clickjacking            | App embedded in a hostile frame.                                                                           | `X-Frame-Options: DENY` and enforced CSP `frame-ancestors 'none'`.                                                                                                                                                                                               |
| MIME confusion          | Browser sniffs content as executable.                                                                      | `X-Content-Type-Options: nosniff`.                                                                                                                                                                                                                               |
| Over-broad browser APIs | Compromised page uses camera, mic, geolocation, payment, etc.                                              | App-owned `Permissions-Policy` denies unused capabilities.                                                                                                                                                                                                       |
| Referrer leakage        | Sensitive paths leak in outbound referrers.                                                                | `Referrer-Policy: strict-origin-when-cross-origin`.                                                                                                                                                                                                              |

### Residual risks

- Script and style CSP is report-only first because TanStack Start dev/runtime and Mantine styles need compatibility validation before enforcement.
- HSTS is intentionally not enabled until production HTTPS/domain ownership is final.
- Static generated SVG icon components now render JSX children instead of raw HTML injection.
- Public deployment needs edge or platform rate limiting for auth, tRPC mutations, and expensive sheet/runtime operations.
- MFA is out of scope while the Supabase plan does not support the desired setup.
- Campaign sharing needs a new ACL model with membership, roles, invite lifecycle, audit events, and tests for non-member denial.

### Required future controls before public launch

- Enable HTTPS everywhere and add HSTS after domain ownership is settled.
- Add production rate limits and abuse logging at the hosting edge or server adapter.
- Add CSP report collection before moving script/style directives from report-only to enforce.
- Confirm Supabase RLS policies cover every user-owned table and that secret keys never reach web bundles.
- Add campaign ACL migrations and cross-member/non-member tests before shared campaigns ship.
