# Phase 2: Compiler Contracts and Rebuild

## Objective

Rebuild compilers around stable authored and compiled contracts after the workspace boundaries and node-map layer have been stabilized.

## Goals

- define authored-to-compiled transformations clearly
- separate validation from transformation
- restore missing compiler exports and remove stale ones
- provide compile results that are useful to server flows and authoring UI

## Compiler Contract

Each compiler should:

- accept authored domain input
- validate shape and semantic invariants
- emit compiled domain output
- return structured diagnostics when compilation fails or produces warnings

## Required Outputs

- stable compiler entrypoints per domain
- shared compile result and error model
- restored barrel exports for compiler consumers
- domain rollout order aligned with node-map readiness

## Rollout Order

1. shared/common compilers
2. grants compilers
3. features compilers
4. subjects compilers
5. effects compilers

## Deliverables

- compiler entrypoint definitions
- compile result contract
- validation/error strategy
- domain-by-domain migration sequence
