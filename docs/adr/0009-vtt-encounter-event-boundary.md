# ADR 0009: VTT encounter events are separate from character Sheet history

- **Status:** decision
- **Date:** 2026-07-13
- **Scope:** future virtual tabletop orchestration, encounter state, character commands, and pure rules evaluation
- **Update when:** encounter persistence, action resolution, initiative/turn state, or VTT replay is implemented
- **Verification:** `packages/shared/src/domains/engine`; character Sheet command/event modules; future encounter module and tests

## Context

Character Sheet commands record mutations to one character's play state. A virtual tabletop must coordinate multiple actors, turns, targets, actions, rolls, reactions, and outcomes. Expanding character events to carry that encounter lifecycle would couple two aggregates and make replay/authorization ambiguous.

## Decision

Future VTT work will use a separate encounter aggregate and append-only encounter event model. Encounter orchestration may load actor snapshots and call pure rules/effect functions, but the character engine remains deterministic and persistence-free. Character Sheet events continue to represent character-owned state changes only.

Authored effects and outcomes describe mechanics; they are not persisted encounter events. An eventual effect executor must produce explicit proposed outcomes that encounter orchestration validates and records.

## Consequences

Character play remains usable without a VTT, encounter replay can be authoritative for the table, and rules logic can be shared without sharing persistence ownership. No encounter tables or speculative universal event abstraction are added during MVP character/content work.
