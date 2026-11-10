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
