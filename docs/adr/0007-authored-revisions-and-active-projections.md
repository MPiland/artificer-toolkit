# ADR 0007: Immutable authored revisions with normalized active projections

- **Status:** decision
- **Date:** 2026-07-13
- **Scope:** authored root identity, drafts, activation, persistence, and SRD master synchronization
- **Update when:** revision payloads, activation semantics, root taxonomy, projection writes, or master seeding changes
- **Verification:** `packages/db/src/domains/subjects/tables/authored_definitions.sql`; `packages/db/src/domains/subjects/repositories/authoredDefinition.ts`; `packages/functions/src/services/authoredContent`; root aggregate upserts and round-trip tests

## Context

Authors need recoverable drafts and deterministic activation without exposing normalized child tables. The relational shape is useful for queries and hydration, but treating both JSON drafts and normalized rows as independent truth creates drift. Independently versioning every feature, option, grant, and effect would also make one authored edit span an unnecessary revision graph.

## Decision

Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle are the revisioned authored roots. Each has one stable authored-definition identity and immutable complete-payload revisions. A definition points to one active revision and at most one replaceable draft revision.

Features, feature options, grants, effects, outcomes, details, and other children are owned parts of the root payload. They retain stable child IDs for references and persistence but do not receive independent definition/revision lifecycles.

Copying master or owned content creates a new, independent owned definition and remaps IDs inside the aggregate. MVP copies do not retain a live inheritance/provenance link to the source; subsequent source revisions cannot silently change the copy.

Normalized domain tables are active query projections. Activation validates and normalizes the draft payload, replaces the owning aggregate projection, and promotes that exact revision within one transaction. Seeded SRD roots use the same authored shapes and synchronize master revisions with their projections. A system baseline bundle is authoritative for that system's master roots: synchronization removes master projections, revisions, and route identities omitted from the bundle while preserving owned content and masters from other systems.

## Consequences

Draft recovery and history are exact, repositories remain efficient, and child ownership stays comprehensible. A projection is conceptually rebuildable from the active payload, but typed active-revision reads and a rebuild use case remain target work; current recovery is an operator/manual database procedure. Application code must not update active projections without the corresponding activation/master-sync operation.
