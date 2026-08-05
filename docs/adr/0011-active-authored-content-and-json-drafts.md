# ADR 0011: Canonical active authored content with JSON drafts

- **Status:** decision
- **Date:** 2026-08-04
- **Scope:** authored root identity, drafts, activation, imports, and active persistence
- **Update when:** draft cardinality, activation concurrency, import identity, or root persistence changes
- **Verification:** `packages/db/src/domains/subjects`; `packages/functions/src/services/authoredContent`; import contracts and services under `packages/schema/src/api` and `packages/functions/src/services`

## Context

The authored-definition and immutable-revision tables duplicated identity, ownership, labels, and active state already present on the eight domain root tables. Product requirements need one replaceable edit draft for an active item and any number of unrelated new-item drafts, but do not require revision history.

Imports also need stable external identity without adding provider-specific columns to every domain table or character.

## Decision

Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle root tables are canonical active content. Their normalized child rows are owned parts of the same aggregate and are replaced transactionally by the existing aggregate upsert.

`authored_drafts` stores complete JSON draft payloads, ownership, labels, timestamps, and the active root timestamp observed when an edit began. A subject ID identifies a new draft or an edit of an active item. The primary key permits many new-item drafts while allowing only one draft per subject. Activation locks the draft, validates its base active timestamp, writes the active aggregate, and deletes the draft in the same transaction.

No immutable authored revision history is retained. A future history or audit requirement must introduce an explicit product contract rather than treating drafts as revisions.

`authored_import_refs` maps an owner, import source, subject kind, and external ID to an Artificer subject. It supports authored roots and characters without making imported identity part of canonical domain data. Labels are never identity.

## Consequences

Active reads use the domain repositories directly. Draft reads use `authored_drafts`; timestamps detect edit conflicts. Seeded content writes only canonical master aggregates. Portable exports omit ownership, internal timestamps, and lifecycle metadata, while import matching uses native IDs, external mappings, or exact seeded provenance.
