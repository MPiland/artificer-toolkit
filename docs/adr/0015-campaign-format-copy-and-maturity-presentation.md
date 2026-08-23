# ADR 0015: Campaign format, copying, and maturity presentation

- **Status:** decision
- **Date:** 2026-08-10

## Context

One-shot and ongoing play use the same Campaign tools, but they represent different table commitments and need explicit discovery metadata. Repeat one-shots need reusable preparation without carrying a prior cohort or run forward. Standard Campaigns also need best-effort reduction of inappropriate language in shared and public responses without destroying an author's original private work.

## Decision

Campaign is the source of truth for `ONE_SHOT | ONGOING` format, one to three tone tags with optional details, and `STANDARD | MATURE` content maturity. Social listings store only the indexed projection of that metadata. A one-shot listing may use a flexible or one-time schedule, but never a recurring schedule.

The owner-only Campaign copy command creates a fresh aggregate with a new public ID, timestamps, owner membership, and entitlement usage. It copies Campaign metadata, attunement overrides, and Campaign-level notebook note sections. Direct Campaign shares are scoped authorization and never transfer, including another member's `shared_by` authority. The copy surface does not copy members, Characters or assignments, Vehicles or inventory, Sessions or Session notes, chat, attendance, invitations, applications, or Social listings, so it creates no share-dependent destination state. The source Campaign remains unchanged. A private idempotency receipt converges transport retries without exposing the destination ID in Campaign history.

Original text remains persisted. Before transport or SSR serialization, Standard Campaign shared and public projections mask known whole-word English profanity plus explicitly identified compound terms such as `shitstorm` in display-text fields with `****`. A small local allow-list covers known false positives. Mature Social projections are masked by default and return original text only to the Campaign owner or a viewer whose server-owned preference is Mature after 18+ self-attestation. Private authoring and editing reads, author-owned private notes, and audited moderator evidence return the original. Authored snapshots use Node Map text metadata; structural IDs, enums, formulas, URLs, cursors, and arbitrary JSON are not rewritten. Realtime messages carry identifiers for invalidation only.

The default viewing preference is `STANDARD`. Enabling `MATURE` without a prior adult attestation accepts a birth date only long enough for the server to calculate 18+, then discards it and stores only the attestation timestamp. This is an easily bypassed self-attestation, not identity or age verification.

## Consequences

- Shared and owner-edit projections remain separately authorized; owning a Campaign does not make an ordinary shared view private.
- Changing format, tone, or maturity invalidates Campaign and Social queries and expires pending Social admission records. Changing only the Campaign name updates the listing projection without expiration.
- Filtering is a best-effort exposure policy, not age assurance or a comprehensive moderation guarantee, and it cannot retract text already delivered to an opted-in viewer.
- English is the only supported launch language. Adding another language requires an explicit product and filtering policy rather than a free-text locale field.
