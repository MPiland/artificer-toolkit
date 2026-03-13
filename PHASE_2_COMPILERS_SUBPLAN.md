# Phase 2: Compiler Hardening

## Objective

Harden the existing compiler layer after Phase 1 map migrations are complete. The compilers are architecturally sound. This is not a rebuild. The work is targeted: add a structured result envelope, audit for drift introduced by Phase 1, and define the data contract that feeds Phases 5 and 6.

## Why "Hardening" Not "Rebuild"

All major domain compilers exist and follow a consistent switch-based authored-to-compiled transformation pattern. The logic is broadly in place. What is missing:

- a shared `CompileResult<T>` envelope
- verification that compiler imports still align with the live authored types after Phase 1 map work
- an explicit data contract documenting what Phase 5 assemblers and Phase 6 engine code expect as compiler output

## Prerequisite

Phase 2 does not begin until Phase 1 is complete and `packages/shared` typechecks cleanly. Map migrations in Phase 1 may alter authored types that compilers consume, so the alignment audit in Phase 2 depends on those changes being stable.

## Tasks

### 1. Define `CompileResult<T>` Envelope

Add a shared result type that compilers can return instead of returning compiled types directly or throwing.

The envelope must carry:

- the compiled output on success
- structured diagnostics on failure or warning
- enough context for server flows and authoring previews to display meaningful feedback

Suggested location: `packages/shared/src/domains/shared/` or `packages/shared/src/utils/compileResult.ts`.

### 2. Audit Compiler and Authored-Type Alignment

After Phase 1 migrations are complete, verify that each compiler's authored-type imports still match the live authored types. Phase 1 may have updated authored shapes as part of map rewrites.

Domains to audit in order:

1. shared/common compilers
2. grants compilers
3. features compilers
4. subjects compilers
5. effects compilers

This audit must include an explicit scaling review:

- verify the current scaling types fit D&D 5e SRD usage for this app version
- verify they still leave room for homebrew extensions
- cover spell upcasting, cantrip progression, class-level scaling, character-level scaling, and charge/resource scaling
- do not hardcode SRD-only assumptions into reusable compiler contracts unless the rule is intentionally version-specific

### 3. Stabilize `#compilers` Barrel Exports

Verify `packages/shared/src/barrels/compilers/index.ts` re-exports are consistent and complete after Phase 1 changes.

### 4. Define the Compile to Assemble to Engine Data Contract

Document the explicit type chain that connects Phase 2 output to Phase 5 and Phase 6 input:

- `CompiledCharacterIntent` from `subjects/compilers/character/intent.ts` to Phase 5 assembler input
- assembled character state to Phase 6 engine input

This contract must be defined as explicit TypeScript types before Phase 5 work begins.

## Exit Criteria

- `CompileResult<T>` exists and is used by at least one compiler as proof of pattern
- no compiler silently discards errors
- barrel exports in `#compilers` are consistent
- the compile-to-assemble data contract is documented as TypeScript types
- `packages/shared` continues to typecheck cleanly

## Handoff Note

Use `vitest` as the default Phase 2 test runner. Compiler hardening is not complete until there are tests covering authored-to-compiled behavior, especially around scaling, discriminated branches, and SRD-baseline versus homebrew-flexible expectations.
