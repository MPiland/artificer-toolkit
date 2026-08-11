# ADR 0016: Use Knock for product notification delivery

- **Status:** decision
- **Date:** 2026-08-10

## Context

Social applications need an actionable inbox and email delivery before launch. Later Campaign, paid-table, and native features need the same rules-driven channel preferences, grouping, cancellation, and push path. Building separate local inbox, email, and future push systems would duplicate workflow and preference behavior, while treating email as the notification source would make delivery state an authorization boundary.

The product needs durable in-app history across multi-week table cadence, preference-controlled in-app and email channels now, native push later, and secure deep links. SMS is not a current requirement.

## Decision

Use Knock Cloud for product-notification workflow execution, in-app feed state, read/archive state, grouping, and user channel preferences. Use Resend as Knock's email provider. Phase 11 will add native push through the same Knock workflows if the web product passes its viability gate.

Artificer remains authoritative for every notification source and destination. Source services calculate recipients and insert a narrow `notification_delivery_intents` record in the same Postgres transaction as the source change. A small dispatcher sends due intents to Knock with stable workflow, idempotency, grouping, and cancellation keys and records bounded delivery-attempt metadata. This outbox is not a general event bus, queue platform, or duplicate notification inbox.

External payloads contain only minimal safe copy, public source identifiers, and routing metadata. They never contain application messages, private Campaign content, email addresses, internal auth identifiers, sessions, bearer values, or server secrets. Opening any notification returns through the authenticated application and reauthorizes the current source. Notification presence never grants product access.

The browser may receive only a short-lived backend-signed Knock user token scoped to the authenticated recipient. Knock, Resend, Supabase, and auth secrets remain server-only and outside `VITE_` configuration, DTOs, URLs, logs, telemetry, and browser storage.

Do not add a provider-neutral notification facade, local read/unread inbox tables, a second Social shell, or generic notification component framework. Use Knock's headless client with the existing Shell, Mantine, and direct source adapters.

## Consequences

- Knock is an intentional vendor dependency for product notification presentation and delivery workflow.
- Artificer can change provider later by replaying authoritative sources and pending delivery intents, but no migration abstraction is built before evidence requires it.
- The application owns source retention and authorization; Knock owns feed/read/archive/preferences. Provider failure cannot invalidate or lose the underlying product action.
- Social, Campaign, paid-table, and future native producers reuse one workflow boundary without sharing private domain payloads.
- Optional in-app and email delivery is user-configurable by category. Supabase authentication and recovery messages remain outside this system.
- SMS, chat-by-SMS, marketing automation, and a generalized job or event platform remain out of scope.