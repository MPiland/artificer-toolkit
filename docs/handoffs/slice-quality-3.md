# Slice QUALITY-3.T1a workbook

**Status:** implemented on branch `quality-3`, 2026-10-17. CI validation is on `ci/quality-3`.

AC QUALITY-3.1 (scope cut, D145): lint runs as a failing CI job at zero warnings. It fails on double casts through `unknown` outside tests and on non-component exports from component files. Each rule's existing violations are fixed. T1b (knip), T1c (boundaries and barrels) and T1d (large files) moved post-launch.

Base: `codex/phase-08-2-convex-cutover`. Branch `quality-3` (worktree `angry-engelbart-db4041`).

## Rules and their cleanup (one commit each)

| Rule | Where | Violations fixed |
| --- | --- | --- |
| CI lint job | `lint` job in `.github/workflows/tests.yml` runs `yarn lint`; described in [CI validation](../architecture/ci-validation.md#lint) | 6 `no-unused-vars` errors that were already on the phase tip. 4 were removed. 2 were rest-sibling omissions, now allowed by `ignoreRestSiblings`. `argsIgnorePattern`/`varsIgnorePattern` `^_` keep oxlint's defaults. |
| `react/only-export-components` | `.oxlintrc.jsonc` override for `apps/web`, `design-system` and `emails` `.tsx` files; route modules, tests and stories exempt | 10 sites. 2 were real: `getSessionWorkspaceViews`/`SessionWorkspaceView` and `isCampaignTableSettingsEditable` moved into `domains/campaigns/campaignAccess.ts`, with their tests. 8 were false positives on TanStack Form HOCs, declared as `customHOCs: withForm, withFieldGroup`. |
| No double casts outside tests | `scripts/doubleCasts.mjs` (`yarn lint:casts`, chained into `yarn lint`; test `scripts/doubleCasts.test.mjs`) | 49 found: 24 typed properly, 6 now checked single assertions, 19 allowlisted (below) |

The double-cast check is a repo script because oxlint has no native rule for it and its JS plugins are alpha. It parses every tracked non-test, non-generated TS module under `apps`, `packages` and `scripts` with `oxc-parser`.

### Double casts typed properly (24)

- `shared/domains/subjects/compilers/mechanicsIndex.ts` (4): typed root-collection source; `as const` collections.
- `shared/utils/nodeSections.ts` (2): dead `resolveNestedNodeSections` deleted (only its own test used it).
- `shared/utils/nodeDefinition.ts`: `toSelectColumns` destructure; `makeFrameBinder` overload declaration.
- New `RuntimeNodeMap`/`RuntimeNodeEntry` (shared `nodeDefinition.ts`, exported via `maps`/`utils`): an erased node map that admits both OBJECT and ARRAY groups. `NodeMap<Record<string, unknown>>` cannot hold ARRAY groups, which is why these casts existed. It replaces the cast in authoring `mapRegistry.ts` and apis `campaigns/contentShares.ts` (now `satisfies`). The other generic map readers now use it too: `campaignTextPolicy.ts` (local structural copy removed), `nodeSections.ts` (now generic over the entry) and `nodeRuntimeService.ts`.
- `shared/domains/shared/core/facetSubject.ts`, `authoring/nodeRuntime/authoredSourceFacts.ts`.
- `rules-runtime/character/characterGrantFoldRestrictionFacts.ts` (2). `baseCondition` reads a typed `authoringModeKind`. The default branch only ever received `SAVING_THROW_ABILITY`, which has none of the fields it read, so it always produced the `UNAVAILABLE` base. The switch now lists that case and is exhaustive, and the two helpers only it used are deleted.
- `rules-runtime/character/chosenGrantChoiceResolver.ts` (5): the grants were already assignable, so the casts were dropped.
- `rules-runtime/systems/dnd5e/effectActionCompiler.ts` (4): `healDiceConfiguration` and `exactDiceConfiguration` take a `Partial<Record<…, unknown>>` of exactly the fields they read.

### Checked single assertions (6, orchestrator ruling 1)

TypeScript checks each one for comparability. Each narrows to the exact type at a library generic-erasure seam and keeps its inline reason:

- Convex `liveSessions/checkpointRecords.ts:74`, `liveSessions/checkpointScenes.ts:49` (index-range builders).
- Worker `roomEncounterStore.ts:267,801,928`; `encounter-persistence/memoryEncounterStore.ts:318`.

## Exceptions

- **Double-cast allowlist** (`ALLOWED` in `scripts/doubleCasts.mjs`, orchestrator ruling 2). It is keyed by file with an exact count and a reason. Any other double cast fails, a count that differs fails, and entries only shrink:
  - Convex generic-table seams (6), where `typecheck:convex` refuses a single assertion: `characters/stateDocuments.ts` (1, a generic table's widened query rows), `lib/convexEncounterStore.ts` (2, runtime-selected table handles), `lib/domainRejectionTransport.ts` (2, one wrapper for every generic builder), `lib/receiptLedgers.ts` (1, a table-selected schema parse).
  - `encounter-persistence/src/memoryEncounterStore.ts` (1): one Map-backed generic store implements the per-table overload intersection (`PerTable`). A single assertion is refused (no overlap), and typing each method would trade 1 assertion for 5+.
  - `rules-runtime/src/encounterCreatureEquipmentSources.ts` (3): equipment DTO drift (findings).
  - `shared/src/domains/effects/maps/path.ts` (9): node-map builder generics (findings).
- **react plugin correctness rules.** Enabling the react plugin in the component-file override also enables its correctness category. The rules that already fire there are turned off in that override until each is adopted with its own cleanup: `globals`, `incompatible-library`, `jsx-key`, `preserve-manual-memoization`, `purity`, `refs`, `set-state-in-effect`, `react-hooks/exhaustive-deps`.

## Findings (post-launch Code-quality refactors)

- **Equipment DTO drift.** `equipmentAuthoredDtoSchema` and the serialized creature-equipment payload type two things looser than `EquipmentAuthored`/`ResolvedEquipment`:
  - `category` is a flat enum, where the authored type is a per-category union;
  - feature-grant facet `contexts` accept any subject, where the authored type pins them to `EQUIPMENT`.

  The parsed data carries the same fields, so nothing is dropped or misread at the table. This is a type-alignment refactor, not a bug.
- **Effect outcome map builder generics.** `path.ts` reuses `OUTCOME_NODE_MAP` as the typed child map of damage and condition groups, and it reuses `registerOutcomeFields`' builder API for the non-manifest outcome map. Removing the casts means reworking the node-map builder generics, in the SPELLS-20 area.
- **Inert hooks rule.** The top-level `react/rules-of-hooks: error` in `.oxlintrc.jsonc` is inert, because the react plugin is not enabled at the top level. Enabling the plugin repo-wide reports 222 findings, including 93 rules-of-hooks hits.
