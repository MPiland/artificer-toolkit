# Phase 04 — Social Hub and free table formation

> **Status:** planned
> **Depends on:** [Phase 03](03-campaign-core.md) and the current authenticated account/profile baseline
> **Unlocks:** public table discovery and the paid-table extension
> **Primary ADRs:** [0001](../adr/0001-package-boundaries.md), [0008](../adr/0008-ruleset-identity-and-content-binding.md)

## Goal

Launch a moderated, adults-only table-formation service for private and public free Campaigns and one-shots. Hosts may invite directly or publish a structured listing; players search, filter, apply, and receive a decision; accepted applicants become Campaign members. Phase 06 later gives one-shot Campaigns a saved Encounter play surface.

## Current starting point

- Public profiles contain only basic identity fields and are not yet a complete product contract.
- Campaign membership and invitations arrive in Phase 03; saved standalone Encounters do not yet exist.
- No listing, application, seat, schedule, discovery, blocking, reporting, or moderation domain exists.
- No external search service exists, and beta scale does not require one.

## Requirements

- Listings include owner/GM, system/ruleset, Campaign or one-shot type, tone, adult age band, timezone, schedule summary, seat capacity/availability, language if approved, free/paid state, and nullable price metadata.
- Phase 04 permits publishing free listings only. Paid state and price exist only where needed to avoid a destructive Phase 09 migration; paid activation remains server-disabled.
- Search supports indexed filters and deterministic pagination using PostgreSQL.
- Applications have explicit lifecycle: submitted, withdrawn, accepted, declined, expired, or blocked.
- Acceptance consumes capacity safely and creates or prepares the appropriate Campaign membership/invitation.
- Blocking prevents future interaction and discovery according to a documented policy.
- Reporting supports listing, profile, and application concerns with reason, evidence metadata, status, moderator action, and audit.
- Social surfaces are 18+ and US-only at launch; do not represent this assumption as age assurance.
- Responsive web supports discovery, applications, invitation links, and listing administration. Native consumes these contracts only after the web viability gate.
- Notifications reuse the device/push foundation and contain no sensitive application text.

## Design

```mermaid
flowchart LR
  GM["GM listing management"] --> Listing["Table listing service"]
  Player["Responsive web search"] --> Search["Indexed Postgres query"]
  Search --> Listing
  Player --> Application["Application lifecycle"]
  Application --> Capacity["Seat-safe acceptance"]
  Capacity --> Campaign["Campaign invitation/membership"]
  Report["Block/report"] --> Moderation["Audited moderation workflow"]
```

Social Hub authorizes public discovery separately from private Campaign/Encounter access. A public listing never grants access to its underlying Campaign, Encounter, chat, notes, or members.

## Ordered workstreams

1. **Define safety and visibility policy.** Decide public profile fields, anonymous versus authenticated browsing, block semantics, report categories, moderation roles, retention, appeals, and 18+ presentation.
2. **Define listing and application contracts.** Include system/ruleset compatibility, schedule/timezone semantics, capacity, lifecycle, stable public IDs, and conversion results.
3. **Add persistence, indexes, and RLS.** Create listings, schedule data, applications, blocks, reports, moderator actions, and capacity constraints.
4. **Add discovery and lifecycle orchestration.** Use deterministic indexed Postgres queries; do not add an external search engine for unmeasured scale.
5. **Integrate acceptance.** Convert to Campaign access idempotently and atomically with seat consumption.
6. **Add moderation and notification paths.** Keep staff access explicit and audited; prevent blocked parties from using notification side channels.
7. **Build responsive web journeys.** Cover direct invitations, search/filter/detail/apply/withdraw/status, listing management, and moderation administration.
8. **Validate privacy, concurrency, and abuse cases.** Test oversubscription, repeated acceptance, removed listings, blocks, reports, private-scope leakage, and pagination stability.

## Acceptance gates

- A listing exposes no private Campaign/Encounter/member data.
- Filters and pagination are deterministic under concurrent listing updates.
- Applications cannot be submitted to closed, full, blocked, incompatible, or unavailable listings.
- Concurrent acceptances cannot exceed seat capacity.
- Repeated acceptance creates one effective membership/invitation.
- Blocking closes every documented interaction and notification path.
- Report review and moderator action are audited.
- Paid listings cannot be published until Phase 09 enables them.
- Responsive web application and membership status agree.

## Out of scope

- Payments, paid-seat checkout, native clients, reviews, ratings, comments, direct messages, algorithmic recommendation, minors, identity verification, background checks, voice/video, and external search infrastructure.

## Questions for the phase subplan

- Is browsing anonymous or authenticated-only, and which profile fields are public?
- What schedule model is required: free text, recurring structured slots, or both?
- Is application text visible to all Campaign GMs or owner-only?
- What happens to accepted applicants when a listing closes, changes schedule, or is moderated?
- Which block direction and existing-Campaign exceptions are required?
- Who moderates launch content, and what response/appeal expectations are promised?

## New-session instruction

The subplan must begin with the public/private data boundary and capacity-safe acceptance transaction. Do not treat a stable public ID as an authorization grant.
