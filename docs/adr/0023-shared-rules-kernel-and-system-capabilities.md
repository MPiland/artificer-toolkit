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
3. A reviewed platform-owned Game System module composes independently owned typed subcontracts into
   named mechanics. The Rules Runtime sub-contract declares authored root adapters, definition
   families, fact contracts, and code-owned operation contracts only. Authoring owns recipes;
   Campaign, Character, and Encounter own settings, state, and reconciliation; VTT owns semantic
   capabilities. Unsupported subcontracts are absent and consumers fail closed rather than infer
   D&D equivalents.

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

An owned authored Effect UUID is itself an executable entry-point definition identity; it is not
duplicated into a reusable-definition row merely to make it discoverable. Game System adapters discover
those entry points from current typed source data and retain separate aggregate/source-instance
identity. Reusable definitions remain for mechanics shared independently across owning domain items.
The shared discovery layer compiles an authored Effect before a System adapter derives policy facts;
an adapter cannot substitute a different compiled Effect.

Repository-owned TypeScript implements bounded pure formulas and tables behind typed operations.
Application services own authorization, I/O, persistence, transactions, clocks, and random
generation. Arbitrary authored scripts, user-created Game Systems, and user-installable rule plugins
remain forbidden.

Operations are code-owned and have one of three execution kinds: `PURE`, `EVIDENCE`, or `PROPOSAL`.
A proposal has the same bounded typed scalar ports and deterministic execution as a pure operation, but
the Kernel only records it in the execution trace. The aggregate-owning application service may apply
registered proposal meaning only after COMPLETE with a registered domain applicator, inside the same
transaction after aggregate version CAS and occurrence transition, and before the aggregate-owned
rule receipt is written. A genuine domain projection event is part of that applicator step. Paused,
re-paused, and receipt-only COMPLETE executions retain the locked aggregate version and never emit a
domain projection event. Any failure rolls back the complete transaction; it never applies a paused
or replayed execution.

## Consequences

- Remove global D&D/edition model-key dispatch from the shared runtime.
- Make the bounded graph the production execution path rather than validation-only metadata.
- D&D 2014 is the first product System adapter; neutral fixtures prove kernel portability without
  shipping a second System.
- System-specific concepts such as attacks, spell slots, concentration, and reactions never become
  shared-kernel primitives.

Reusable definitions use family-owned typed documents. `rules-runtime-graph` is the executable graph
family; a family such as `sense` owns a closed data-composition document instead. A typed definition
may be consumed by a System adapter or bound into an executable graph, but it does not create another
graph format or runtime. Its UUID is behavioral identity; labels and codes remain display/search
metadata.

System vocabulary identities referenced by mechanics, including saving-throw abilities, are UUID-backed
and same-System constrained. Their codes and labels remain catalogue/policy metadata rather than
authored behavioral dispatch keys.

Bounded human choices use the code-owned `evidence.bounded-choice-index` operation. The Kernel
validates and records only the selected bounded index. UUID-backed option identity, labels,
authorization, redaction, and any interrupted domain command remain in the aggregate-owned sealed
application context. This keeps the primitive portable without turning reactions or another
System-specific decision family into Kernel behavior.

- The retired Rule Studio and GoRules pack-management code are not compatibility surfaces. Focused
  local tests and trace inspection remain ordinary development tools for the TypeScript Rules Kernel.

This decision supersedes the runtime ownership and immutable rule-pack selection portions of ADRs
[0008](0008-ruleset-identity-and-content-binding.md),
[0018](0018-embedded-rule-packs-and-encounter-resolution.md), and
[0019](0019-versioned-cross-domain-rules-runtime.md).
