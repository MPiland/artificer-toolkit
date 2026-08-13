# ADR 0017: Supabase owns notification presentation and delivery execution

- **Status:** decision
- **Date:** 2026-08-12

## Context

Artificer needs a durable in-app feed, per-category in-app and email preferences, bounded delivery retries, and authorized deep links. The first implementation delegated feed, preferences, workflow execution, and email orchestration to Novu Cloud. With only five fixed transactional notification kinds, maintaining a public Framework Bridge and synchronizing provider workflows across environments added more operational work than product value.

The existing transactional `notification_delivery_intents` outbox already closes the important reliability gap: a source change and its delivery intent commit together. That application-owned boundary should remain intact.

## Decision

Keep the existing safe, idempotent delivery-intent outbox. Add protected Postgres feed and preference tables owned by the notification domain. A small scheduled Supabase Edge Function claims at most ten due intents, applies the recipient's category preferences, writes the in-app feed idempotently, sends enabled email through Resend, and records bounded success, retry, or terminal failure metadata.

The feed is durable product data and is read or mutated only through authenticated `apps/apis` procedures. Postgres tables force RLS and revoke browser roles. Supabase Realtime sends a private recipient-scoped invalidation hint containing identifiers only; the browser refetches the authoritative feed through the API. Realtime is not a feed, delivery guarantee, or authorization boundary.

Notification payloads retain only fixed safe copy and public source identifiers. Email rendering occurs in the Edge delivery function and uses the delivery-intent UUID as the Resend idempotency key. Opening a feed item performs the owning Social or Campaign API read and reauthorizes current access. Account deletion relies on database cascades and no longer coordinates an external subscriber.

The dispatcher is intentionally a notification-specific worker, not a generic event bus, queue platform, workflow builder, or rules engine. New application events still require an explicit source mutation, safe schema, recipient calculation, destination authorization, and presentation mapping.

## Consequences

- Supabase owns durable feed/preferences, private Realtime hints, and scheduled Edge execution; Resend remains the email transport.
- Novu packages, subscriber identities, Bridge functions, workflow synchronization, and provider cleanup are removed.
- The application remains portable: the Edge function is ordinary Deno-compatible TypeScript, the durable contract is PostgreSQL, and provider-specific email calls stay at one boundary.
- Phase 11 may add Expo push tokens and a push delivery branch without adding another inbox or preference model.
- SMS, marketing automation, user-authored notification rules, a general BRMS, and a general job framework remain out of scope.
