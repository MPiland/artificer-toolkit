# Phase 5: Server/Application Layer

## Objective

Turn the current functions workspace into a real server/application layer that orchestrates domain logic, compilers, repositories, and character services.

## Responsibilities

- authoring use cases
- compile-preview and compile-persist flows
- character assembly services
- domain orchestration across repositories
- future tRPC procedure backing logic

## Rules

- keep transport out of this layer
- keep raw DB access inside the db layer
- keep pure rules logic inside the domain layer

## Deliverables

- service boundaries
- use-case module structure
- orchestration patterns for authoring and character flows
- migration path from current query-centric functions modules
