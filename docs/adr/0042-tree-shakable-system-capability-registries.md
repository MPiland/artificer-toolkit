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
2. **A System declares a tier as named exports, one per capability,** typed by the tier's capability contract (`GameSystemEncounterTier['modifierScope']`), instead of one object literal. The tier interface stays the System author's contract. Each installed list file asserts every installed System's tier module against `Required<Tier>` with a type-only check, `type _Dnd5eEncounterTier = SystemTierModule<typeof import('../dnd5e/encounterTier.js'), Required<GameSystemEncounterTier>>`, which keeps no runtime reference to the namespace object. Every capability in a tier contract is optional, so `Required` is what makes the check complete: an installed System that drops a capability export fails the assertion itself, and every export must have the contract's type. A capability that a System may leave out by design must be named in the contract and left out of the assertion with `Omit`. The test-only tracer asserts against the partial tier, which checks only the types of the exports it has.
3. **Registries are pure at module load.** Each `createSystemCapabilityRegistry(...)` call in a `platform*.ts` file is annotated `/* @__PURE__ */`, so a bundle that does not import a registry drops it and the adapters only it reaches. Registry behaviour (`require` fails closed, `find` skips) is unchanged.
4. **No System-neutral module imports a System.** The dnd5e edges move into that System's tier, behind generic capabilities that any System could fill. Don't add a capability shaped around one dnd5e rule unless it's a real rules concept. This change moves:
   - `characterActionRuleFacts` and the creature action discovery onto an `attackRestriction` policy capability (reduce an effect's restrictions for the attacking equipment).
   - `characterSpellCastActions` onto a `spellCast` policy capability (adapt a cast effect to the caster's modifiers; a duration's length in turns).
   - `characterRuleRollProjection` into dnd5e's Character tier, as its `resolveCharacterRollModes`.
   - `characterRuleSnapshot` (a companion's armor class) onto the `armorClass` capability, which moves from the Encounter tier to the policy tier because the Sheet reads it.
   - `builderHitPoints` onto the `characterProgression` capability's `hitDieSize`.

   No module under `character/` imports `systems/dnd5e` outside tests.

5. **Bundle size is a deterministic gate.** `functionBundleBudget.test.ts` carries bundle-size bars for the reconcile step and `encounters/activeReads`, set from the measured size with headroom; both are red against the phase code.

The tracer Vitest project keeps aliasing the installed lists (now per capability), and the tracer still installs only the capabilities it has.

## Consequences

- Platform modules that need one capability no longer pay for a tier. Measured: the reconcile step 3,190 → 2,829 KB, `encounters/activeReads` 2,040 → 1,826 KB. The remaining dnd5e code in the step (470 KB) is live: the step evaluates the Character policy through the Character tier, and moving the last direct `character/` edges behind capabilities left the size unchanged. PERF-6.T11's move of the polygon union out of the shared vtt barrel takes about 53 KB more off each.
- Adding a System means adding one spread per capability in the installed lists, instead of one list entry per tier. That is more lines, and each one is explicit.
- Tree-shaking now depends on the pure annotations and on adapter modules having no top-level side effects. The bundle-size bars catch a regression.
- Cold p95 is recorded, not gated; the gates are the bundle bars and zero step timeouts on the CI membership proof.
- Bundle bytes are only part of a cold call. Measured locally on the replayed step: module compile and top-level evaluation are about half of a cold run, and the first execution of the Builder and rules code is most of the rest. This ADR fixes the System boundary; it does not by itself bring a cold call under a wall-clock bar.

## Alternatives

- **Lazy registry through dynamic `import()`:** rejected (see Context).
- **Keep tier objects and split the tiers further:** each new tier is a guess about which capabilities travel together; per-capability lists make that question disappear.
- **`sideEffects: false` on the workspace packages:** worth −222 KB on the step, but it changes how every package bundles; out of scope here and the next lever.

## Amendment 2026-11-14: System schema extensions (QUALITY-16.T3)

The persisted contracts in `packages/schema` named D&D content directly: the `SPELLCASTING_LOCK` modifier grant kind, the `dnd5e-encounter-lifecycle` and `dnd5e-optional-combat` definition families with their document schemas, and the D&D operation and fact keys that the stored rule receipt refinements check. The schema cannot read a rules-runtime registry, because rules-runtime depends on it. Decision 1 applies to the schema too:

- A System declares what it adds to the persisted contracts under `packages/schema/src/systems/<id>/`, typed by the neutral contract in `shared/systemSchemaExtension.ts`: bare-flag modifier grant kinds, definition families (key, document kinds, document schema) and receipt bindings (the relationship-state, duration and repeat-save operation and fact keys).
- `systems/installedSystemSchemas.ts` (light: grant kinds, family keys, receipt bindings) and `systems/installedSystemDefinitionDocuments.ts` (heavy: document schemas) keep one list per capability. They are the only schema modules that name a System. Storage identity reads only the light list, so it does not load the document schemas.
- Neutral schema modules build their unions and refinements from these lists: the modifier grant union, the authored family keys and document union, and the relationship, repeat-save and duration checks of the stored results.
- The System's persisted keys live in its schema extension, and the rules-runtime System imports them from there, so every key has one home.
- The source ratchet treats `packages/schema/src/systems/<id>/` as System code, exempt from the content fence like rules-runtime `systems/`. No neutral schema module and no fenced consumer may import a System's schema extension. Only the installed lists may.

Persisted values are unchanged, so no data migration is needed. Authoring still validated the two D&D definition families by name, which was outside this fence until QUALITY-16.T4.

### Amendment 2026-11-14: authoring inside the fence (QUALITY-16.T4)

- `packages/authoring/src` joins the System content fence and the import fence. A System's authoring modules live under `packages/authoring/src/systems/<id>/` (exempt like `schema/src/systems/<id>/`), and `systems/installedDefinitionPublishers.ts` is the one authoring module that names a System. `allowed` stays empty.
- The reusable definition service validates a System's definition family through that System's `SystemDefinitionPublisher` (`reusableDefinitions/reusableDefinitionValidation.ts`): the family key, the graph pins it locks for publication and its validation. The service reads the family keys from `installedDefinitionFamilyKeys` in the schema's installed list. `indexDefinitionPublishers` fails when this module loads if an installed family has no publisher, has two, or a publisher names a family that is not installed. The D&D Foundry actor format (its `_stats.systemId`) is the D&D System's own module.
- Receipt bindings are installed through `uniqueReceiptBindings`, which fails the install when an operation key (relationship state, duration, repeat-save test or ruling) is bound twice, because stored receipts are matched by operation key.
- `scripts/mergeSlice.mjs` loads the merged tree's `redProof.mjs` with its `sourceRatchets.mjs`, each blob pair in a directory of its own, so the merged tree is judged by its own ratchet modules.
