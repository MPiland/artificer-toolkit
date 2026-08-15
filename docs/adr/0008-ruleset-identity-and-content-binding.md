# ADR 0008: Explicit ruleset identity and active content binding

- **Status:** decision
- **Date:** 2026-07-13
- **Scope:** systems, engine selection, authored references, Builder/Sheet assembly, and future rules implementations
- **Update when:** a rules system/version is added, content pinning policy changes, or engine content references change
- **Verification:** `packages/shared/src/domains/engine/rulesRegistry.ts`; `packages/shared/src/domains/engine/snapshot.ts`; system schemas/repositories; character Sheet assembly and engine tests

## Context

A system ID identifies a content universe, but it does not by itself identify the rules implementation or version. Content references also need stable identity while following canonical active content.

## Decision

Systems expose an explicit `rulesetCode` and `rulesetVersion`. Application orchestration resolves that pair through a fail-closed registry before invoking the versioned embedded evaluator. D&D 5e 2014 is the first supported pair; an unknown pair is an error, not an implicit D&D fallback.

Current structural character selections store stable authored root IDs and resolve against `ACTIVE` content. Equipment inputs additionally use a discriminated `ContentRef`; current assembly supplies `ACTIVE` and the compiled item. Other exact compiled inputs are supplied through the assembly registry. Authored subject revision history remains unsupported. Rule packs are the deliberate exception: activated rule-pack revisions are immutable. A Character pins the exact activated revision, checksum, evaluator kind/version, and model-contract version when first finalized; an Encounter keeps its existing exact pin. Retirement never invalidates either pin. See [ADR 0019](0019-versioned-cross-domain-rules-runtime.md).

## Consequences

Draft Character previews use the current compatible active revision. Finalization transactionally rechecks and pins that exact revision, so a later active-pack change never silently changes an existing Character; explicit upgrade preview/reconciliation commands create a new stream version. Rule-pack pinning does not introduce general Campaign or authored-content revision history; authored content continues to follow current or Campaign bindings. The transitional TypeScript engine is a parity oracle only and is removed after the migration gates in ADR 0019.
