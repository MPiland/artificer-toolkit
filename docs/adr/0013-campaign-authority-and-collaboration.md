# ADR 0013: Campaign authority and private collaboration

- **Status:** decision
- **Date:** 2026-08-06

## Context

Campaigns add shared Character access, granted homebrew, party custody, durable conversations, collaborative notes, and private Realtime updates. Existing Character services assume one account owns every read and mutation, while Supabase Broadcast is transient and cannot be the history or authorization boundary. PARTY conversations must also remain undiscoverable to the Campaign owner.

## Decision

`packages/functions` resolves Campaign membership and Character assignment for every Campaign-aware read and write. The owner receives only an explicit allowlist of Sheet mechanics; structural Builder choices and private player fields remain owner-only. Campaign adjustments are a separate assignment-scoped overlay, so a GM value can take precedence without destroying the player's stored adjustment. Actor-specific DTO projection removes secret GM sources after authoritative totals are computed.

Postgres owns Campaign membership cutoffs, immutable approved content snapshots, Character bindings, inventory custody, chat/roll history, note versions, and audit events. `InventoryOwnerRef = CHARACTER | CAMPAIGN` is the custody boundary; transfers lock both owners in deterministic order and commit with an idempotency key. Removing Campaign content bindings reuses Builder reconciliation and persists an owner-scoped Draft when structural content is no longer available.

TABLE, PARTY, and DIRECT are separate authorization scopes. TABLE permits the active GM and players. PARTY permits active players only; GM status never grants access. DIRECT permits its two active participants only. The same predicates govern conversation reads, unread state, counts, subscriptions, Broadcast delivery, and public-roll routing. Role or participant changes reset the relevant history cutoff. Each Realtime subscription topic is scoped to the member and that access-start epoch, and broadcasts fan out only to currently eligible memberships; cached authorization for a removed or promoted member's old channel therefore receives no later traffic. A locked-search-path `SECURITY DEFINER` predicate answers only whether the authenticated user's exact topic is allowed, preserving the global browser table revokes. Private Supabase Realtime carries only committed identifiers and cursors. Durable content is always recovered through the authenticated API.

Account tier is stored in a protected entitlement row and mapped to the launch limits in the entitlement service. Counts and creation or activation commit in the same owning transaction. Supabase Storage remains the media store under [ADR 0012](0012-private-media-assets-and-domain-owned-references.md); chat and notes are structured Postgres data rather than quota-counted media.

## Consequences

- Campaign authority cannot be inferred from a role label in web code or delegated to broad Character RLS policies.
- PARTY and DIRECT rows, unread counts, subscriptions, invalidations, public-roll delivery, and future notification sources must share their exact privacy predicate.
- Realtime disconnects lose hints, not data; cursor recovery from Postgres is required.
- Content propagation validates every affected binding before advancing any of them.
- Shared custody and GM commands produce correlated Campaign audit events.
- Payments, external notification delivery, CRDT merging, and alternate object-storage providers remain separate later decisions.
