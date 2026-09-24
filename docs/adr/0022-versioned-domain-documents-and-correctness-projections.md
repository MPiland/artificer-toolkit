# ADR 0022: Versioned domain documents and correctness projections

- **Status:** historical — document model superseded by [ADR 0024](0024-current-published-authored-content.md); SQL and session topology superseded by [ADR 0029](0029-convex-backend-cutover.md)
- **Date:** 2026-08-17
- **Scope:** authored versions, System vocabulary snapshots, Character mechanics projections, replayable Encounter/Scene projections, and live-command reads
- **Update when:** projection inputs/checksums, synchronous publication, domain ownership, or command-read contracts change
- **Verification:** `docs/architecture/versioned-projections.md`; deterministic compiler/rebuild, transaction rollback, pin-stability, privacy, and replay gates

> The product invariants below remain useful history. Kysely/SQL ownership, Zen authority, Durable Object journals, and local/remote host topology are not current implementation guidance.

## Context

The current normalized authored aggregate model and Character command assembly recreate expensive operational state at read time. The retained live-session foundation must coordinate native WebSockets and private delivery without becoming a second gameplay authority. The product now needs exact current authored-source identity for Character mechanics and bounded command reads without full catalog hydration.

## Decision

Each domain owns its persistence model; there is no universal entity or projection framework.

- Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle use immutable validated complete-document versions, active root pointers, and compiled immutable operational projections. Activation publishes the selected document and compiled projection in one transaction. Spell catalogue class metadata reads only the active-version `spell_catalog_classes` projection, never legacy `spell_classes`.
- System vocabulary remains relational catalog authority and publishes one validated versioned snapshot per System for compilers/rules consumers. Exact immutable snapshot rows are validated with shared locks; mutable System and authored-root ownership rows retain exclusive locks.
- Character intent/progression and targeted Sheet state remain canonical relational ownership. A structural or mechanics-bearing change atomically publishes a context-neutral Character mechanics projection containing exact normalized facts, bounded registry, Zen result, and immutable authored-version vector. Drafts and newly admitted sources select current `ACTIVE` versions; first finalization pins them. Publish, full read, metadata read, and compact advance validate exact kind/root/version/version-number/checksum/System existence without requiring later active-pointer equality. Source-preserving commands retain pins, and only explicit reviewed upgrades repin. The Sheet remains a committed-state surface; this decision does not establish arbitrary new authored-source admission through `SET_KNOWN_SPELLS` or `SET_PREPARED_SPELLS`.
- Campaign, Social, notification, and media truth remains relational. `campaign_content_shares` grants root-scoped Campaign authority to current `ACTIVE`, non-Master content owned by the sharing member; it stores no approval version and does not silently rebind existing Characters. A finalized Character may retain its exact pinned version while that root remains authorized. Unshare/member removal and authored deletion reconcile lost authority/source atomically; authored activation alone does not repin or demote the Character. An assigned Character's Campaign mechanical overlay is a separate Campaign-owned, assignment-bound projection. Empty Campaign mechanics context is a checksum-bound reference to the exact base projection; any adjustment or attunement override stores the exact overlay facts/result. Secret sources and conditions remain relational presentation data. Social listing fields are synchronous owning projections; email/external delivery remains asynchronous through the narrow outbox.
- Encounter and Scene events are immutable and synchronously maintain current projections. Replay must reconstruct the same validated serialized projection.
- The Cloudflare Durable Object and local Node host are transport adapters over one authoritative command interface. The DO journal is delivery recovery, never gameplay authority. Evaluator instances may be cached process-locally by immutable checksum only.

Every correctness projection is schema-validated, checksum-addressed, versioned, and fail-closed. Production reads do not lazily rebuild a stale or missing projection.

## Consequences

This decision amends ADRs 0002 and 0003: Kysely/SQL ownership and explicit model boundaries remain, but active normalized hydration and ephemeral-only mechanics assembly cease to be the operational read model. It supersedes ADR 0011's no-authored-history decision. It amends ADRs 0019 and 0021 so committed Character mechanics projections are durable correctness read models rather than process/room snapshots; exact Zen ownership and the one-command/one-lane rule remain. It amends ADR 0020 only at the command-read seam; remote/local topology, private fanout, and journal ownership remain.

ADRs 0006, 0009, 0012, 0013, and 0014 remain in force: Builder/Sheet ownership, Encounter separation, media ownership, Campaign authorization, and Social privacy are preserved.

The unfinished `character_committed_rule_snapshots` work is removed rather than extended because it does not satisfy this contract. Staging has reset/reseeded from canonical migrations and TypeScript source data after source, rebuild, and reset contracts passed. Production remains gated on final staging audit and managed/hardware release evidence, and requires fresh explicit approval immediately before its destructive reset.
