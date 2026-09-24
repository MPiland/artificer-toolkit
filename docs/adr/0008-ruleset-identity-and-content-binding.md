# ADR 0008: Explicit ruleset identity and active content binding

- **Status:** historical — superseded by ADRs [0023](0023-shared-rules-kernel-and-system-capabilities.md)-[0025](0025-game-system-catalogues-and-encounter-blueprints.md)
- **Date:** 2026-07-13
- **Scope:** systems, engine selection, authored references, Builder/Sheet assembly, and future rules implementations
- **Update when:** a rules system/version is added, content pinning policy changes, or engine content references change
- **Verification:** `packages/shared/src/domains/engine/rulesRegistry.ts`; `packages/shared/src/domains/engine/snapshot.ts`; system schemas/repositories; character Sheet assembly and engine tests

## Context

A system ID identifies a content universe, but it does not by itself identify the rules implementation or version. Content references also need stable identity while following canonical active content.

## Decision

Systems expose an explicit `rulesetCode` and `rulesetVersion`. Application orchestration resolves that pair through a fail-closed registry before invoking the versioned embedded evaluator. D&D 5e 2014 is the first supported pair; an unknown pair is an error, not an implicit D&D fallback.

Structural Character selections store stable authored root IDs. Draft previews and newly added sources resolve current `ACTIVE` owner, Master, or direct Campaign-shared content. First finalization stores exact immutable authored-version identities/checksums; later active-pointer changes do not invalidate them, and only an explicit reviewed upgrade repins. Equipment inputs additionally use a discriminated `ContentRef`; exact compiled inputs are supplied through the assembly registry. Rule packs follow the same explicit pin principle: a Character pins the exact activated revision, checksum, evaluator kind/version, and model-contract version when first finalized; an Encounter keeps its existing exact pin. Retirement never invalidates either pin. See [ADR 0019](0019-versioned-cross-domain-rules-runtime.md) and [ADR 0022](0022-versioned-domain-documents-and-correctness-projections.md).

## Consequences

Draft Character previews use current compatible active rule and authored versions. Finalization transactionally rechecks and pins those exact immutable inputs, so later rule-pack or authored-root activation never silently changes an existing Character; explicit upgrade preview/reconciliation commands create a new stream version. Direct Campaign shares remain revocable root authority rather than version bindings. The former TypeScript engine served only as the migration parity oracle and was deleted after the ADR 0019 gates passed.
