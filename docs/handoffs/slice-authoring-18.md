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

## Proposed ledger edits (filled by the slice session)
