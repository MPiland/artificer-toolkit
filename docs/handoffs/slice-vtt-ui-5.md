# Slice workbook: VTT_UI-5 (Creatures see with their stat-block senses)

**Status:** DONE (merged `e6edf041f`, fixes `13a58bef8` and `f2e6ec254`; closed by the main session 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Creature senses are free-text display strings today (`subjects/creature.ts`, `snapshotStatBlock`), and `roomSceneVision` binds Character actors only, so a Creature token has only its authored token sight.

1. **VTT_UI-5.1.** Creature senses are authored as structured entries: a sense definition reference and a range, the same shape a Character's sense grant resolves to (a range is DISTANCE or UNLIMITED, lane 3 ruling 3; lengths bounded by `AUTHORED_LENGTH_AMOUNT_MAX`). Every SRD Creature's senses migrate to them. The printed stat-block text is derived from the structured entries, not stored beside them (no duplicate field). Passive Perception stays where it is today. A source-data test proves each SRD Creature's structured senses match its printed senses (oracle `SRD_CREATURE_STAT_BLOCKS`, as `creatureSrdArmorClass.test.ts` does for AC). The Creature editor authors the entries through the node map (shared renderer, no domain wrapper).
2. **VTT_UI-5.2.** A Creature token on a Scene carries its senses like a Character token, derived by the same function that composes Character token senses (VTT_UI-3.4, `sceneStoredTokenDtoSchema` keeps senses unpersisted), redacted per viewer by ADR 0034 control. The GM's preview of a Creature's view and combat perception both use them, replacing the D100 "undecided sight for unmodeled free-text Creature Senses" case where the senses are now modeled.

Out of scope: Devil's Sight (VTT_UI-3.5, queued after this slice) and RELIABILITY-5 (sense modifier units). The SRD monster trait "magical darkness doesn't impede its darkvision" (imps, devils) is in scope only as data if the sense model already expresses it; otherwise record it for VTT_UI-3.5.

Read first: D100, D108 and the VTT_UI-3.4 notes in `docs/handoffs/phase-08-2-decisions.md`; `docs/architecture/live-sessions.md` (Scene token senses); ADR 0034; AUTHORING-17 slice B notes in the main handoff (the Creature AC pattern to copy).

## Closes

- VTT_UI-5.1, VTT_UI-5.2.

## File scope

`packages/schema` (Creature senses), `packages/shared` sense and token-sense composition, `packages/source-data/src/srd/creatures/**`, `packages/rules-runtime` combat perception sense inputs, the Session Worker's `roomSceneVision`, Convex Creature publication and stat-block snapshot, the Creature node map and editor. Out of scope: basic actions (parallel ATTACK-18 slice E), the action drawer and stage overlays (parallel VTT session).

## Red-first checklist

1. SRD source-data test: structured senses match printed senses for all SRD Creatures (red before migration).
2. A Creature with darkvision 60 ft perceives a token in darkness 50 ft away and not one 70 ft away in combat perception (red today: undecided).
3. A Creature token's Scene DTO carries its senses for the GM and for a controlling player, and not for a player without control.
4. The Creature and Character token senses come from one function (a test exercises both through it).
5. Publication refuses a malformed sense entry (unknown sense definition, out-of-bounds range).
6. Editor: a Creature author adds a sense entry and it reaches the published Creature.

Dev data changes: the main session resets and reseeds after merge.

## Status log

- 2026-10-13: workbook written; session started.
- 2026-10-13: implementation complete in the working tree; validation runs queue behind the shared validation lock.
  - Premise change (D100 → D111): the `UNKNOWN` sight verdict is retired. Creature senses are structured, so every observer's sight is definitive. D111 in `phase-08-2-decisions.md` records it, with the "override D111" phrase.
  - Extra scope, same seam: movement-reaction (opportunity attack) perception reads Creature senses too, because it shares `MovementTarget.perceptionSenses` with attack perception.
  - Scene token vision is now keyed by actor (`SceneActorVision`, `resolveSceneActorVision`), so a Character and a Creature token compose through one function. Worker `composeRoomSceneVision` pins both through one `pinSenses`.
  - Storybook was not run (`creatureSense` editor row, Creature route story fixture); the web editor test covers the flow in jsdom.
- 2026-10-13: validated in one lock acquisition (logs under `local-validation/vtt-ui-5/`).
  - Builds green: schema, shared, rules-runtime, source-data, encounter-persistence, authoring.
  - Touched suites green (`green-touched.log`, `green-worker-vision.log`, `green-worker-pool.log`); the broad run over `apps/apis/convex/content`, `apps/session-worker/src`, rules-runtime `encounter*`, `packages/shared` and `packages/schema` is 205 files, 1941 tests green (`green-broad.log`).
  - `yarn turbo:affected:typecheck` green (`typecheck.log`); local Convex codegen push green (`codegen.log`); the regenerated `_generated/api.d.ts` is committed.
  - Two defects found by the first runs and fixed: Creature perception Senses are now handed to `resolveEncounterActorPairPerception` with the bare-amount `calculation` its pinned-Sense contract requires; `deriveActorSceneVision` accepts a plain `SenseRangeDto`.

- 2026-10-13: review follow-up fixes (main session list of 12).
  - Publication refuses duplicate senses, a foreign-System definition, a sense outside the System vocabulary and an empty range id; `snapshotStatBlock` parses each sense and throws on a malformed one.
  - One `createActorSensePinner` (`rules-runtime/src/actorSenses.ts`, renamed from `character/characterSceneVision.ts`) serves `roomSceneVision`, movement-reaction and turn-effect perception, memoized per sense definition.
  - Stale `UNKNOWN` leftovers removed (`nativeEncounterAreaRules` now tests `=== 'SEES'`). `printCreatureSenses` prints the registry unit abbreviation ("ft", no dot); the source-data oracle test normalises the book's "ft." when comparing.
  - Known limit (recorded in D111): sense qualifiers are display-only. Mechanics-bearing qualifiers in the SRD: Grimlock ("or 10 ft. while deafened") and Wererat ("rat form only"). Ten more carry only "(blind beyond this radius)": Animated Armor, Flying Sword, Rug of Smothering, Shrieker, Violet Fungus, Black Pudding, Gelatinous Cube, Gray Ooze, Ochre Jelly, Shambling Mound. Conditional senses are a follow-up for the main session to register.
  - Item 10 substitution: the Ogre's believed perception cannot be UNSEEN (believed perception strips the target's senses and uses the neutral environment), so the tests pin believed SEES versus actual UNSEEN for the Ogre at 70 ft and the reverse for a Blindsight Creature against an Invisible attacker.
- 2026-10-13: review fixes validated in lock acquisitions (logs under `local-validation/vtt-ui-5/`: `batch-summary.log`, `batch2-summary.log`).
  - Base merge: `codex/phase-08-2-convex-cutover` (10 commits) merged cleanly.
  - Builds green (schema, shared, rules-runtime, source-data, encounter-persistence, authoring); touched suites 18 files, 161 tests green (`green-touched.log`), plus `actorSenses` and `creatureSnapshotSenses` after test-typing fixes (`green-touched2.log`); worker Workers-pool suites green; `turbo:affected:typecheck` green (`typecheck2.log`); local Convex codegen push green (`codegen.log`).
  - The first run found three test defects, fixed: UNLIMITED ranges in new tests lacked the `id` the contract requires, and the oracle test compared the derived qualifier ("ft.") with the normalised printed line.
  - Red-first: the review's new tests were authored against the fixed production code in the same pass; no red logs were captured for them (the review accepted this for items 2 to 6). `creatureSnapshotSenses.test.ts` pins the throw with a bare `toThrow()`.
- 2026-10-13: second review round (main session).
  - Correction: `creaturePublication.test.ts` is a Convex-config test (`yarn vitest run --config apps/apis/vitest.config.ts <path>`); the root config's filter silently matched no file, so the earlier "green" logs never ran it. It runs now (`green-review-publication.log`, 10 tests green).
  - The first real run showed that node-map normalization drops any sense id outside the System vocabulary (unknown, another System's, unlisted) before the publication schema runs. The foreign-System and vocabulary checks added in the first review round were unreachable and are removed; the test now pins the refusal each id actually gets, and an empty id still hits `assertCreatureSensesDefined`. Red proof for those two reverts is therefore not possible and not needed (nothing to revert).
  - `creatureSnapshotSenses.test.ts` pins the throw with the Creature sense schema's own error message.
  - Red proof (fix reverted, pinned test run, fix restored, green rerun): `red-review-1.log` duplicate-sense refinement, `red-review-4.log` empty range id (both `promise resolved instead of rejecting`), `red-review-5.log` snapshot fail-closed throw (`expected [Function] to throw an error`). Green: `green-review-publication.log`, `green-review.log`; `typecheck3.log` green.
- 2026-10-13: post-merge run on `codex/phase-08-2-convex-cutover` was RED; fixed here. Logs under `local-validation/vtt-ui-5/`.
  - Correction: earlier "green" claims for the web `AuthoredDomainAuthoringLayout.test.tsx` and the apis Convex suites were never real. The root vitest config excludes `apps/web` and `apps/apis/convex`, so those files were silently not run. Always use the owning config (`yarn workspace @artificer-toolkit/web exec vitest run --config vitest.config.ts --project=unit <path>`, `yarn vitest run --config apps/apis/vitest.config.ts <path>`).
  - Regressions 1 and 2 (`UNAVAILABLE`, "Every Creature sense must reference a published sense definition"): fixture. The room reads Creature sense definitions from the Campaign System's `reusableDefinitions` rows, so a test that imports a seeded Creature must also import the sense definitions it references. `importSeededSrdCreatureSenses` in `apps/apis/tests/fixtures/srdCreatures.ts` does this (no-op for Creatures with no senses); used by `srdCreatureHitRiders`, `creatureEditArmorClass`, `srdLegendaryAction`; `duplicationJourney` adds the sense definitions to its dependency closure. Product code was right: it correctly refuses a Creature whose senses are undefined. Red: `repro-hitriders.log`, `diag-hitriders.log`, `g4-apis-fixes.log`, `g6-apis.log`; green: `g5-hitriders.log`, `g7-apis-failed.log`, `g9-apis.log` (173 files, 1063 tests).
  - Also found by the broader apis run (`g6-apis.log`): the committed `srdManifest.generated.ts` was stale after the SRD seed change (regenerated with `generate:srd:manifest`; fixes `seed`, `seedAudit`, `catalogueReadBudget`, `equipmentCharacter`, `equipmentLimits`), and `publicationDocument.test.ts` failed to load because `creatureSenses.ts` imported `#core` (an import cycle); it now imports `core/measurement.js` directly (product code). Green: `g7-apis-failed.log`.
  - Regression 3 (web "submits a Creature sense entry added in the editor"): my test was wrong and had never run. The new Senses row starts collapsed, so the test now expands "Sens 1" before choosing the sense; the label is "Sense *", so the query is `/^sense/i`. No assertion changed. Red: `repro-web.log`, `g4-web-repro.log`, `g9-web.log`; green: `g10-web.log` (35 tests).
  - Regression 4 (TS2531 in `creaturePublication.test.ts`): test typing, `?.item?.senses`. Green: `g7-typecheck-convex.log`, `g9-typecheck-convex.log`.
  - Regression 5 (`contentSnapshots` "reports SRD index and documents sizes" timeout at 5000 ms): pre-existing load sensitivity, not caused by this slice. The test takes about 0.9 s alone on both trees (mine 858, 904, 925 ms; base `fbe216325` 913, 946 ms: `g10-snap-mine-*.log`, `g11-snap-base-*.log`). In full rules-runtime runs it varied 1.2 to 3.9 s on the base and 3.1 to 4.0 s on this branch (`g11-full-*.log`), and exceeded 5 s once under machine load (`g6-rules-runtime.log`, `g9-snapshots-alone.log`). Its sibling test already carries a 30000 ms timeout, so this one now does too; the assertions are unchanged. The baseline worktree was a temporary `git worktree add` of `fbe216325`.

## Red / green evidence

Only item 1 has a captured red log (`oracle-red.log`, taken before the migration). Items 2 to 6 were written with the implementation in one pass, so no separate red log exists for them; each test asserts behavior the old code could not produce (a string `senses` field, the `UNKNOWN` sight verdict, Character-only actor binding).

| #   | Checklist item                                  | Red              | Green                                                                                                                   |
| --- | ----------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | SRD structured == printed                       | `oracle-red.log` | `green-oracle.log`                                                                                                      |
| 2   | darkvision 60 ft sees 50 ft not 70 ft           | not captured     | `encounterAttackPerception.test.ts` in `green-touched.log`                                                              |
| 3   | Scene DTO senses: GM and controller, not others | not captured     | `vtt-scene.test.ts` in `green-touched.log`                                                                              |
| 4   | one function for Character and Creature         | not captured     | `actorSenses.test.ts` in `green-touched.log`, `green-worker-vision.log` (Creature), `green-worker-pool.log` (Character) |
| 5   | publication refuses malformed entries           | not captured     | `creaturePublication.test.ts` in `green-touched.log`                                                                    |
| 6   | editor adds an entry and it reaches publication | not captured     | `AuthoredDomainAuthoringLayout.test.tsx` in `g10-web.log` (not `green-touched.log`: that config excludes apps/web)      |

## Proposed ledger edits (filled by the slice session)

- Close VTT_UI-5.1 and VTT_UI-5.2.
- Not run: Storybook (the `creatureSense` editor row and the Creature route story fixture have only jsdom coverage).
- Storybook regression after the second merge (all three `CreatureEditRoute` stories, "Unable to find an element with the display value: Acolyte"): not the senses fixtures. `configureAuthoredRouteStoryQueries` answered the node-runtime resolve query with a raw model, but `useNodeRuntimeResolve` strictly parses the compact transport shape (since the select/expand change), so the query errored and the form body never rendered. Story util fixture fix: the story now returns `compactNodeRuntimeResponse(...)`. Red/green proof `authoredRouteStory.utils.test.ts` (logs `h3` red, `h4` green). Every authored edit story shared the defect; Storybook rerun is owed by the main session.
- D100's `UNKNOWN` sight verdict is retired (D111); movement-reaction perception reads Creature Senses too.
