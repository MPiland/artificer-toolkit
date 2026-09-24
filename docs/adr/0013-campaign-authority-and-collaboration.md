# ADR 0013: Campaign authority and private collaboration

- **Status:** decision — Campaign authority and privacy retained; Postgres, Supabase Realtime/Storage, and service-package topology superseded by [ADR 0029](0029-convex-backend-cutover.md)
- **Date:** 2026-08-06

## Context

Campaigns add shared Character access, member-shared homebrew, party custody, durable conversations, collaborative notes, and private Realtime updates. Existing Character services assume one account owns every read and mutation, while Supabase Broadcast is transient and cannot be the history or authorization boundary. PARTY conversations must also remain undiscoverable to the Campaign owner.

## Decision

Convex Campaign functions resolve Campaign membership and Character assignment for every Campaign-aware read and write. The owner receives only an explicit allowlist of Sheet mechanics; structural Builder choices and private player fields remain Character-owner-only. Campaign adjustments are a separate assignment-scoped overlay, so a GM value can take precedence without destroying the player's stored adjustment. Actor-specific DTO projection removes secret GM sources after authoritative totals are computed, and the GM projection removes private player inventory/spell customizations and labels derived from them. GM commands cannot mutate those private customizations or reset a private Character maximum-hit-point adjustment during rest.

Convex owns Campaign membership cutoffs, current Campaign content-share authority, inventory custody, chat/roll history, note versions, and audit events. `InventoryOwnerRef = CHARACTER | CAMPAIGN` is the custody boundary; transfers serialize both owners in deterministic order and commit with an idempotency key. A player may mutate only inventory owned by the Character assigned to that membership; the Campaign owner may operate on assigned Characters, while direct Campaign-owned inventory mutations remain owner-only. Player transfers may still target an authorized Campaign or assigned Character owner through the transfer policy. Exact current valid shares feed the Campaign Character overlay and fail closed when the share, sharing membership, or current authored root is unavailable.

Campaign content visibility is actor-specific. An ACTIVE member may directly share a current ACTIVE, non-Master root they own, granting bounded Campaign read/use access while the share and membership remain valid. There is no GM review state, Campaign approval version, ordinary authored pin, or Character binding row. Unshare, sharing-author departure, and authored deletion revoke authority and reconcile affected Characters and Campaign Vehicles in their owning transaction rather than blocking the operation or retaining ghost content. Campaign copy never transfers direct shares or another member's `shared_by` authority; its current copy surface contains no share-dependent Character, Vehicle, or inventory state.

TABLE, PARTY, and DIRECT are separate conversation authorization scopes. TABLE permits the active GM and players. PARTY permits active players only; GM status never grants access. DIRECT permits its two active participants only. OWNER and USER are recipient-specific invalidation scopes; USER is permitted only for the exact active membership. The same conversation predicates govern conversation reads, unread state, counts, subscriptions, and public-roll routing. Role or participant changes reset the relevant history cutoff. Each Convex subscription is scoped to the member and that access-start epoch, so removed members and stale roles receive no later private data. Durable content is always recovered through an authenticated, actor-filtered Convex query.

Account tier is stored in a protected entitlement document and mapped to launch limits in the entitlement service. Counts and creation or activation commit in the same owning transaction. R2 is the media byte store under [ADRs 0012](0012-private-media-assets-and-domain-owned-references.md) and [0029](0029-convex-backend-cutover.md); chat and notes are structured Convex data rather than quota-counted media.

## Consequences

- Campaign authority cannot be inferred from a role label in web code or delegated to broad Character RLS policies.
- PARTY and DIRECT rows, unread counts, subscriptions, invalidations, public-roll delivery, and future notification sources must share their exact privacy predicate.
- Subscription disconnects lose delivery, not data; cursor recovery from Convex is required.
- Current-share resolution validates the exact share, active sharing membership, root ownership, and current authored identity before an overlay or dependent projection is accepted.
- Shared custody and GM commands produce correlated Campaign audit events.
- Payments, external notification delivery, CRDT merging, and alternate object-storage providers remain separate later decisions.

## Acquired Equipment retention amendment — 2026-09-15

Approved target for the Convex cutover: Equipment already acquired by a Character, Campaign party,
or Campaign Vehicle keeps its usable rules when the author unshares or deletes the source, or
leaves the Campaign. Removal revokes the source's authority to supply new copies. Retained item
rules must be scoped to existing custody; they do not restore catalogue or unrelated authored access.

This supersedes the earlier source-loss removal rule only for acquired Equipment. The native
implementation now stores validated raw ancestry and Spell dependencies on existing held instances
and captures the last current version before authority disappears. Reconciliation preserves those
instances and their contents while removing new-acquisition intent. Incomplete or corrupt retention
rejects atomically; it does not restore source access. Complete lifecycle proof remains required. The current and target behavior are tracked in
[the persistence guide](../architecture/persistence.md#native-member-departure--partial-local-implementation).
