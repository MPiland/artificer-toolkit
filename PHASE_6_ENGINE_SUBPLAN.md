# Phase 6: Character Engine

## Objective

Complete the character engine as a deterministic domain subsystem that can power authoring previews, web character sheets, and a future mobile companion app consistently.

## Engine Pipeline

1. base character intent and authored selections
2. source acquisition
3. feature and grant resolution
4. modifier and effect application
5. derived stat calculation
6. state transition handling

## Constraints

- engine logic remains pure and deterministic
- persistence remains outside the engine boundary
- output contracts must be reusable by both web and future mobile clients

## Deliverables

- engine state model
- resolution order
- transition handling strategy
- server/persistence integration contract
