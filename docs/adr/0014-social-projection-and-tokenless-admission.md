# ADR 0014: Social projection and tokenless Campaign admission

- **Status:** decision
- **Date:** 2026-08-10

## Context

Campaigns are private collaboration aggregates. Social Hub needs authenticated discovery, table expectations, applications, direct invitations, blocking, reports, and moderation without making a Campaign identifier or public listing an access grant. The earlier Campaign visibility and bearer-link invitation model combined publication with Campaign state and put an admission credential in a URL.

## Decision

Social Hub is a separate Postgres projection over a private Campaign for authenticated users who represent through the platform Terms that they are at least 13. A Social profile exposes only a random UUID and current username. Registration does not collect a birth date or perform age or location verification. A Social listing owns schedule, location, expectations, safety, capacity, publication, and moderation state while indexing the Campaign-owned name, format, tone, and maturity needed for discovery. English is the only launch language, so language is neither stored nor filtered. Campaigns have no public visibility state, and public Social reads never expose a Campaign ID, roster, account ID, email, report, application text, or exact venue.

Applications and username invitations are authenticated inbox records addressed by random UUID. Their identifiers select records but never authorize access. Product invitation links, email targets, raw tokens, and token digests are removed; Supabase account-confirmation and recovery links remain separate auth behavior.

Invitation acceptance and application acceptance call one application-service admission operation. The transaction locks the listing, Campaign, source record, and owner entitlement row; checks ownership, publication, moderation, blocking, recipient identity, listing capacity, and tier capacity; activates one player membership idempotently; and marks the source accepted. Active `PLAYER` memberships are the only seat count.

Blocking is symmetric for Social visibility and future admission but does not alter an existing Campaign membership. Reports capture bounded server-side evidence, and every moderator evidence read or state action appends an audit row. Social tables enable RLS and remain revoked from browser roles; `apps/apis` and `packages/functions` own all Social authorization.

## Consequences

- Listing, profile, invitation, application, and report UUIDs never grant Campaign access.
- Campaign name changes synchronize the listing projection without expiring pending admission. Format, tone, and maturity changes synchronize and expire pending applications and invitations. An open recurring listing prevents conversion to `ONE_SHOT` until it is closed or rescheduled.
- Closing, editing, hiding, or transferring a listing stops pending admission without ejecting accepted members.
- Direct table access remains denied even though browsing is authenticated; public projections are schema-owned API DTOs.
- PostgreSQL full-text search, indexed filters, fixed-window rate limits, and row locks are sufficient for launch. External search, queues, caches, event buses, and generalized social abstractions are not part of this decision.
- [Phase 05 notifications](../roadmap/05-notifications-and-delivery.md) may reference Social source public IDs through the [ADR 0017](0017-supabase-notification-delivery.md) delivery boundary, but every destination read must reauthorize access and apply symmetric block predicates.
