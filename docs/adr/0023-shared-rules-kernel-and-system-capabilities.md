# ADR 0023: Shared rules kernel and Game System capabilities

- **Status:** decision
- **Date:** 2026-08-24
- **Scope:** authored mechanics, runtime execution, Game System integration, and VTT rules ownership
- **Update when:** the primitive registry, rule graph, execution protocol, System capability contract, or runtime ownership changes
- **Verification:** neutral conformance fixtures, D&D vertical tracers, bounded-graph rejection, continuation/replay tests, and the Phase 08 acceptance ledger

## Context

The existing runtime selects global D&D-shaped model keys and immutable rule-pack revisions. That
couples Character, Encounter, and VTT orchestration to one edition vocabulary and makes future Game
Systems require application branches. A validated lifecycle DAG exists only as metadata; production
does not execute it. Artificer needs modular authored mechanics without allowing arbitrary code or a
user-installable plugin system.

## Decision

Use three explicit layers:

1. A shared Rules Kernel walks bounded typed graphs, requests facts or random evidence, pauses for
   bounded decisions, proposes state changes, and produces idempotent receipts.
2. A reusable mechanics library supplies typed operations such as comparisons, opposed tests, dice
   pools, result bands, contributor aggregation, spatial facts, and bounded state mutations.
3. A reviewed platform-owned Game System module composes those operations into named mechanics and
   declares supported authored domains, definition families, authoring recipes, Campaign settings,
   state shapes, and VTT capabilities.

```mermaid
flowchart LR
  Kernel[Shared Rules Kernel] --> Library[Reusable mechanics operations]
  Library --> System[Game System capability contract]
  System --> Definitions[UUID-backed definitions]
  Definitions --> Content[Authored domain items]
  Content --> Discovery[Runtime capability discovery]
  Discovery --> Execution[Runtime execution instance]
```

Publishing validates graph bounds, acyclicity, ports, primitive contract versions, UUID references,
same-System compatibility, and transitive dependencies. It does not bind an actor, target, Scene,
choice, roll, or result and does not create a persistent prepared execution plan. Runtime capability
discovery and execution bind all live facts.

Primitive/operator keys and contract versions are code-owned. Anything independently authored,
referenced, shared, overridden, or lifecycle-managed is UUID-backed. Inline values such as distance,
dice expressions, and shape dimensions remain typed values inside their owner.

Zen may implement bounded pure formulas or tables behind typed operations. Application services own
authorization, I/O, persistence, transactions, clocks, and random generation. Arbitrary authored
scripts, user-created Game Systems, and user-installable rule plugins remain forbidden.

## Consequences

- Remove global D&D/edition model-key dispatch from the shared runtime.
- Make the bounded graph the production execution path rather than validation-only metadata.
- D&D 2014 is the first product System adapter; neutral fixtures prove kernel portability without
  shipping a second System.
- System-specific concepts such as attacks, spell slots, concentration, and reactions never become
  shared-kernel primitives.
- Rule Studio is no longer a production admin product. Retain only a local/internal inspector,
  fixture runner, and trace surface.

This decision supersedes the runtime ownership and immutable rule-pack selection portions of ADRs
[0008](0008-ruleset-identity-and-content-binding.md),
[0018](0018-embedded-rule-packs-and-encounter-resolution.md), and
[0019](0019-versioned-cross-domain-rules-runtime.md).
