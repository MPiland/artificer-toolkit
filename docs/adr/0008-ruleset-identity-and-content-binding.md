# ADR 0008: Explicit ruleset identity and content revision binding

- **Status:** decision
- **Date:** 2026-07-13
- **Scope:** systems, engine selection, authored references, Builder/Sheet assembly, and future rules implementations
- **Update when:** a rules system/version is added, content pinning policy changes, or engine content references change
- **Verification:** `packages/shared/src/domains/engine/rulesRegistry.ts`; `packages/shared/src/domains/engine/snapshot.ts`; system schemas/repositories; character Sheet assembly and engine tests

## Context

A system ID identifies a content universe, but it does not by itself identify the rules implementation or version. Content references also need stable identity while allowing products to either follow current content or pin an immutable revision.

## Decision

Systems expose an explicit `rulesetCode` and `rulesetVersion`. Application orchestration resolves that pair through a fail-closed registry before invoking the pure engine. D&D 5e 2014 is the first supported pair; an unknown pair is an error, not an implicit D&D fallback.

Current structural character selections store stable authored-definition IDs and resolve against `ACTIVE` content. Equipment engine inputs additionally use a discriminated `ContentRef` with system ID and `ACTIVE` or `REVISION(revisionId)` binding; MVP assembly supplies `ACTIVE` and the compiled item. Other exact compiled inputs are supplied through the assembly registry. Persisted binding fields and revision-aware loading for all character selections remain target work.

## Consequences

Compatible D&D-5e-family rulesets can reuse the current policy-injected kernel. Materially different games should register system-specific engine adapters and contracts rather than expanding the D&D-shaped kernel. Campaign or character revision pinning retains the stable definition identity, but adding it requires explicit persisted binding fields and revision-aware registry loading.
