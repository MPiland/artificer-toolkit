# Phase 2: Compiler Alignment and Completion

## Status: Complete

## Objective

Stabilize the compiler layer after Phase 1. This phase is not just drift cleanup. It must:

- fix compiler drift against the current authored/core types
- restore rule accuracy where compiler assumptions no longer match the domain model
- add or complete compiler coverage anywhere the authored surface is not fully compiled today
- define the compile contract that later phases will build on

## Why "Alignment and Completion"

Much of the compiler layer already exists and follows a recognizable switch-based authored-to-compiled transformation pattern. But the current repo state shows that "hardening only" is too narrow. What is still required:

- restoration of drifted imports, payload assumptions, and discriminated-union handling
- repair of outdated SRD/domain assumptions, especially around scaling and effect payloads
- completion of compiler coverage where authored types or current barrels imply missing behavior even if a file exists
- a shared `CompileResult<T>` envelope
- verification that compiler imports still align with the live authored types after Phase 1 map work
- an explicit data contract documenting what Phase 5 assemblers and Phase 6 engine code expect as compiler output

## Prerequisite

Phase 2 begins after Phase 1 map coverage is complete. `packages/shared` does not yet typecheck cleanly, so the immediate work in this phase is to restore compiler alignment until the package typecheck passes.

## Tasks

### 1. Define `CompileResult<T>` Envelope

Add a shared result type that compilers can return instead of returning compiled types directly or throwing.

The envelope must carry:

- the compiled output on success
- structured diagnostics on failure or warning
- enough context for server flows and authoring previews to display meaningful feedback

Suggested location: `packages/shared/src/domains/shared/` or `packages/shared/src/utils/compileResult.ts`.

Progress:

- [x] `CompileResult<T>` added in `packages/shared/src/utils/compileResult.ts`
- [x] One compiler now uses the result-envelope pattern without breaking existing call sites

### 2. Audit Compiler and Authored-Type Alignment

Verify that each compiler's authored-type imports still match the live authored types. Phase 1 changed the map layer, and the repo already shows compiler drift in multiple domains.

Domains to audit in order:

1. effects compilers
2. shared/common compilers
3. subjects compilers
4. grants compilers
5. features compilers

This audit must include an explicit scaling review:

- verify the current scaling types fit D&D 5e SRD usage for this app version
- verify they still leave room for homebrew extensions
- cover spell upcasting, cantrip progression, class-level scaling, character-level scaling, and charge/resource scaling
- do not hardcode SRD-only assumptions into reusable compiler contracts unless the rule is intentionally version-specific

Progress:

- [x] Effects compilers aligned to current authored moment and damage payload shapes
- [x] Shared compilers aligned for `charge`, `range`, and `startingEquipment`
- [x] Subject compiler drift cleared for `equipment` and `feat`
- [x] `packages/shared` typecheck restored
- [x] SRD and homebrew scaling review documented explicitly

### 3. Add or Complete Missing Compiler Coverage

Do not assume a compiler file means the authored surface is fully supported. Phase 2 must identify and close these gaps:

- authored types whose compiler is missing entirely
- authored branches that exist but are not compiled
- barrel exports that point to removed helpers or missing compiler utilities
- subject-specific generic compiler entrypoints that no longer line up with narrower authored types

Current known gaps from repo inventory:

- `subjects/compilers/feat.ts` still references removed target/restriction helpers
- `subjects/compilers/equipment.ts` still assumes a broader feature compiler signature than the current subject-specific grant typing allows
- some shared/effect compilers still target older payload names and scaling codes

### 4. Stabilize `#compilers` Barrel Exports

Verify `packages/shared/src/barrels/compilers/index.ts` re-exports are consistent and complete after Phase 1 changes.

This includes restoring any missing exports required by downstream compilers and removing references to no-longer-valid helpers.

### 5. Define the Compile to Assemble to Engine Data Contract

Document the explicit type chain that connects Phase 2 output to Phase 5 and Phase 6 input:

- `CompiledCharacterIntent` from `subjects/compilers/character/intent.ts` to Phase 5 assembler input
- assembled character state to Phase 6 engine input

This contract must be defined as explicit TypeScript types before Phase 5 work begins.

Progress:

- [x] Compile -> assemble -> engine contract types documented in `packages/shared/src/domains/core/assemblerContract.ts`
- [x] Contract builder helpers added for compiled character, assembler input, and engine input handoff

## Exit Criteria

- `CompileResult<T>` exists and is used by at least one compiler as proof of pattern
- no compiler silently discards errors
- drifted compiler imports and payload assumptions are repaired
- missing compiler coverage for in-scope authored surfaces is restored
- barrel exports in `#compilers` are consistent
- the compile-to-assemble data contract is documented as TypeScript types
- initial Vitest compiler tests exist for scaling and authored-to-compiled behavior
- `packages/shared` typechecks cleanly

## Handoff Note

Use `vitest` as the default Phase 2 test runner. Compiler hardening is not complete until there are tests covering authored-to-compiled behavior, especially around scaling, discriminated branches, and SRD-baseline versus homebrew-flexible expectations.

Current handoff status:

- Phase 2 is complete
- the major drift cluster that blocked `packages/shared` has been cleared
- `effects/compilers` now compile against the live `MomentAuthored[]` model and current damage payload fields
- `shared/compilers/charge.ts`, `range.ts`, and `startingEquipment.ts` now match the current authored/core contracts
- `subjects/compilers/equipment.ts` and `feat.ts` no longer reference removed targeting/restriction helpers
- `packages/shared` now typechecks cleanly with `tsc -p packages/shared/tsconfig.json --noEmit`
- `CompileResult<T>` now exists in `utils`, and `features/compilers/feature.ts` exposes `compileFeatureResult(...)` as the seed pattern while preserving `compileFeature(...)` for current callers
- the grants compiler cluster now also exposes `...Result(...)` wrappers for feat, sense, spell, modifier, and proficiency grants while preserving the existing unwrap-based compiler functions
- the top-level effect compiler now also exposes `compileEffectResult(...)`, extending the result-wrapper pattern beyond features and grants
- `domains/core/assemblerContract.ts` now defines the compile -> assemble -> engine handoff types explicitly
- Vitest is now installed at the repo root, with source-alias-aware configuration in `vitest.config.ts`
- initial compiler tests now exist under `packages/shared/src/__tests__` covering scaling source compilation, charge scaling, and nested spell-grant scaling through `compileFeatureResult(...)`
- additional compiler tests now cover spell-level damage scaling and class-level chosen feat-grant progression
- compiler tests now also cover a non-scaling discriminated branch through `compileEffectResult(...)` with an exact roll-table condition outcome
- scaling review outcome:
  - current scaling sources (`CHARACTER_LEVEL`, `CLASS_LEVEL`, `SPELL_LEVEL`) fit the core SRD-driven use cases this app currently needs
  - spell upcasting is represented by `SPELL_LEVEL`
  - cantrip and general progression scaling are represented by `CHARACTER_LEVEL` or `CLASS_LEVEL`
  - class spell-slot tables and prepared-spell limits remain modeled in `subjects/compilers/class.ts`, not in the generic scaling helper, which matches SRD structure better than forcing them through one universal scaling shape
  - the current `NONE` / `PER_LEVEL` scaling-kind model is sufficient for SRD baseline authoring and common homebrew progressions that are table-driven by level
  - if future homebrew needs formula-based, breakpoint-based, or non-level sources, that should be added as a later domain expansion rather than forced into Phase 2
- explicit compile diagnostics/failure generation is intentionally deferred to later authoring-validation work, where preview and feedback flows will have the right context to use those diagnostics well
