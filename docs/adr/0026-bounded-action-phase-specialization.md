# 0026 — Bounded action-phase specialization

Status: decision

## Context

An immutable authored Effect can declare a test and scaled dice outcomes, but the exact target,
actor level, class level, and cast level are available only after the action is authorized at play
time. Asking every possible outcome branch for dice evidence before an attack or save resolves is
incorrect and leaks unavailable outcomes.

## Decision

The shared Rules Kernel remains a single-stage evaluator per graph. An owning action occurrence may
coordinate exactly two ordered specialized graphs: `TEST`, then optional `OUTCOME`. The server binds
only declared typed fact ports after locking current source/actor/target facts. It seals the template
identity/checksum, canonical bound-facts checksum, and specialized checksum. The `TEST` phase selects
one authored path; only that path may produce an `OUTCOME` graph and dice evidence.

Pending occurrences retain the sealed current graph only while paused. Terminal receipts retain phase
identities, checksums, evidence, and result, never executable continuation state. Aggregate mutation,
resource consumption, and event writes occur only after the terminal phase succeeds.

## Consequences

This supports real fixed and scaled authored dice without client formulas, runtime topology mutation,
or a second engine. It deliberately does not create a general workflow engine: the maximum is two
phases for this action contract, and concentration or other follow-ups remain separate occurrences.

The 2026-09-15 Concentration ruling retains this boundary. Published maintenance definition c3 links
the published damage-check graph c2; spells reference c3 and feature save modifiers may qualify by c3.
Damage checks remain deterministic child occurrences. A sealed Cleaving choice may wait for those
children to finish, without introducing a third action phase or a general workflow engine.
