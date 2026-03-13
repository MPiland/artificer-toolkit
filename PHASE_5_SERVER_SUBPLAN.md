# Phase 5: Server/Application Layer - Internal Reorganization

## Objective

Reorganize `packages/functions` to have a clean separation between typed query modules and use-case orchestration services. Wire the explicit compile-to-assemble data flow. No new package is created during this phase.

## Key Framing

`packages/functions` currently blends two concerns:

- `src/queries/`: typed Kysely query builders organized by domain
- `src/runtime/assemblers/character/`: character assembly logic that belongs in a services layer

The fix is an internal reorganization, not a package split. The `packages/functions` to `packages/server` rename executes after Phase 7 is complete.

## Tasks

### 1. Introduce `src/services/`

Create `packages/functions/src/services/` as the home for use-case orchestration modules.

### 2. Move Character Assemblers Into Services

Move `src/runtime/assemblers/character/` into `src/services/character/` and update internal imports.

### 3. Keep `src/queries/` Unchanged

The existing query builder files stay in place.

### 4. Wire the Compile to Assemble Data Flow

Define and implement the explicit data contract connecting:

- `CompiledCharacterIntent`
- `CharacterAssemblyInput`
- `ResolvedCharacterState`

### 5. Introduce Authoring Use-Case Services

Create initial use-case modules in `src/services/` for:

- subjects
- grants
- features

Each service composes schema validation, compile, and upsert/repository calls.

### 6. Package Rename Deferred Trigger

The `packages/functions` to `packages/server` rename executes after Phase 7 is complete once API routes are stable and consuming these services.

## Package Dependency Rules

`packages/functions` may depend on:

- `packages/shared`
- `packages/schema`
- `packages/db`

`packages/functions` must not depend on:

- `apps/apis`
- `apps/web`

## Exit Criteria

- `src/services/` exists with at least character assembly and one authoring use case
- character assemblers have moved into `src/services/character/`
- `src/queries/` remains unchanged
- the compile-to-assemble data contract is implemented as typed TypeScript
- Phase 6 engine has a defined typed input from this layer
- `packages/functions` typechecks cleanly

## Handoff Note

Use `vitest` for service orchestration tests in this phase. Favor tests around validation-to-compile-to-persistence orchestration and character assembly boundaries rather than low-level query-builder behavior, which remains covered in Phase 4.
