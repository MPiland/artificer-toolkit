# ADR 0022: Versioned domain documents and correctness projections

- **Status:** accepted — implementation and staging release validation in progress
- **Date:** 2026-08-17
- **Scope:** authored versions, System vocabulary snapshots, Character mechanics projections, replayable Encounter/Scene projections, and live-command reads
- **Update when:** projection inputs/checksums, synchronous publication, domain ownership, or command-read contracts change
- **Verification:** `docs/architecture/versioned-projections.md`; deterministic compiler/rebuild, transaction rollback, pin-stability, privacy, and replay gates

## Context

The current normalized authored aggregate model and Character command assembly recreate expensive operational state at read time. The retained live-session foundation must coordinate native WebSockets and private delivery without becoming a second gameplay authority. The product now needs exact, immutable content pins for finalized Characters and bounded command reads without full catalog hydration.

## Decision

Each domain owns its persistence model; there is no universal entity or projection framework.

- Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle use immutable validated complete-document versions, active root pointers, and compiled immutable operational projections. Activation publishes the selected document and compiled projection in one transaction.
- System vocabulary remains relational catalog authority and publishes one validated versioned snapshot per System for compilers/rules consumers.
- Character intent/progression and targeted Sheet state remain canonical relational ownership. A structural or mechanics-bearing change atomically publishes a context-neutral, version-matched Character mechanics projection containing exact normalized facts, bounded registry, and Zen result. Finalization pins exact authored versions and rule revision; draft previews use active versions; upgrades are explicit preview/reconcile/commit operations.
- Campaign, Social, notification, and media truth remains relational. A Campaign-content approval pins one exact authored document/projection version inside its owning transaction; it never stores client-supplied snapshot JSON or silently rebinds existing Characters. An assigned Character's Campaign mechanical overlay is a separate Campaign-owned, assignment-bound projection that references the exact base mechanics checksum and contains only exact overlay facts/result; secret sources and conditions remain relational presentation data. Social listing fields and approved Character bindings are synchronous owning projections; email/external delivery remains asynchronous through the narrow outbox.
- Encounter and Scene events are immutable and synchronously maintain current projections. Replay must reconstruct the same validated serialized projection.
- The Cloudflare Durable Object and local Node host are transport adapters over one authoritative command interface. The DO journal is delivery recovery, never gameplay authority. Evaluator instances may be cached process-locally by immutable checksum only.

Every correctness projection is schema-validated, checksum-addressed, versioned, and fail-closed. Production reads do not lazily rebuild a stale or missing projection.

## Consequences

This decision amends ADRs 0002 and 0003: Kysely/SQL ownership and explicit model boundaries remain, but active normalized hydration and ephemeral-only mechanics assembly cease to be the operational read model. It supersedes ADR 0011's no-authored-history decision. It amends ADRs 0019 and 0021 so committed Character mechanics projections are durable correctness read models rather than process/room snapshots; exact Zen ownership and the one-command/one-lane rule remain. It amends ADR 0020 only at the command-read seam; remote/local topology, private fanout, and journal ownership remain.

ADRs 0006, 0009, 0012, 0013, and 0014 remain in force: Builder/Sheet ownership, Encounter separation, media ownership, Campaign authorization, and Social privacy are preserved.

The unfinished `character_committed_rule_snapshots` work is removed rather than extended because it does not satisfy this contract. Staging has reset/reseeded from canonical migrations and TypeScript source data after source, rebuild, and reset contracts passed. Production remains gated on final staging audit and managed/hardware release evidence, and requires fresh explicit approval immediately before its destructive reset.
