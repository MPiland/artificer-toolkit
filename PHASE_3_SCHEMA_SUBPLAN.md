# Phase 3: Schema and DTO Boundary Plan

## Objective

Create a dedicated schema layer for runtime validation and transport-safe contracts without forcing all internal domain types through Zod.

## Scope

### Put in Zod

- authored inputs that cross API or persistence boundaries
- API request and response DTOs
- server-to-client data contracts
- form-facing validation schemas where shared validation is valuable

### Keep as TS-only

- internal generic helpers
- internal compiler utility types
- internal map DSL types
- deep internal engine implementation details

## Goals

- separate internal domain types from transport DTOs
- support web and future mobile clients with shared contracts
- make future tRPC adoption straightforward

## Deliverables

- schema package responsibilities
- DTO inventory by domain
- Zod adoption rules
- migration strategy from current ad hoc schema usage
