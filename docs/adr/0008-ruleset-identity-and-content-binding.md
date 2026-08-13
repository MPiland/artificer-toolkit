# ADR 0008: Explicit ruleset identity and active content binding

- **Status:** decision
- **Date:** 2026-07-13
- **Scope:** systems, engine selection, authored references, Builder/Sheet assembly, and future rules implementations
- **Update when:** a rules system/version is added, content pinning policy changes, or engine content references change
- **Verification:** `packages/shared/src/domains/engine/rulesRegistry.ts`; `packages/shared/src/domains/engine/snapshot.ts`; system schemas/repositories; character Sheet assembly and engine tests

## Context

A system ID identifies a content universe, but it does not by itself identify the rules implementation or version. Content references also need stable identity while following canonical active content.

## Decision

Systems expose an explicit `rulesetCode` and `rulesetVersion`. Application orchestration resolves that pair through a fail-closed registry before invoking the pure engine. D&D 5e 2014 is the first supported pair; an unknown pair is an error, not an implicit D&D fallback.

Current structural character selections store stable authored root IDs and resolve against `ACTIVE` content. Equipment engine inputs additionally use a discriminated `ContentRef`; current assembly supplies `ACTIVE` and the compiled item. Other exact compiled inputs are supplied through the assembly registry. Authored subject revision history remains unsupported. Rule packs are the deliberate exception: activated rule-pack revisions are immutable and an Encounter pins their exact identity and checksum under [ADR 0018](0018-embedded-rule-packs-and-encounter-resolution.md).

## Consequences

Compatible D&D-5e-family rulesets can reuse the current policy-injected kernel. Materially different games should register system-specific engine adapters and contracts rather than expanding the D&D-shaped kernel. Rule-pack pinning does not introduce general Campaign, Character, or authored-content revision history; those would still require separate explicit products and binding fields.
