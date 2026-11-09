# ADR 0042: Tree-shakable System capability registries

- **Status:** accepted (orchestrator ruling 2026-11-09; PERF-6.T12, AC PERF-6.2)
- **Date:** 2026-11-09
- **Scope:** `packages/rules-runtime/src/platform*.ts`, `packages/rules-runtime/src/systems/installedGameSystems/`, each installed System's tier modules, `apps/apis/tests/functionBundleBudget.test.ts`
- **Amends:** [ADR 0039](0039-composable-system-neutral-rules-engine.md) decision 5 (how a capability registry is composed, not what it does) and D195 ("each System exports one module object per tier")
- **Verification:** `functionBundleBudget.test.ts` bundle-size bars; the source ratchet and the tracer Vitest project unchanged

## Context

Every Convex call evaluates its module's whole bundle, and a cold isolate also compiles it (D59). A capability registry is built at module load from one installed list per load tier, and each System's tier is one object literal that holds every adapter of that tier. A function that needs one registry therefore bundles every adapter of the tier, for every installed System.

Measured on `campaigns/characterReconcileSteps.ts` after the narrow Character effects port (2,917 KB):

- dnd5e code in the bundle: 541 KB. The encounter tier alone is 346 KB (`effectActionCompiler` 95 KB is the largest module); the step uses two encounter registries (`attackProfile`, `modifierScope`, via `encounterActiveGrants`).
- With every tier emptied the bundle is 2,388 KB (−529 KB); the executed character policy is the part the step really needs.
- The same edge sits under every herd query that reads Encounter state (PERF-6.T11 diagnosis: `encounters/activeReads.ts` 2,040 KB).

Dynamic `import()` is not an option: Convex documents dynamic imports as unsupported in its default runtime, esbuild without splitting inlines them anyway (PERF-6.T11 probe: 2,040 → 2,203 KB), and it would make every registry lookup async.

## Decision

1. **One installed list per capability, not per tier.** `installedGameSystems/<tier>.ts` exports one list per capability (for example `installedModifierScopes`), each spreading the matching export of every installed System. These files stay the only place that names a System, and the `platform*.ts` files stay the only composition roots (D195, source ratchet).
2. **A System declares a tier as named exports, one per capability,** typed by the tier's capability contract (`GameSystemEncounterTier['modifierScope']`), instead of one object literal. The tier interface stays the System author's contract: each installed list file asserts every installed System's tier module against it with a type-only check, `type _Dnd5eEncounterTier = SystemTierModule<typeof import('../dnd5e/encounterTier.js'), GameSystemEncounterTier>`, which keeps no runtime reference to the namespace object.
3. **Registries are pure at module load.** Each `createSystemCapabilityRegistry(...)` call in a `platform*.ts` file is annotated `/* @__PURE__ */`, so a bundle that does not import a registry drops it and the adapters only it reaches. Registry behaviour (`require` fails closed, `find` skips) is unchanged.
4. **No System-neutral module imports a System.** The dnd5e edges move into that System's tier, behind generic capabilities that any System could fill. Don't add a capability shaped around one dnd5e rule unless it's a real rules concept. This change moves:
   - `characterActionRuleFacts` and the creature action discovery onto an `attackRestriction` policy capability (reduce an effect's restrictions for the attacking equipment).
   - `characterSpellCastActions` onto a `spellCast` policy capability (adapt a cast effect to the caster's modifiers; a duration's length in turns).
   - `characterRuleRollProjection` into dnd5e's Character tier, as its `resolveCharacterRollModes`.

   Two edges remain in the unfenced `character/` folder and are follow-ups: `builderHitPoints` (`parseHitDie`) and `characterRuleSnapshot` (dnd5e armor class).

5. **Bundle size is a deterministic gate.** `functionBundleBudget.test.ts` carries bundle-size bars for the reconcile step and `encounters/activeReads`, set from the measured size with headroom; both are red against the phase code.

The tracer Vitest project keeps aliasing the installed lists (now per capability), and the tracer still installs only the capabilities it has.

## Consequences

- Platform modules that need one capability no longer pay for a tier. Measured: the reconcile step 3,190 → 2,829 KB, `encounters/activeReads` 2,040 → 1,826 KB. Most of the remaining dnd5e code in the step (469 KB) is live through Sheet derivation. PERF-6.T11's move of the polygon union out of the shared vtt barrel takes about 53 KB more off each.
- Adding a System means adding one spread per capability in the installed lists, instead of one list entry per tier. That is more lines, and each one is explicit.
- Tree-shaking now depends on the pure annotations and on adapter modules having no top-level side effects. The bundle-size bars catch a regression.
- Cold p95 is recorded, not gated; the gates are the bundle bars and zero step timeouts on the CI membership proof.
- Bundle bytes are only part of a cold call. Measured locally on the replayed step: module compile and top-level evaluation are about half of a cold run, and the first execution of the Builder and rules code is most of the rest. This ADR fixes the System boundary; it does not by itself bring a cold call under a wall-clock bar.

## Alternatives

- **Lazy registry through dynamic `import()`:** rejected (see Context).
- **Keep tier objects and split the tiers further:** each new tier is a guess about which capabilities travel together; per-capability lists make that question disappear.
- **`sideEffects: false` on the workspace packages:** worth −222 KB on the step, but it changes how every package bundles; out of scope here and the next lever.
