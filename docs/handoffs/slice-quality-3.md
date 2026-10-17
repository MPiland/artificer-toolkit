# Slice QUALITY-3.T1 workbook

**Status:** stopped at measurement, 2026-10-17. Split requested from the orchestrator.

AC QUALITY-3.1: lint fails on double casts, dead exports (knip), package-boundary imports and non-component exports from component files, plus a large-file warning; each rule ships with its violations fixed.

Base: `codex/phase-08-2-convex-cutover` at `e2dff7978`. Branch `quality-3` (worktree `angry-engelbart-db4041`).

## Findings

- Lint is not wired into `.github/workflows/tests.yml` at all, and `yarn lint:ox` is already red on the phase tip: 6 `no-unused-vars` errors (`useActionTargetModifiers.ts`, `characterSpellCastActions.test.ts`, `barbarianRun.ts`, `sheetHealEndsGrants.test.ts`, `encounterActionMaintenance.ts`, `actionChoiceReads.ts`). A CI lint job has to land with these fixed.
- Two read-only commands that touched `node_modules` (listing `.bin`, reading `oxlint/configuration_schema.json` and `oxlint --version`) were denied, so oxlint JS-plugin support (needed for a native double-cast rule) is unverified. Work stopped there per the brief.

## Violation counts per rule (phase tip, production code unless noted)

| Rule | Count | Size |
| --- | --- | --- |
| Existing lint (no-unused-vars) | 6 | trivial |
| 1. `as unknown as` outside tests | 52 hits in 24 files (2 in Convex `_generated`, 1 in `apps/web/src/test/setup.ts`, so ~49 real); 157 more in tests | medium |
| 2. knip dead exports | not measured: knip is not installed (adds a devDependency and `knip.json`) | unknown |
| 3a. Root barrel `@artificer-toolkit/schema` / `shared` imports | 1,072 imports in 1,068 non-test files | large, mechanical codemod; needs subpath export coverage checked |
| 3b. Web importing packages other than apis/schema/shared | rules-runtime 38, source-data 38, authoring 6, design-system 5 imports | needs a ruling on which are allowed (pure rules logic vs product data) |
| 3c. Domain logic in Convex/Worker | not counted by rule yet; Convex and Worker import rules-runtime/encounter-persistence/source-data heavily, which AGENTS.md allows; the forbidden set needs defining | needs a ruling |
| 4. `react/only-export-components` (web, routes exempt) | 10 hits in 9 files | small |
| 5. Large-file warning | production files over 500/800/1000/1500 lines: 205/75/47/18 (tests included: 440/168/105/37) | large: zero warnings means splitting dozens of files, or a threshold/baseline decision |

## Suggested split

- T1a: CI lint job (`yarn lint` in tests.yml) + fix the 6 existing errors + rule 4 (10 hits) + rule 1 (~49 casts).
- T1b: knip install, config and dead-export cleanup (count first).
- T1c: boundary rules: define the allowed import matrix (3b/3c ruling), then the root-barrel codemod (3a) as its own commit or slice.
- T1d: large-file warning: choose the threshold and whether existing files carry a tracked baseline list or each gets split under its own slices.

## Exceptions

None yet.
