# ADR 0009: VTT encounter events are separate from character Sheet history

- **Status:** decision — Encounter event ownership retained; SQL, rule-pack, and transaction topology superseded by ADRs 0023, 0024, and 0029; Session-bound Runs superseded by Campaign-owned Runs in [ADR 0033](0033-campaign-owned-play-and-session-log.md)
- **Date:** 2026-08-09
- **Scope:** Encounter templates, Session-bound runs, actor state, event timelines, character commands, and pure rules evaluation
- **Update when:** encounter persistence, action resolution, initiative/turn state, timeline visibility, or replay changes
- **Verification:** `apps/apis/convex/encounters`; `packages/rules-runtime/src/encounter*.ts`; `packages/schema/src/api/encounters.ts`; Character Sheet command/event modules

> The aggregate and event-ownership boundaries remain current. References below to SQL filtering, database constraints, immutable rule packs, and the former transaction topology are historical implementation context superseded by [ADRs 0023](0023-shared-rules-kernel-and-system-capabilities.md), [0024](0024-current-published-authored-content.md), and [0029](0029-convex-backend-cutover.md).

## Context

Character Sheet commands record mutations to one character's play state. A virtual tabletop must coordinate multiple actors, turns, targets, actions, rolls, reactions, and outcomes. Expanding character events to carry that encounter lifecycle would couple two aggregates and make replay/authorization ambiguous.

## Decision

The VTT uses a separate Encounter aggregate and append-only Encounter event model. Encounter orchestration loads Character, Creature, and Encounter-local custom actor snapshots and calls pure rules/effect functions, while the character engine remains deterministic and persistence-free. Character Sheet events continue to represent Character-owned state changes only. The Encounter projection owns prepared/active/completed state, manual or rolled initiative, deterministic ties, manual reorder, and manual current turn/round state; these are not Sheet history.

Template creation is retry-idempotent per Campaign and command ID. The persisted command fingerprint distinguishes an identical retry from a divergent reuse; the database unique constraint and conflict-safe insert close concurrent races. Enemy inputs are bounded before snapshot resolution, and the resolved snapshot has an encoded-size limit so a template cannot create unbounded database or engine work.

Encounter timelines are actor-aware at the repository boundary. For a non-owner viewer, the TABLE visibility predicate is applied in SQL before cursor ordering and page limits. Private events therefore cannot consume a page and hide later visible events.

Authored effects and outcomes describe mechanics; they are not persisted encounter events. An eventual effect executor must produce explicit proposed outcomes that encounter orchestration validates and records.

Each new Encounter pins an activated rule-pack revision. `RESOLVE_ACTION` evaluates that exact immutable document, permits one application-owned roll stage, validates typed targets and outcomes, and records the revision checksum plus resolution evidence in the same transaction as any Encounter- or Sheet-owned mutation. Encounter command events are not trimmed because they are also durable idempotency receipts and the only exact rule-resolution audit record. Timeline pagination remains bounded independently of retention.

## Consequences

Character play remains usable without a VTT, Encounter replay can be authoritative for the table, and rules logic can be shared without sharing persistence ownership. Correlated Character mutations lock both aggregates and commit the Encounter event plus Character command in one transaction, or neither. No universal event abstraction is introduced.
