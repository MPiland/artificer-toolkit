# Phase 6: Character Engine

## Objective

Implement a deterministic, pure character engine that resolves compiled character intent into derived character state. The engine is system-agnostic by design. D&D 5e 2014 SRD is the first concrete implementation, not the engine itself.

## System-Agnostic Architecture Requirement

The engine must treat the ruleset as a pluggable configuration from day one.

The engine operates against a `RulesSystem` interface that provides:

- bonus stacking rules per stat
- resolution order for grants, modifiers, and effects
- derived stat calculation formulas
- proficiency bonus calculation
- any other system-specific mechanical rules

The D&D 5e 2014 SRD implementation is a concrete `RulesSystem`, not the engine itself.

## Mandatory Pre-Implementation Deliverable

Before engine code is written, a rule-ordering document for D&D 5e 2014 SRD must exist and be reviewed.

This document defines:

- feature acquisition order
- grant application order
- modifier stacking rules
- effect resolution order
- derived-stat calculation precedence

It becomes the correctness contract for the 5e 2014 engine implementation and the reference template for future system implementations.

## Prerequisites

- Phase 4 SRD seed data must be loadable
- Phase 5 compile-to-assemble data contract must be defined

## Implementation Tasks

### 1. Define `RulesSystem` Interface

Location: `packages/shared/src/domains/engine/`.

### 2. Implement `dnd5e2014` Rules System

A concrete implementation of `RulesSystem` derived directly from the rule-ordering document.

### 3. Define Engine State Model

The engine input should include:

- compiled character intent
- assembled feature and grant data
- active `RulesSystem` implementation

### 4. Implement Resolution Pipeline

Follow the rule-ordering document:

1. feature acquisition
2. grant application
3. modifier stacking
4. effect application
5. derived-stat calculation

### 5. Derived Stat Calculation

Calculate at minimum:

- hit points
- armor class
- attack bonuses
- saving throw bonuses
- skill bonuses
- proficiency bonus

### 6. Keep Engine Pure

- no persistence calls inside the engine
- no side effects
- deterministic output
- plain typed output object

## Exit Criteria

- the D&D 5e 2014 SRD rule-ordering document exists before engine implementation
- `RulesSystem` is defined
- `dnd5e2014` conforms to `RulesSystem`
- the engine produces identical derived stats from identical inputs
- the engine is pure
- the rule-ordering document is referenced in the implementation

## Handoff Note

Use `vitest` for engine determinism tests. The engine must be tested against SRD-baseline expectations for this app version while preserving homebrew-flexible architecture boundaries, so tests should verify behavior without collapsing the engine into SRD-only assumptions.
