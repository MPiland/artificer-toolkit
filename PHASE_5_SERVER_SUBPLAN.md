# Phase 5: Server/Application Layer - Internal Reorganization

## Objective

Reorganize `packages/functions` to have a clean separation between typed query modules and use-case orchestration services. Wire the explicit compile-to-assemble data flow. No new package is created during this phase.

## Status

- Phase 5 is now in progress.
- Initial reorganization slice completed on 2026-03-16:
  - `src/services/` introduced.
  - character assemblers moved to `src/services/character/`.
  - explicit compile-to-assemble contract wired via `CharacterAssemblyInput` and `ResolvedCharacterState` service types.
  - initial authoring-service modules created for subjects, grants, and features.

## Key Framing

`packages/functions` currently blends two concerns:

- `src/queries/`: typed Kysely query builders organized by domain
- `src/runtime/assemblers/character/`: character assembly logic that belongs in a services layer

The fix is an internal reorganization, not a package split. The `packages/functions` to `packages/server` rename executes after Phase 7 is complete.

## Tasks

### 1. Introduce `src/services/`

Create `packages/functions/src/services/` as the home for use-case orchestration modules.

Status: complete (initial structure and exports are in place).

### 2. Move Character Assemblers Into Services

Move `src/runtime/assemblers/character/` into `src/services/character/` and update internal imports.

Status: complete (character assembler modules now live under `src/services/character/`).

### 3. Keep `src/queries/` Unchanged

The existing query builder files stay in place.

Status: complete for this slice (no query modules changed).

### 4. Wire the Compile to Assemble Data Flow

Define and implement the explicit data contract connecting:

- `CompiledCharacterIntent`
- `CharacterAssemblyInput`
- `ResolvedCharacterState`

Status: complete for baseline contract (`src/services/character/contract.ts` now defines the explicit assembly boundary and resolver).

### 5. Introduce Authoring Use-Case Services

Create initial use-case modules in `src/services/` for:

- subjects
- grants
- features

Each service composes schema validation, compile, and upsert/repository calls.

Status: in progress (initial service pipeline modules exist for subjects/grants/features; concrete route/use-case wiring is next).

### 6. Package Rename Deferred Trigger

The `packages/functions` to `packages/server` rename executes after Phase 7 is complete once API routes are stable and consuming these services.

Status: deferred (unchanged).

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

Current handoff snapshot (2026-03-16):

- First Phase 5 reorganization slice has landed in `packages/functions/src/services/`.
- Character assembly now exposes a typed compile-to-assemble resolver contract under `src/services/character/contract.ts`.
- Next slice should wire concrete subject/grant/feature authoring services into calling surfaces and add vitest coverage for orchestration boundaries.
- TypeScript build diagnostics note:
  - use project-build mode for verbose tracing: `yarn tsc --build packages/functions/tsconfig.build.json --verbose`
  - if Node heap pressure appears during verbose builds, rerun with a larger heap in PowerShell:
    - `$env:NODE_OPTIONS='--max-old-space-size=12288'; yarn tsc --build packages/functions/tsconfig.build.json --verbose --extendedDiagnostics`
