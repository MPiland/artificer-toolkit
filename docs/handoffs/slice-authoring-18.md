# Slice workbook: AUTHORING-18 (System vocabulary options show their description)

**Status:** OPEN (started 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Authored-form options drawn from System vocabulary (speeds, senses, damage types, skills, abilities, proficiencies and the rest) show no description. Node maps select `['id', 'label', 'tooltip']` from System vocabulary sources, but System vocabulary rows carry `description`, not `tooltip`. The resolver maps `option.tooltip ?? option.description` (`packages/authoring/src/nodeRuntime/nodeRuntimeService.ts`, around line 569), so it would serve the description if the source selected it. Fix it once, at the source contract (`packages/schema/src/api/nodeRuntimeSources.ts` and the node-map selects), so every System vocabulary option carries the vocabulary description to the option tooltip. Do not add per-domain fallbacks.

Find every vocabulary select first: `rg "'tooltip'\]" packages` lists the current maps (speed, numericExpr, charge, proficiency, modifier, path, nodeRuntimeSources). Check whether `tooltip` is a real field on any source; if none carries it, remove it rather than keep both.

RELIABILITY-5 is editing the speed and modifier node maps in parallel. Keep your edits to the option-field selection, and merge `codex/phase-08-2-convex-cutover` again before your final validation.

Read first: `docs/architecture/` node-runtime guide, `packages/authoring/src/nodeRuntime/nodeRuntimeService.ts`, `packages/schema/src/api/nodeRuntimeSources.ts`.

## Closes

- AC AUTHORING-18.1.

## File scope

`packages/schema` node-runtime source contract, `packages/shared` node maps (option selects only), `packages/authoring` resolver and its tests, and the web resolver test if the served shape reaches it. No Convex schema change is expected. If one is needed, stop and report.

## Red-first checklist

1. A real-resolver test: a speed option and a damage-type option resolved from System vocabulary carry the vocabulary entry's description (fails before the fix).
2. Every System vocabulary source used by a node map is covered: a test walks the maps' vocabulary sources and asserts that each selects the description field, so a new map cannot regress.
3. The web form shows the description as the option tooltip, through the existing authoring form test path. Use a Storybook or browser test only if the existing tests can't see it.

## Status log

- 2026-10-14: workbook written; session started.
- 2026-10-14: root cause: node maps selected `tooltip` from System vocabulary sources, but vocabulary rows carry `description` (seeded skills use `tooltip` for the ability abbreviation, e.g. `DEX`, which would have surfaced as the option description). Fixed once at the source contract: `nodeRuntimeSourceManifest` vocabulary tables now expose `description` and no `tooltip`; `streamToOptions` reads `description`; every System vocabulary `selectColumns` in `packages/shared` node maps is `['id', 'label', 'description']`. Authored tables are unchanged (they never carried `description`).
- 2026-10-14: new `packages/authoring/src/nodeRuntime/systemVocabularyOptions.test.ts` (5 tests, real maps + real resolver + real reader). Red log `local-validation/authoring-18/red.log` (fails before the fix). Caveat: the damage-type red failed on a setup error (unregistered map `damage`), so only speed, skills and the map-walk have a clean production-bug red; the damage test (`creatureQualifiedDamageDefense` / `damageTypeIds`) was corrected afterwards and is green.
- 2026-10-14: premise change flagged: `apps/apis/convex/authoring/nodeRuntime.test.ts` skills expectation now reads `item.description` instead of `item.tooltip` (the old assertion encoded the retired source column). Added a web resolver test (`apps/web/src/test/nodeRuntimeResolver.test.ts`) comparing served speed option descriptions to `srdSystemRecord.speeds`.
- 2026-10-14: green batch under lock (`green-*.log`): builds schema/shared/authoring exit 0; authoring tests (systemVocabularyOptions, authoredSourceFacts, facetEquipmentOptions) 3 files / 10 tests pass; convex `nodeRuntime.test.ts` 17 tests pass; web `nodeRuntimeResolver.test.ts` passes. `GuidedEntryJourneys` and `AuthoredDomainFieldParity` failed to load (`rules-runtime` dist not built, environment) and are rerun after building rules-runtime.
- 2026-10-14: base `codex/phase-08-2-convex-cutover` merged cleanly (no overlap with the node maps). Final batch under one lock hold (`final-*.log`), all exit 0: builds (schema, shared, authoring, rules-runtime, encounter-persistence); authoring tests 3 files / 10 tests; convex `nodeRuntime.test.ts` 17 tests; web `nodeRuntimeResolver`, `GuidedEntryJourneys`, `AuthoredDomainFieldParity` 3 files / 192 tests; `turbo run typecheck --filter="[codex/phase-08-2-convex-cutover]"` 14/14 tasks.
- Checklist item 3 is covered at the served-shape level only (web resolver test; the AC says "served by the shared resolver"). Finding: the web select drops the description. `normalizeOptions` in `apps/web/src/ui/primitives/Select/selectOptions.ts` maps only `value`/`label`/`disabled`, and `AppSelectOption` has no description, so no option tooltip renders in the form today. That is a separate UI change outside this slice's file scope; proposed as a follow-up below.
- Storybook runs not done (cannot start in a worktree): none required by this slice's tests.

## Proposed ledger edits (filled by the slice session)

- AC AUTHORING-18.1: proven by `systemVocabularyOptions.test.ts` (real resolver, red before fix), the convex `nodeRuntime.test.ts` skills assertion and the web `nodeRuntimeResolver.test.ts` description test.
- Register a follow-up slice (suggest AUTHORING-19): render the served option `description` as the option tooltip in the web `AppSelect`/`AppMultiSelect` (`selectOptions.ts` `normalizeOptions` and `AppSelectOption` drop it today); prove with a form test that hovers an option. AUTHORING-18.1 as worded ("served by the shared resolver") is closed by this slice.
- Contract note: `tooltip` removed from the System vocabulary source manifest; `description` is the single option-description column (`docs/architecture/authoring-schema.md`).
