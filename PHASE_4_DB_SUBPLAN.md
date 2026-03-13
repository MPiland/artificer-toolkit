# Phase 4: Kysely-First Database Layer

## Objective

Make `packages/db` the canonical server-side persistence layer using Kysely repositories, typed upserts, query functions, and SQL ETL assets behind clean interfaces.

## Architectural Rules

- Kysely stays server-side only
- raw SQL files remain persistence assets, not app-facing contracts
- repositories expose typed functions, not raw query builder details to clients
- domain-to-db mapping is explicit

## Workstreams

1. stabilize DB helper exports and client types
2. define repository interfaces
3. define mapper boundaries between domain and DB rows
4. rebuild upserts by domain
5. rebuild read queries by domain
6. define transaction patterns for multi-entity writes

## Rollout Order

1. shared/common persistence
2. grants
3. features
4. subjects
5. effects
6. character-specific persistence

## Deliverables

- repository layer design
- upsert/query rollout plan
- ETL integration rules
- transaction strategy
