# Rules-engine composability audit (2026-10-20)

Status: current. The audit found why adding an SRD feature still costs an engine change. It feeds [ADR 0039](../adr/0039-composable-system-neutral-rules-engine.md) and the refactor PBIs in the ledger under `RULES-2`.

Four read-only audits ran against the phase branch at `cdcdaa5a5`:

- A: the effect-action compiler;
- B: monoliths and duplicated seams;
- C: the boundary between the kernel and the System module;
- D: the cost of recent merges, and why an earlier audit missed the compiler.

Line numbers are as of that commit.

## Why rare features are expensive

| Cause                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The compiler is a fixed ladder of plan shapes | `systems/dnd5e/effectActionCompiler.ts` has 11,290 lines and 281 top-level declarations. It has 217 refusal sites: about 78 validate input, about 14 enforce a genuine rule, about 85 refuse a combination the code doesn't support, and about 40 refuse because a primitive is missing. Compilation, runtime interpretation (about 8635-10140), the operation registry (5021-6233), the zone subsystem (3096-3765) and the adapter (10430+) all share one file. Four flavours of follow-up save overlap. |
| d20 settlement is duplicated                  | The answer → added dice → resume sequence is copied at about 10 sites: action execution, basic check, Concentration, death save, turn effects (twice), spatial candidate, the target-bound executor, and optional contest. Each site then re-checks `rawDie`, `addedTotal` and `total` by hand. The frozen d20 context block is copied verbatim in basic check, concealment and escape, and four more sites build near-copies. The Worker's app-roll binding is repeated 8 times.                         |
| Pending-choice pauses are separate stacks     | On-hit, retarget and forced movement are copies of each other: about 330 lines that carry about 60 lines of unique logic. Reaction and cast-reaction are the same sealed two-option choice. Legendary Resistance needs a wrapper per context. The pending snapshot spreads its optional pause fields in two places. The Worker handles every pause answer inline in `planNativeLiveEncounterAction`, a single function of about 1,660 lines.                                                              |
| No generic event hooks                        | End and consume events are data-driven (`effectsEndedBy`), but 8+ call sites pick the event by hand. Each reaction trigger has its own hand-written discovery function. Interception (incoming gate, retarget, counter) has no shared dispatcher.                                                                                                                                                                                                                                                         |
| One initiative entry per actor                | The schema enforces it, which is fine for now. Cursor validation and the ACTED/ACTIVE/READY derivation are written twice.                                                                                                                                                                                                                                                                                                                                                                                 |
| The neutral layer is unproven                 | The kernel (`packages/shared/src/domains/rules`) is about 95% neutral. It leaks the advantage field in `contributors.ts`, d20 wording in `operations.ts`, and `combatPerception.ts`. In `packages/rules-runtime`, about 150 flat `encounter*` files are D&D-shaped, and 37 of them import `systems/dnd5e` directly. The modifier fold, roll-mode pipeline, resources and Concentration (really a maintenance link) live only inside `systems/dnd5e`. There is no second-System test.                      |

## Merge cost (Part D)

A sample of 12 SPELLS merges added or deleted 4,446 production engine lines:

- 30% were seams that other code reuses;
- 22% had a generic name but serve one feature (for example `encounterEffectOnEnd`, which has one importer);
- 48% widened an existing combination.

Data was 64% of all changed lines. Most of the engine work was spent widening the compiler ladder rather than adding composable pieces.

## Why the earlier audit missed the compiler

The earlier audit flagged the compiler. QUALITY-7 named it for a split, at about 7,000 lines, and QUALITY-3.T1d (decision D145) proposed a 1,500-line lint rule. On 2026-10-17 commit `57ce176a1` moved both post-launch to save time to market. No guard took their place: `.oxlintrc.jsonc` has no `max-lines` rule and no script checks file size. About 39% of the file was written after that deferral, at a steady 750 to 1,200 lines a day. A plain allowlist would not have stopped this, because an allowlisted file can keep growing. The guard needs a per-file ratchet.

## Other monoliths over 1,500 lines (Part B)

| File                                                     | Lines        | Responsibilities                                                                                                         |
| -------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/session-worker/src/nativeLiveSessionRoom.ts`       | 4,791        | Mixed: admission, recovery, reload, command execution per domain, fog and scene commits, outbox, broadcasts, scene cache |
| `apps/session-worker/src/nativeEncounterAreaRules.ts`    | 3,050        | Mixed: preparation, plan, revalidate, commit, collision saves. `completeAreaCommit` is about 700 lines                   |
| `apps/session-worker/src/nativeEncounterRules.ts`        | 2,000        | `planNativeLiveEncounterAction` is one function of about 1,660 lines                                                     |
| `packages/rules-runtime/src/encounterActionExecution.ts` | 1,728        | Two functions of 300 to 500 lines each                                                                                   |
| `packages/shared/.../maps/path.ts`, `facet.ts`           | 4,158, 3,108 | Node-map data with one job; cohesive                                                                                     |

The schema DTO and sheet files between 1,500 and 1,750 lines were not inspected.

## Already well factored

These are kept and built on:

- the Legendary Resistance core;
- `effectsEndedBy`;
- the initiative footprint;
- the roll records in `encounterRuleCheckRolls.ts`;
- `mergedRollContributors`;
- area saves reusing the action pipeline;
- the action-economy capability adapter keyed by `gameSystemId`;
- the feature-action discovery registry.

## Uncertainty

- The audits did not trace cover, advantage or the aura to every save site.
- The large Worker and compiler files were read only in outline.
- Classifying merge lines as reusable seam, one-off or widened combination was a judgment call.
- The authors of moves 1 to 6 check these points before they freeze their seams.
