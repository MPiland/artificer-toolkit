# ADR 0016: Use Novu Cloud for product notification delivery

- **Status:** historical
- **Date:** 2026-08-10

Superseded on 2026-08-12 by [ADR 0017](0017-supabase-notification-delivery.md). This record explains the short-lived Novu implementation and must not guide new work.

## Context

Social applications need an actionable inbox and email delivery before launch. Later Campaign, paid-table, and native features need the same workflow, preference, cancellation, and push path. Building a local inbox, local preference store, or provider facade would duplicate behavior while treating email delivery as an authorization boundary would be unsafe.

The product needs durable in-app history across multi-week table cadence, preference-controlled in-app and email channels now, native push later, and secure deep links. SMS is not a current requirement.

## Decision

Use Novu Cloud and one code-first Novu Framework workflow per Social Hub event: application submitted, application decided, invitation received, and invitation decided. Each workflow has in-app and Resend email steps. Revocation and expiry cancel pending invitation-received delivery without creating another notification; retained history resolves against the current Invitations view. The public Netlify Bridge at `/.netlify/functions/novu` imports the framework workflows and renders the React Email templates in `packages/emails` at execution time.

Artificer remains authoritative for every source and destination. Source services calculate recipients and insert a narrow `notification_delivery_intents` record in the same Postgres transaction as the source change. A small dispatcher sends due intents directly to Novu with stable workflow, idempotency, grouping, and cancellation keys, and records bounded delivery-attempt metadata. This outbox is not a general event bus, queue platform, or duplicate notification inbox.

Workflow payloads contain only semantic safe copy, public source identifiers, and routing metadata. They never contain application messages, private Campaign content, email HTML/text/subjects, email addresses, internal auth identifiers, sessions, bearer values, or server secrets. A workflow renders email only in the Bridge step. Opening a notification returns through the authenticated application and reauthorizes the current source. Notification presence never grants product access.

The browser uses `@novu/react` with the authenticated recipient identity and server-issued subscriber HMAC. Novu Cloud owns feed/read/seen state and channel preferences. One Social Hub preferences row updates in-app and email preferences across all four workflows. The UI shows at most 25 items and marks the notification surface seen when opened.

Account deletion removes the Novu subscriber before Supabase deletes the account. An already-missing subscriber is success; another provider failure blocks deletion so provider data is not orphaned.

Do not self-host Novu or add a provider-neutral notification facade, local read/unread inbox tables, local preferences, a second Social shell, or a generic notification component framework.

## Consequences

- Novu Cloud is an intentional vendor dependency for product-notification presentation and delivery workflow.
- The application owns source retention, authorization, intent/retry state, and account-deletion ordering; Novu owns feed and channel preference state.
- Provider failure cannot invalidate or lose the underlying product action.
- Social, Campaign, paid-table, and future native producers reuse one workflow boundary without sharing private domain payloads.
- Resend product-notification credentials are configured in Novu. Resend can also send Supabase Auth mail through the existing Netlify auth-email function; operators must not revoke that auth key unless Supabase Auth has first moved to a replacement key.
- SMS, chat-by-SMS, marketing automation, and a generalized job or event platform remain out of scope.
