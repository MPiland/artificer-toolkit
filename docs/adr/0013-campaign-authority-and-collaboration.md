# ADR 0013: Campaign authority and private collaboration

- **Status:** decision
- **Date:** 2026-08-06

## Context

Campaigns add shared Character access, member-shared homebrew, party custody, durable conversations, collaborative notes, and private Realtime updates. Existing Character services assume one account owns every read and mutation, while Supabase Broadcast is transient and cannot be the history or authorization boundary. PARTY conversations must also remain undiscoverable to the Campaign owner.

## Decision

`packages/functions` resolves Campaign membership and Character assignment for every Campaign-aware read and write. The owner receives only an explicit allowlist of Sheet mechanics; structural Builder choices and private player fields remain Character-owner-only. Campaign adjustments are a separate assignment-scoped overlay, so a GM value can take precedence without destroying the player's stored adjustment. Actor-specific DTO projection removes secret GM sources after authoritative totals are computed, and the GM projection removes private player inventory/spell customizations and labels derived from them. GM commands cannot mutate those private customizations or reset a private Character maximum-hit-point adjustment during rest.

Postgres owns Campaign membership cutoffs, current Campaign content-share authority, inventory custody, chat/roll history, note versions, and audit events. `InventoryOwnerRef = CHARACTER | CAMPAIGN` is the custody boundary; transfers lock both owners in deterministic order and commit with an idempotency key. A player may mutate only inventory owned by the Character assigned to that membership; the Campaign owner may operate on assigned Characters, while direct Campaign-owned inventory mutations remain owner-only. Player transfers may still target an authorized Campaign or assigned Character owner through the transfer policy. Exact current valid shares feed the Campaign Character overlay and fail closed when the share, sharing membership, or current authored root is unavailable.

Campaign content visibility is actor-specific. An ACTIVE member may directly share a current ACTIVE, non-Master root they own, granting bounded Campaign read/use access while the share and membership remain valid. There is no GM review state, Campaign approval version, ordinary authored pin, or Character binding row. Unshare, sharing-author departure, and authored deletion revoke authority and reconcile affected Characters and Campaign Vehicles in their owning transaction rather than blocking the operation or retaining ghost content. Campaign copy never transfers direct shares or another member's `shared_by` authority; its current copy surface contains no share-dependent Character, Vehicle, or inventory state.

TABLE, PARTY, and DIRECT are separate conversation authorization scopes. TABLE permits the active GM and players. PARTY permits active players only; GM status never grants access. DIRECT permits its two active participants only. OWNER and USER are recipient-specific invalidation scopes; USER is permitted only for the exact active membership. The same conversation predicates govern conversation reads, unread state, counts, subscriptions, Broadcast delivery, and public-roll routing. Role or participant changes reset the relevant history cutoff. Each Realtime subscription topic is scoped to the member and that access-start epoch, and broadcasts fan out only to currently eligible memberships; cached authorization for a removed or promoted member's old channel therefore receives no later traffic. A locked-search-path `SECURITY DEFINER` predicate answers only whether the authenticated user's exact topic is allowed, preserving the global browser table revokes. Private Supabase Realtime carries only committed identifiers and cursors; Broadcast stores no durable data. Durable content is always recovered through the authenticated API.

Account tier is stored in a protected entitlement row and mapped to the launch limits in the entitlement service. Counts and creation or activation commit in the same owning transaction. Supabase Storage remains the media store under [ADR 0012](0012-private-media-assets-and-domain-owned-references.md); chat and notes are structured Postgres data rather than quota-counted media.

## Consequences

- Campaign authority cannot be inferred from a role label in web code or delegated to broad Character RLS policies.
- PARTY and DIRECT rows, unread counts, subscriptions, invalidations, public-roll delivery, and future notification sources must share their exact privacy predicate.
- Realtime disconnects lose hints, not data; cursor recovery from Postgres is required.
- Current-share resolution validates the exact share, active sharing membership, root ownership, and current authored identity before an overlay or dependent projection is accepted.
- Shared custody and GM commands produce correlated Campaign audit events.
- Payments, external notification delivery, CRDT merging, and alternate object-storage providers remain separate later decisions.
