# Slice SPELLS-20: auras that move with their source

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Resume here

- T1, T1b, T2a and T3 are done (T2a at `16e4493c7`; T3 at `897458fa0` on `ci/spells-20-t3`, based on the T2a tip plus `ci/merge-batch-bf`).
- T2b done: red Tests 38989834002 on `877ceb4ce`; green `6a67e415b` on `ci/spells-20-t2b`, Tests 38991779131 (attempt 2; attempt 1 hit the Escape test flake), Live 38991779168. Next: T4 and later.
- T4 is split (T4a-T4d, all close AC SPELLS-20.1). T4a (half damage on a made zone save, slot-level scaling) is done: red Tests 38998091848 on `8b55d392a`; green `5c9c90a54` on `ci/spells-20-t4a`, Tests 39001554879, Live 39001554886. Then T4b (turn triggers + once-per-turn counter), T4c (unaffected creatures, parallel-capable), T4d (half speed via a movement-cost seam shared with terrain, after T4b); T6 after T4b.
- T4c merged as `d90f99153`. T4b is split: T4b1 (once-per-turn zone counter, ENTER triggers, proved on Spirit Guardians) is done: green `4dd367255` on `ci/spells-20-t4b1`, Tests 39009226378, Live 39009226404; T4b2 (turn-stage zone effects, one shared save-then-dice resume helper) follows after its design delta goes to the orchestrator.
- T4b2 is split (orchestrator ruling). T4b1 accepted at `18f1e3cc3` (in `ci/merge-m69`). T4b2a (authoring + containment + shared resume helper) is on `ci/spells-20-t4b2a`; T4b2b is the turn stage: one ordered candidate list per boundary, evaluate extending `ENCOUNTER_TURN_ACTIVE_EFFECTS` with a discriminated `ACTIVE_EFFECT | ZONE` candidate (`diceStage` on the zone kind only) and bring the evidence before taking a new context; Spirit Guardians' SRD flip to ENTER + START_TURN lands there. Future enhancement: the creature whose turn it is chooses the order. T4d and T6 wait on T4b2b; T5 is independent.
- T4b2b1 (schema + rules-runtime: `ENCOUNTER_TURN_ZONE_EFFECTS`, zone phases on the terminal turn result, real zones stage) is done: green `747f4dd0c` on `ci/spells-20-t4b2b1` (phase branch `dafd15cb1` merged), Tests 39020371226 (attempt 2; attempt 1 hit a CharacterSheetRestControl web flake), Live 39020371263. Next: T4b2b2 (persistence seams, Scene loading, `zoneApplications` write, Spirit Guardians SRD flip, journey, ADR 0034 note, `persistence.md`).
- T4b2b2 (persistence + play: zones act at turn boundaries) is green: `20b0590a6` on `ci/spells-20-t4b2b2`, Tests 39026658401, Live 39026658409. Proved: ADVANCE_TURN START_OF_TURN on real Spirit Guardians, END_OF_TURN on a core-options zone, no-zone byte-identical result, stale-plan refusals at package level. Not proved: a START-command journey (the room harness builds only ACTIVE Runs). Next: T4b3 (Stinking Cloud), T4d, T4e, T6; T5 independent. Zone table below.
- D138 cleanup (after the T4b2b2 green): `spatialEffectPin.ts` and its movement-persistence call are removed (a placed zone is fixed at placement). Movement still refuses a deleted zone (`movementSpatialZoneSettlement.test.ts`) and a zone or path that changed since a pause (`encounterSpatialMovementStale.test.ts`: zone gone, path misses, zone version bumped, creature changed). The turn path keeps its selection-checksum and 'settlement differs from its plan' refusals.
- T4f (START journey, pending-prompt interleaves, spatial resume checks): see the T4f log entry. A Sheet END_CONCENTRATION while a prompt was pending deleted the aura under it; it now refuses with PENDING_DECISION, and REMOVE_ACTOR now refuses with PENDING_DECISION instead of a plain error. The resume harness in `encounterSpatialMovementStale.test.ts` now resumes from the paused position and Scene version, so two older stale tests now assert the guard that actually fires.
- The `encounterWriteSets` 100-actor read sits at the 250 KiB cap; ROOM-6 owns the trim.
- T6 is split by D144 into T6a (source-turn zone outcome with no save), T6b (passive creature zones and their lifecycle; the Pit Fiend Fear Aura stays CLOSED_RULE and moved to future-enhancements, D147), T6c (Balor data, CLOSED_RULE deletion, ADR 0038 parity, room journey) and T6d (melee-hit retaliation rider). T6a merged as `bc68ead1f`, T6b as `1a4de8a8a` (m94). T6c: see its log entry; on `ci/spells-20-t6c`.

## Scope

- AC 1: an aura (Spirit Guardians, a paladin's Aura of Protection, a creature's damaging aura) is an authored spatial effect centered on its source that moves with it and applies its authored outcome to the creatures inside it; the encounter projection carries each aura's radius and label to the viewers allowed to see its source, so the map can draw it.
- Build on the production spatial-effect creator from SPELLS-17 (placed zones) and the zone entry/turn triggers; no aura-specific copies of zone logic. Authored from core options with a parity proof (ADR 0038).
- Projection: only viewers allowed to see the source receive the aura geometry (redaction parity with token visibility).
- First step: split into vertical tasks with WSJF and send them to the main session for registration before coding.
- Iterate in CI (`ci/spells-20`).

## Log

### Task split (proposed, sent to Phase 8 main session 2026-10-16)

Study findings that shape the split:

- The placement schema, `effectiveSpatialGeometry` and the `sourceMoved` branch of `collectSpatialMovementCandidates` already support `anchorKind: 'TOKEN'` / `TOKEN_LOCAL`. What is missing is the production side: `placedSpaceManifest` accepts only `attachmentKind: 'PLACED_SPACE'` (SOURCE zones never compile), and `planEncounterPlacedZone` only builds FIXED / SCENE_ABSOLUTE placements. T1 extends those two seams; no aura-specific copy.
- `START_TURN_IN_SPACE` / `END_TURN_IN_SPACE` and `maxApplicationsPerTurn` are authored (Stinking Cloud, Blade Barrier, Oil Flask) but have no runtime consumer; `zoneTriggerModes` returns null for them. Spirit Guardians needs both ("first time on a turn or starts its turn there"), so the consumer is built once in T3 for every zone, not for auras only.
- `movementCostMultiplier` has no zone consumer (only terrain in `vtt/scene.ts`). "Speed halved in the area" is scoped into T3 to confirm; if it needs a new movement-cost seam it is registered as its own follow-up.
- Projection: `halfSpeedFields` (`readHalfSpeedFields`) is identical for every member. Auras must be per viewer, filtered with `playerSeesActor` of the source actor (OWNER/GM see all). Convex reads pass null visible tokens (every bound actor counts as unseen), the room reads fog, so T2 proves both paths.

| Task | One-line outcome                                                                                                                                                                                                                                                                                                                                         | Closes                                   | WSJF (bv/tc/rr/size) | Order        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------- | ------------ |
| T1   | A placed zone's failed entry save rolls its authored damage dice through a DICE roll request (D133: the zone source's controller rolls or enters them, auto-roll honored, GM may roll; dice recorded in the receipt so undo and replay never reroll), proved on a real placed zone with GM undo                                                          | SPELLS-20.1 (generic zone dice)          | 5 (as registered)    | 1            |
| T1b  | Casting Spirit Guardians (authored as a SOURCE ZONE from core options, parity-proved) puts a 15 ft aura on the caster's token that moves with the caster; a creature it catches on entry or when the caster moves onto it makes the Wisdom save against the caster's spell save DC (pinned at placement) and takes the rolled damage; GM undo removes it | SPELLS-20.1 (Spirit Guardians journey)   | 8 (as registered)    | 2, after T1  |
| T2   | Ending, dropping or replacing the caster's Concentration removes the zone the spell placed (concentration-maintained spatial effects; no spatial-effect link to Concentration exists today, so it serves every lasting zone)                                                                                                                             | SPELLS-20.1 (aura lifetime)              | 5/3/5/3              | 3, after T1b |
| T3   | The encounter session state carries each aura's label, radius and source token, only to viewers allowed to see the source (Convex and room parity); unblocks VTT_UI-3.1                                                                                                                                                                                  | SPELLS-20.1 (projection)                 | 8/5/3/3              | 4, after T1b |
| T4   | A creature that starts its turn in a zone, or enters it for the first time in a turn, resolves the zone outcome once (shared zone turn-trigger consumer + once-per-turn); half damage on a made save and slot-level scaling; designated-unaffected creatures; half speed in the area if the seam exists                                                  | SPELLS-20.1 (Spirit Guardians complete)  | 5/3/3/5              | 5, after T1b |
| T5   | A paladin's Aura of Protection is an authored source aura: allies within range add the Charisma modifier to saving throws while the paladin is conscious (30 ft at level 18)                                                                                                                                                                             | SPELLS-20.1 (Aura of Protection journey) | 5/2/3/5              | 6, after T1b |
| T6   | A creature's damaging aura (Balor Fire Aura first) damages creatures in it through the same options, with a parity proof; closes AC SPELLS-20.1                                                                                                                                                                                                          | SPELLS-20.1                              | 3/2/3/3              | 7, after T4  |

Registered by Phase 8 (commits 287f7d0c2 and a97894a8d, ruling D133 in 81d760bdf): T1 is the generic zone-dice task and T1b the Spirit Guardians aura, so T2 to T6 now run after T1b. No existing SRD placed zone authors dice damage on entry with a simple fixed-DC save (Hunting Trap also needs a tether and follow-up check; the spell zones are unmodeled or turn-triggered), so T1 is proved on a fixture-authored placed zone through the real compile and runtime path; T1b is the real SRD journey.

### T1 (generic zone dice, D133)

- Red: Tests run 38925137863 on 818017194 (`ci/spells-20-t1-red`). Only failing job: Packages and Worker / Worker tests. Failing tests, all in `apps/session-worker/test/nativeRoomPlacedZoneDice.test.ts`: "stores the zone: dice damage is a placeable zone outcome", "rolls the authored dice for a creature that fails the entry save and applies the rolled total", "restores the hit points when the GM takes the entry back".
- Green on `ci/spells-20-t1` at code SHA `bfbabbb39` (includes `origin/ci/merge-batch-aq`): Tests 38942143027, Live backend 38942143041. Earlier tip `3bac5d5fa`: Tests 38938717158 (Packages and Worker green).
- Proof: `apps/session-worker/test/nativeRoomPlacedZoneDice.test.ts` (real compile + room runtime on a fixture-authored caltrops zone with `1d4`/`2d4`) and the "(D133)" describe in `packages/rules-runtime/src/__tests__/encounterZonePlacementCompilation.test.ts` (compile refusals for half damage, bonuses, scaling, flat modifiers).
- Correction to the red test: "restores the hit points when the GM takes the entry back" was rewritten as GM undo of the spreading Action ("removes the dice field with the Action when the GM takes it back"). `MOVE_SCENE_TOKEN` is not an undoable root (`REVERT_LAST_ACTION` and `UNDO_LAST_SCENE_MOVE` refuse it), so an entry cannot be taken back by design; undo removes the zone and, with it, any later entry.
- `D-pending-spells-20` (T1 decisions, Phase 8 assigns the number):
  1. Dice roller is `spatialPendingRollerActorId` (`sourceActorId ?? targetActorId`): the zone source's controller, falling back to the contacted creature when the zone has no source actor. The d20 stays with the contacted creature; the GM may answer for anyone.
  2. A settled entry never rerolls: settlement reconstructs from the stored execution trace. `retainedSpatialReplayFaces` also replays dice, but no caller passes `retained`.
  3. Entry is not undoable (above); undo is proved on the spread.
  4. An app-rolled movement die needs a `rollId` from a prior `ROLL_RULE_EVIDENCE` command (same as the d20).
- Deferred edge cases registered in `docs/roadmap/future-enhancements.md`: the 256-command cap versus prompts x dice, and a departed source actor leaving an unanswerable prompt.
- T4 must report whether a half-speed seam exists: none found so far (`movementCostMultiplier` is used only by terrain).

### T1b (Spirit Guardians source aura)

- Red: Tests 38947417012, Live backend 38947417027 on 7ea6348fd (`ci/spells-20-t1b-red`). Tests: `apps/session-worker/test/nativeRoomSourceAura.test.ts` (cast leaves a token-anchored zone with the pinned caster DC; entry damage; caster walking onto a creature; GM undo) and `packages/authoring/src/nodeRuntime/sourceZoneAuthoringParity.test.ts` (ADR 0038 parity).
- Authoring: `spirit-guardians.ts` is a SOURCE `ZONE` (15 ft sphere, 10 minutes, `ENTER_SPACE`, Wisdom save against `SOURCE_SAVE_DC`, 3d8 radiant on a failed save). The closed `SPIRIT_GUARDIANS` rule kind is deleted.
- Seams: `zonePlacement.attachment`, `zoneEntrySavingThrow` (zone save in the action facts), token-anchored `planEncounterPlacedZone` with `sourceToken` and `saveDc`.
- `D-pending-spells-20` (T1b decisions, Phase 8 assigns the number): 5. A SOURCE zone reuses the placed-zone compile and creator; the caster's save DC is pinned at placement from the resolved action mechanic, not rolled. 6. Radius is the authored radius plus half the token width (circle, not the rounded rectangle of the SRD wording): smaller than the rule on diagonals for a square token. 7. Until T4 a higher-slot cast deals the base 3d8, a made save deals 0 (no half damage), and there is no half-speed or start-of-turn damage. Each is a refused or absent zone feature, not partly honored. 8. Spirit Guardians' necrotic-or-radiant alignment choice has no generic option; the zone is radiant.
- Follow-up: the aura's alignment-damage choice (generic authoring option).
- CI fixes on 4ee8b1c65: `zoneAttachment.test.ts` now expects Spirit Guardians among the SOURCE zones (the intended T1b change, assertion widened by the one new owner, none removed); the zone-save helper moved into `characterActionRuleFacts.ts` because the web boundary test (ADR 0036 S6) forbids the web bundle reaching `encounter*` rules modules.

Docs updated by the tasks that change them: `rules-runtime.md` (zone seam), `persistence.md` / `transport.md` (aura projection), ADR 0038 note (SOURCE zones).

### T2a (zone-only cast opens Concentration, zone is its dependent, D135)

- Red: `ci/spells-20-t2a-red` at bac84acaa. Tests: `nativeRoomSourceAura.test.ts` (state opened, zone points at it, GM undo removes both), `spatialEffectStore.test.ts` (`maintainedEffectStateId` round trip), `encounterZonePlacementCompilation.test.ts` (non-concentration zone compiles `maintenance: null`).
- Seams: `compiledActionMaintenanceSchema` shared by the effect plan and `zonePlacement.maintenance`; `maintainedEffectStateId` on the stored/record spatial-effect schemas and `LiveSessionPlacedSpatialEffect`; area root `maintenanceTransition` for a cast no creature outcome carries; `prepareMaintenanceReplacement` and `applyMaintenanceReplacement` split out of the effect persistence so the root and a creature outcome share them; identical policies on a cast's effect and zone are one Concentration.
- Dev data: local Encounters with placed zones need a reset (new required column, no compatibility default).
- Left to T2b: cleanup removes dependent zones (`removedZoneIds`, `by_state_encounter` index), GM undo restores them, a replacement removes the old zone (until then a replaced state leaves its old zone pointing at a deleted state).

- Done: green `16e4493c7` on `ci/spells-20-t2a`, Tests 38972849265 (re-run of the failed jobs after a room-authority Escape flake and a budget-cap run, neither T2a) and Live 38974795282. Fixes on the way: fixtures name `maintainedEffectStateId`; a zone-only state has no created dependent effects (schema minimum removed, D135); the aura test reads `descriptorJson`.

### T2b (ending, dropping or replacing Concentration removes its zones, D135)

- Red: `ci/spells-20-t2b-red` at `877ceb4ce`.
- Seam: `by_state_encounter` index on `encounterSpatialRuleEffects` (room store and Convex); `maintainedStateZones.ts` (`listStateZones`, `deleteStateZones`); `store.hasDependents` (effects or zones) replaces the effect-only emptiness test at the three `TERMINATE_WHEN_EMPTY` sites; `deleteMaintainedStateCas` refuses a state a zone still depends on. Cleanup DTO `removedZoneIds` is derived and applied in `concentrationCleanupPersistence.ts`; `MAINTENANCE_SLOT` carries `zoneIds` so the Worker and `projectEncounterMovementConcentrationEnd` produce the same DTO. `applyMaintenanceReplacement` and `cleanupRemovedActorEffects` delete the zones of the states they end. Turn completion no longer ends a zone-only state.
- Undo: GM undo of any Concentration end or replacement stays refused (D95), so no zone restore exists; undo of the zone-placing cast already removes zone and state (the zone now goes first, before the guarded state delete).
- Flake (preexisting, also T2a/T3): `nativeRoomEscapeAction` "refuses a check the effect does not allow" asserts `causes` from a process-wide `console.error` spy in `invalidEscape`, so other rooms' logged errors can land in it. Registered as a phase-branch follow-up.
- Known edge, not fixed: Concentration lost in the same settlement that created it, with a zone created afterwards.

### T3 (auras in the session state, viewer-redacted)

- Red: Tests 38978456915 on `c6f4813bd` (`ci/spells-20-t3-red`): the two aura room tests and `activeReads` fail (the other red jobs were the Escape flake and the `encounterWriteSets` budget).
- Green: `897458fa0` on `ci/spells-20-t3`: Tests 38984886789, Live backend 38984886833.
- Seam: `EncounterSessionStateDto.auras` (`id`, `label`, `radius`, `sourceTokenId`). `readEncounterSessionState` (shared by `encounters/activeReads:active` and the room feed) reads the Scene zones once (`readSceneSpatialRows`) for `halfSpeedFieldsOf` and `readSessionAuras`. An aura is listed only when its source actor (found through the token binding) is in the member's own presented projection, so redaction is the one D121 rule, not a second filter. Convex reads pass no fog, so they list only sources the projection lists; the room lists more.
- Only circle zones centered on a token (`anchorKind: 'TOKEN'`) that are public or revealed are auras.
- The second zone read pushed the `encounterWriteSets` 100-actor read over its 250 KiB cap (256197 B), so the two readers share one read. ROOM-6 still owns the real trim.
- Not in T3: drawing the aura on the map (VTT_UI-3.1 consumes `auras`).

### T4a (half damage on a made zone save, slot-level scaling)

- Red: `8b55d392a` on `ci/spells-20-t4a-red`, Tests 38998091848 (Worker aura tests and the zone compile tests).
- Seam: the cast level is a per-action compile input (each slot level is its own compiled action), so the frozen zone entry graph is per level and no schema or placement pinning changed. `zoneDamageRow` picks the PER_LEVEL `SPELL_CAST_LEVEL` row with `selectScalingRow`. An `ON_SAVE_SUCCESS` path with `amountKind: HALF` damage compiles to its own gated dice set (`damage-success-*`) plus a 0.5 `DND5E_DAMAGE_MULTIPLIER` node and a `proposal-on_save_success`; the movement interruption stays on the failed save. A made-save path that applies a grant or doubles stays manual (`NOT_NORMALIZED`).
- A made save's damage comes from its own proposal node, so the zone graph binds it as a second source entry (`sourceEntryBindings`); `requireSupportedApplications` and the spatial evidence schema accept any bound node, not only `frozenGraphNodeId`.
- Spirit Guardians is authored as 3d8 at the 3rd level plus 1d8 per slot level (levels 3-9), half on a made save.
- `semantic-ledger.json` `authoredSha256` is not verified by any code, so it was not regenerated.

### T4c (creatures designated unaffected at cast)

- Red proof: the Tests run's "Red proof against the phase branch" job (no separate red branch).
- Design: authored component flag `choosesUnaffected` (precedent `bypassAtHalfSpeed`) -> compiled zone placement -> choice DTO `choosesUnaffected` on `POINT` / `CASTER_CENTERED` -> optional command `unaffectedActorIds` on those targets -> optional `placement.unaffectedActorIds` (omitted when empty) -> `SpatialEffectInstance.unaffectedActorIds` filtered in `collectSpatialMovementCandidates`. No migration (additive optional fields); web drawer shows a MultiSelect.

### T4b1 (once-per-turn zone-application counter)

- Red proof: the Tests run's "Red proof against the phase branch" job (no separate red branch).
- Design (orchestrator ruling): `zoneApplications` on the Encounter run state, keyed `effectId:actorId`, entry `{ turnSequence, count }`; stale entries count as unspent and are pruned on write; any creature's turn counts (key on the current `turnSequence`); bounded by the actor and effect caps. Authored `maxApplicationsPerTurn` is compiled onto the zone placement and instance; `collectSpatialMovementCandidates` drops a candidate whose limit is spent; `recordZoneApplications` writes executions at the two terminal movement publications (the initial automatic advance deliberately does not record).
- Spirit Guardians now authors `maxApplicationsPerTurn: 1` ("first time on a turn").

### T4b2a (turn-trigger authoring, containment, shared resume helper)

- `interactionKind` is deleted for `interactionKinds` (SRD rows migrated, no fallback). The placement and effect instance carry optional `turnTriggers` (`START_OF_TURN`, `END_OF_TURN`; a turn-only zone has empty `triggerModes`).
- `collectSpatialTurnCandidates` (shared/vtt) is the one containment function: footprint overlap through the movement geometry, `spatialEffectAffects`, and the T4b1 per-turn limit.
- `resumeTargetBoundActiveRuleEffectWithAnswer` (executor) is the shared save-then-dice resume; the spatial service now uses it, behavior unchanged. Spirit Guardians still authors ENTER only until T4b2b.

### T4b2b design (draft, awaiting orchestrator decision on the persisted-result shape)

- Ruling: new `ENCOUNTER_TURN_ZONE_EFFECTS` pending context; at each boundary the active-effect batch runs, then the zone batch, each sorted by effectId. Oil Flask cannot prove END (second component, `requiresIgnition`, `maxApplicationsTotal`); END is proved on a core-options zone, the journey on Spirit Guardians START.
- Why the existing candidate/execution cannot be reused: they bind to an active-effect row (`activeEffectId`, `createdOrdinal`, `effectVersion`, lifecycle). The spatial execution DTOs bind to a movement path (`pathDistance`, `contact`), so they do not fit a turn boundary either. The zone turn candidate/execution is a third shape: `{ordinal, boundaryOrdinal, stage, targetActorId, owner, effectId (placed spatial effect), sourceActorId, definition checksums, placement checksum, targetStateChecksum, d20Policy, diceStage}` with the execution adding `execution`, `d20`, `targetTransition`, `applications`.
- Cascade that makes this the largest slice so far: the staged phases live on the root (`outgoingTurn`) and in the terminal `incomingEffects`; the stored terminal result is a union (`BATCH_COMPLETE ENCOUNTER_TURN_ACTIVE_EFFECTS` or `TURN_LIFECYCLE_COMPLETE` with `outgoingTurn` / `incomingTurn` phase evidence) read by replay, response replay, command admission, void/owner and terminal completion. A zone batch must appear in each of them.

### T4b2b2 (persistence and play: zones act at turn boundaries)

- `persistEncounterTurnZoneEffects` is the one zone-specific persistence; it re-derives containment and the per-turn counter with `selectTurnZoneContacts` (shared with room prep) from the locked Scene, so a moved token, an edited zone or a spent limit refuses the plan. The generic turn seams take `ENCOUNTER_TURN_ZONE_EFFECTS` through their existing dispatch. A turn without zones stores a byte-identical result. Order per boundary: active effects, then zones, each by effectId. The "creature chooses the order" prompt is a parked enhancement.
- Spirit Guardians authors ENTER_SPACE + START_TURN_IN_SPACE and proves START and ADVANCE_TURN START_OF_TURN; END is proved on a core-options zone. Stinking Cloud cannot compile (SPELLS-20.T4b3); Oil Flask stays MANUAL.

### T4e (cast-time damage type, D140)

- Core options cannot express "evil caster": no facet or predicate reads alignment (`shared/facet.ts` predicates cover equipped source, subclass, spellcasting, range, duration, Concentration, ritual, size, and feature or option obtained), and a choice option carries only a label, description and result block.
- What exists: an authored `CHOICE` ON_USE path whose options each carry a result block (Protection from Energy's damage type, Blade Barrier's wall shape). Correction: rules-runtime refused every CHOICE group before this task (those spells go manual), and no kernel choice prompt exists for a cast. Zone placement did not accept it either: `placedSpaceManifest` needed exactly one compiled entry whose outcome is the zone.
- Options sent to Phase 8:
  - A (recommended): the caster chooses, with no alignment check. Spirit Guardians' ON_USE becomes a `CHOICE` path with two options, "Radiant (good or neutral caster)" and "Necrotic (evil caster)", each with the same zone and a different damage type. Generic change: placement accepts a CHOICE path whose chosen option's one outcome is a zone, and the chosen option's behavior is stored on the zone. Cost: the zone is authored twice (as Protection from Energy authors its options).
  - B: a generic damage-type alternative on DAMAGE outcomes, chosen at cast and stored on the placement (the T4c `choosesUnaffected` route). Authored once and reusable (Chromatic Orb, Dragon's Breath), but it is a second cast-time choice mechanism beside CHOICE paths.
  - C: a caster-alignment predicate that picks the type automatically. This is new alignment logic, which the brief rules out.
  - D: radiant only; the GM adjusts necrotic by hand (status quo). Does not meet the task.
- Ruling: A, recorded as D140. The zone is authored once: `auraResult(damageType, bucket)` in `spirit-guardians.ts` builds it, and the options "Radiant" and "Necrotic (evil caster)" each call it.
- Implementation (generic; no Spirit Guardians or alignment code):
  - The compiler (`zoneChoicePlan` in `effectActionCompiler.ts`) compiles an ON_USE CHOICE whose every option places one zone into `compilation.zonePlacement = { options: [{ optionId, label, zone }] }` (`compiledActionZoneChoiceSchema`). The options must share attachment, shape (ignoring its authored id), spared-creature choice, Concentration and any save at the caster's DC, or the action goes manual. Each option's zone freezes its own save and damage graph. The action's facts read the shared save from every option (`zoneEntrySavingThrow`), so the cast resolves the caster's DC once.
  - The pick travels on the command like the T4c spared creatures: `choiceOptionId` on the POINT and CASTER_CENTERED targets, offered as `choiceOptions` on the choice DTO. The Worker places the chosen option's zone (`chosenZonePlacement`) and refuses a missing or unknown pick with TARGET_UNAVAILABLE. Later triggers run the stored definition, so trigger-time code is unchanged.
  - The Tabletop action drawer shows a Select of the options (first preselected).
  - Proofs: `nativeRoomSourceAura.test.ts` (cast, pick Necrotic, a later walk-in deals necrotic damage; the pick is stored on the aura; no pick or an unknown pick is refused), `encounterZoneChoiceCompilation.test.ts` (a non-spell Caltrops variant picking between two zones; options with different areas go manual), and the authoring-parity test (the CHOICE passes the equipment node map unchanged).

### T4b3a (fully-within containment, automatic save success)

- T4b3 is split (D141): T4b3a covers containment, automatic success and Stinking Cloud's unmodeled options, proved on a core-options zone; T4b3b covers LOSE_ACTION and the Stinking Cloud room journey.
- `requiresFullyWithin` travels from the component to the compiled placement, the stored placement and the spatial instance. `collectSpatialTurnCandidates` then requires the footprint to lie wholly inside the area: every corner inside a circle, or the shared area equal to the footprint for a polygon. The compiler refuses it on a zone with a movement trigger instead of half-honoring it.
- `automaticSaveSuccessImmunityDamageTypeId` (D141: one optional authored damage type id, any type; the authoring form picks one damage type) pins that damage type on the zone entry. The binder sets `SAVE_AUTO_SUCCESS` when the target holds an IMMUNITY defense to it, and the made-save path runs. Like D94's auto-fail, the roll is still asked for and not counted. A list widens the field with its first consumer. "Does not breathe" is a deferred edge case (D141, future-enhancements): no creature fact says it.
- Stinking Cloud now authors poison immunity through that field. Its heavy obscurement, spreading around corners and wind dispersal are unauthored and listed in the `zoneInteractionKinds.test.ts` gaps (T1a precedent). It still goes manual until T4b3b compiles LOSE_ACTION.
- Proofs:
  - `vtt-spatial.test.ts`: circle and polygon, fully within versus half out.
  - `encounterZonePlacementCompilation.test.ts`: the flag on the zone and its placement; the refusal for a movement trigger.
  - `encounterTurnZoneEffects.test.ts`: a real turn stage. A goblin half out of the zone is not caught, but the same footprint is caught by an overlap zone. A real SRD Skeleton (poison-immune) takes no damage on the lowest roll from a zone naming poison, but is hit by one naming fire; the goblin is hit by both.

### T4b3b (LOSE_ACTION, one composable zone failure set, Stinking Cloud journey)

- `zonePlacementPlan` classifies the failed save into one set (D142): damage rows, at most one stop, grant, System-vocabulary condition and lost Action, at least one outcome; a made save only deals damage. No branch per shape remains, and T1d's condition-alone case is a member of the set. Damage plus a condition is refused until SPELLS-4.T1e (D142 amendment, one graph outcome).
- With no graph outcome (a lost Action alone) the entry binds the save's `test` node; the executor allows empty applications on a path with no proposal node (`emptyApplicationAllowed`).
- `LOSE_ACTION` (D141) compiles only at the start of a turn and sets `failedSaveLosesAction` on the placement. The turn stage spends an unspent Action after the refresh (`actionEconomy` on the spatial turn execution, null when already spent) and persistence settles it through `consumeNativeActionEconomy`.
- Stinking Cloud now compiles and plays.
- Proofs:
  - `encounterZonePlacementCompilation.test.ts`: the composable set (lost Action alone, damage+stop+grant+lost Action, condition alone, condition+lost Action) and every refusal variant (damage+condition, two of a single, out-of-vocabulary condition, an unheld kind, made-save-only, a made save costing the Action, a lost Action with a movement or end-of-turn trigger).
  - `encounterTurnZoneEffects.test.ts`: the Action spent, a no-op when spent, spent once by two zones, nothing on a made save, damage and the lost Action together.
  - `turnZoneEffectsPersistence.test.ts`: the stored actor's Action, a forged transition refused, a stale actor refused.
  - `nativeRoomHazardZoneSpells.test.ts`: the SRD Stinking Cloud cast in the room costs the Wolf its Action at its turn start.

### T4f (START journey, pending-prompt interleaves, spatial resume checks)

- START journey: the room harness (`movementRoom`/`actionRoom`) takes `status: 'PREPARED'` (round 0, no current actor, an ACTOR_ROLL initiative policy at Encounter start) and a `seed` that receives the Scene spatial scope. `nativeRoomTurnZoneEffects.test.ts` places a core-options START_TURN zone under the Wolf with the real planner, sends START, and proves the incoming zone save, the damage, `zoneApplications` and an exact replay.
- Interleaves: Concentration end at the Sheet, REMOVE_ACTOR of the caster and REVERT_LAST_ACTION, each sent while a turn-start zone save or a paused walk into the aura is pending, are refused with PENDING_DECISION. The zone survives and the answer commits. Gap found and fixed: the Sheet END_CONCENTRATION path had no pending fence, so it deleted the aura under the prompt. The guard lives in `endChosenConcentration` (`concentrationChosenEnd.ts`, encounter-persistence), the one seam that ends a Run's maintained Concentration and its placed zones. Both the room Sheet path and the Encounter END_CONCENTRATION command call it, so it moves unchanged with the QUALITY-1 executor merge. Its refusal rolls back the Sheet write in the same transaction (the room test checks the stream version and the Concentration slot). The room's Sheet socket path maps an `EncounterDomainRejection` to its reason, through the one `#sendDomainRejection` that every room rejection site uses. The Convex Sheet path cannot reach this state: its END_CONCENTRATION (`sheetConcentration.ts`) ends only Campaign-clock carried grants (`encounterId: null`) and leaves holders fighting in an ACTIVE Run to that Run's room. A Character in a live Run is held by the room, so Convex refuses its play commands (`assertConvexOwnsCharacterPlay`). A Run's maintained state and its zones end only through `endChosenConcentration`. REMOVE_ACTOR already refused, but with a plain `Error` (logged as a room failure, no reason); `actorRemovalCommand.ts` now refuses with PENDING_DECISION like undo and admission. Account-cleanup removal (a departing player's creature) still proceeds under a pending prompt; its version bump makes the pending commit refuse as stale. A Sheet edit that ends Concentration through D95 (`endConcentrationAfterEdit`) stays unfenced: the commit then refuses as stale (zone gone), the same as a GM void case. This is rare (<5%) and recoverable.
- Spatial resume (`encounterSpatialMovementStale.test.ts`): the harness used to resume from the start point at Scene version 1, while a pause moves the token to the contact and advances the Scene, so every resume hit 'The paused spatial movement root is stale.'. The 'zone version bumped' and 'creature changed' tests passed for that reason only. The harness now resumes from the paused root, and they assert the guards that fire: 'A spatial root changed before execution.' (row lock) and 'The current spatial contact is stale.'. Two zones on one space queue a second contact. Resuming unchanged pauses on the second zone; a second zone row that advanced since the pause refuses with 'The remaining spatial contacts changed.'
- The frozen-reaction selection check ('The frozen spatial candidate selection is stale.') compares the caller's root against the sealed remainder that the candidates come from, so stored data cannot reach it: the pending snapshot is checksum-verified on read (`pendingSnapshots.ts`). Live changes during a reaction pause are caught by the lock check and the frozen currentness check. It stays as a seal-integrity guard, untested by a hand-corrupted remainder.
- The `frozenTerminal` input of `evaluateEncounterSpatialMovementRuleBatch` has had no caller since `8b7459d6d` (Convex movement rules deleted), so it is deleted with its checks and `verifyFrozenTerminalIdentity`.

### T6a (source-turn zone outcome with no save, D144)

- Vocabulary: interaction kind `START_OF_SOURCE_TURN` (schema, shared type, authoring option) maps to the placement turn trigger `START_OF_SOURCE_TURN`; `SPATIAL_TURN_TRIGGERS` is the one ordered list (it replaces `turnTriggerOrder`). END_OF_SOURCE_TURN was rejected by D144.
- Compiler: `unsavedZonePlacementPlan` compiles a non-save behavior with `ON_USE` damage to one unmodified dice row dealt in full, with no test node; turn boundaries only.
- Turn stage: contacts across every bound token; at the boundary creature's START, others in its `START_OF_SOURCE_TURN` zones are caught, ordered by actor id then effect id (`followsInZoneTurnOrder`, enforced by the pending and phase schemas). The phase stores one chained batch per caught creature.
- Dice with no d20 policy: the damage die is answered with `d20: null`, the source rolls (`awaitsSpatialDamageDice`), and automatic evidence auto-rolls the save only when a policy exists.
- Persistence and Worker: the cleaving bindings capture is renamed `ACTOR_TOKEN_BINDINGS` (`readEncounterActorTokenBindings`, `actorTokenBindings.ts`) and serves the turn path too; settlement order is shared with movement (`orderSpatialSettlementActors`).
- Proofs:
  - `encounterZonePlacementCompilation.test.ts`: the START_OF_SOURCE_TURN trigger, the dice-and-proposal graph with no d20/test node, and refusals (a mover trigger, halved dice, a stop).
  - `encounterTurnZoneEffects.test.ts`: two creatures caught at the source's START in actor-id order, the source spared; quiet at other boundaries; the source answers each die when it does not auto-roll; the stored multi-creature phase accepted, and rejected out of order or missing a transition.
  - `turnZoneEffectsPersistence.test.ts`: one batch per caught creature in settlement order, the source untouched.
  - `nativeRoomTurnZoneEffects.test.ts`: a core-options no-save field damages the Wolf at the caster's turn start, not at the Wolf's own, with an exact replay.

### T6b (a Creature's passive zones, D144)

- Discovery: a PASSIVE feature Effect manifesting one zone that acts at its source's turn compiles to `passiveZones` (never an offered action); the authoring nits from T6a (`...placement!`, `successImmunity`) are folded in.
- Placement: `planEncounterPassiveZones` (rules-runtime) plans one TOKEN-anchored zone per passive zone feature of each Creature bound to a token, on the Run's effective grid, with no maintained state and an id fixed by Encounter, actor and feature Effect, so placing again is idempotent. `placeEncounterPassiveZones` (encounter-persistence) is the one placement helper (D147): the START terminal calls it before the incoming zone phase, and a GM token bind in a PREPARED or ACTIVE Run calls it for the bound actor. The room's turn preparation plans the same START records (`plannedSpatialEffectRecord`) so the first turn's contacts match the terminal's re-derive. `persistEncounterTurnCommit` now takes `readScene` (grid and tokens) instead of `readSceneTokens`; the token-binding command's `hasToken` callback became `readToken` (room and Convex).
- REINFORCE: a reinforced Creature joins with no token binding, so there is nothing to place at REINFORCE itself; it gets its zone when the GM binds its token, through the same helper. No REINFORCE call was added, since it would always place nothing.
- Lifecycle: removing the Creature deletes its passive zones (`deleteActorPassiveZones`, first step of `cleanupRemovedActorEffects`), and so does any token bind or unbind in a PREPARED or ACTIVE Run before a bind re-places them, so a rebind re-anchors them; FINISH deletes every Scene effect (unchanged). A defeated source's zone stays stored and drawn but catches no one: `toSpatialInstances(effects, actors)` derives `SpatialEffectInstance.suppressed` from the Run's defeated actors, and `spatialEffectAffects` honours it, so every candidate seam (turn contacts in the room plan and the terminal, both movement passes, forced movement) shares one derivation and a revived source has the zone again with no new placement. `isEncounterPassiveZone` is the one predicate (TOKEN anchor, no maintained state).
- Undo: GM undo of START and REINFORCE is refused today (`actionRevert.ts`), so no zone needs reverting. Any future undo of START or REINFORCE must delete the passive zones they placed (D147).
- Pit Fiend Fear Aura: stays on its CLOSED_RULE; its conversion is in future-enhancements (D147). T6c (Balor Fire Aura) is the first SRD consumer.
- Proofs:
  - `encounterZonePlacementCompilation.test.ts`: the aura compiles to a passive zone; a mover-triggered copy does not.
  - `encounterPassiveZones.test.ts`: one TOKEN zone per bound Creature, the same id from any command, none for an unbound Creature; a defeated source's zone catches no one and acts again once revived.
  - `nativeRoomTurnZoneEffects.test.ts`: a room START places a core-options aura on the Wolf's token and burns the adjacent Zombie at the Wolf's first turn start, replaying exactly; REMOVE_ACTOR deletes it; unbinding the Wolf's token deletes it and binding the token again places the same zone on it.

### T6c (the Balor's Fire Aura as a passive zone, D144)

- Data: the SRD Balor's Fire Aura is a PASSIVE feature Effect manifesting one SOURCE zone (5-foot sphere) whose component acts at `START_OF_SOURCE_TURN` with 3d6 fire and no save. `CREATURE_BALOR_FIRE_AURA` is deleted from the closed rule kinds. The melee-hit and touch retaliation in its text is T6d.
- Proofs:
  - `creatureZoneAuthoringParity.test.ts` (authoring, ADR 0038): the Balor and a 10-foot 2d8 variant pass the creature node map unchanged, with no closed rule.
  - `encounterPassiveZones.test.ts`: the Balor plans the same zone placement and spatial state as a core-options 3d6 aura, apart from its label.
  - `nativeRoomTurnZoneEffects.test.ts`: a room START places the Balor's aura on its token; once the GM settles the initiative tie (both Dexterity 15) with the Balor first, the adjacent Wolf takes 3d6 fire at the Balor's turn start.
  - `zoneAttachment.test.ts`: the corpus audit now names each zone's owning subject (creatures author no `kind`) and lists the Balor among the SOURCE zones.

### T6d1 (melee-hit retaliation authoring, D153)

- Contract: the zone interaction kind `MELEE_HIT_ON_SOURCE` (schema, shared kind, path option). `zoneTriggers` compiles it to `retaliatesMeleeHits: true` on the placement, beside any turn trigger of the same component; a zone with only this kind has no movement or turn trigger. The compiler refuses it on a zone not centered on its source. A zone placement may carry an optional `sourceGrant`: one APPLY_GRANT beside the zone manifest in the same result (or the same cast-choice option), compiled through `modifierGrantEntryPlan` as a timed grant on the active-effect clock. A zone with two grants or any other extra outcome is not a placed zone. `CompiledActionActiveEffectPlan` is now a named type (TS7056).
- Data: the Balor's Fire Aura component authors both `START_OF_SOURCE_TURN` and `MELEE_HIT_ON_SOURCE`. Deviation from D153's "second component": the damage is identical and a placed zone allows one component, so one component carries both kinds. Fire Shield is an ON_USE cast choice (warm/chill), each option a 5-foot SOURCE zone answering melee hits with 2d8 fire/cold and a 10-minute (100-turn) cold/fire resistance grant; the zone has no maintenance and lasts the Run (D153 amendment). CLOSED_RULE `FIRE_SHIELD` is deleted in T6d2a.
- Applied in T6d2a: the attack-time seam, the receipt, `sourceGrant` at placement and both fields on the persisted placement.
- Proofs:
  - `encounterZonePlacementCompilation.test.ts`: both interactions compile together; a melee-only zone has no turn trigger; the flag is absent without the kind; the Balor compiles the same zone as a core-options 3d6 aura answering melee hits (ADR 0038); a PLACED_SPACE zone with the kind goes manual.
  - `encounterZoneChoiceCompilation.test.ts`: Fire Shield compiles two SOURCE 5-foot zones, melee-hit only, no maintenance, 2d8 fire/cold, and a 100-turn cold/fire resistance grant; a variant with another radius, dice, element and resistance compiles accordingly (ADR 0038); no grant without one; two grants or a non-grant outcome place no zone.
  - `sourceZoneAuthoringParity.test.ts`, `creatureZoneAuthoringParity.test.ts`: Fire Shield and the Balor pass their node maps unchanged.
  - `zoneAttachment.test.ts`: Fire Shield is among the SOURCE zones.

### T6d2a (melee-hit retaliation on an ordinary action, D153)

- Seam: `selectMeleeRetaliationContacts` (rules-runtime) picks the zones the hit creature holds on its own token that contain the attacker (`collectSpatialMeleeRetaliationCandidates`), against the Run's actors before the action, with a selection checksum. Melee is `isInstalledMeleeAttackTrigger` plus a range that parses as `rangeDtoSchema`. `planEncounterMeleeRetaliation` executes each zone against the attacker from the state the last left, the system rolling every die, and plans the attacker's one mechanics batch (`MELEE_RETALIATION` phase). The worker plans it after the action's own effects (`nativeMeleeRetaliation.ts`); concentration damage to the attacker goes through `nativeActionDamage(batch)` beside the action's own.
- Receipt: `applicationOutputs.meleeRetaliation` on both mechanics batches (`meleeRetaliationEvidenceDtoSchema`: selection checksum, per-zone candidate, applications and target transition). `meleeRetaliationPersistence.ts` re-derives the selection from the locked Scene and the action's pinned tokens and refuses a stale one; it pins a Character attacker's stream version. An action planned with no retaliation relies on the Run version check, since every zone placement is a Run command. Undo restores a Creature attacker's hit points and refuses for a Character attacker, as other cross-actor Character writes do.
- Placement: `retaliatesMeleeHits` is persisted on the placement. `sourceGrant` is applied at placement: the worker prepares the caster's timed grant through `prepareRecurringActiveEffect` (`prepareNativeZoneSourceGrantEffect`) and carries it as the area commit's `zoneSourceGrant`; the area root's receipt records it as `sourceGrantTransition` (source only, and only with a placed zone). Persistence checks owner, origin, system and receipt projection before creating it; undo deletes it before the zone.
- CLOSED_RULE `FIRE_SHIELD` is deleted.
- Remaining (T6d2b): retaliation on opportunity attacks and Legendary Action attacks (done below).
- Proofs:
  - `encounterMeleeRetaliation.test.ts`: selection inside and beyond the shield, the checksum pinning zone version and tokens, system-rolled 2d8 with the attacker's one batch, and two shields applied in effect-id order.
  - `vtt-spatial.test.ts`, `spatial-contracts.test.ts`: contact collection and the receipt contract.
  - `nativeRoomMeleeRetaliation.test.ts` (room): a Wolf biting the Balor takes 3d6 fire; a Goblin's Scimitar hit on a warm Fire Shield caster takes 2d8 fire and undo restores it; its Shortbow hit takes nothing; the cast grants the caster its resistance.

### T6d2b (melee-hit retaliation on opportunity and Legendary Action attacks, D153)

- Opportunity attacks: `planReaction` (`encounterMovementActionResponse.ts`) runs the same step after a melee reaction hits, with the mover's token at the reaction's contact (`option.candidate.contact`) and the reactor as attacker; the evidence is the reaction application's `meleeRetaliation`. A staged response replays it from that evidence (`retained`). `liveMovementReactionPersistence.ts` re-derives the selection from the locked Scene with the mover at the contact and writes the reactor's batch; the settlement counts the reactor among the damaged actors. The reactor's Character span is appended beside the reaction's own (`encounterMovementChangedAggregates.ts`), so the reaction's `characterTransitions` stay its own.
- Legendary Actions: `prepareTurnLegendaryActions` takes an optional `meleeRetaliation` port; the worker binds it to the bound Scene's tokens and zones (`nativeEncounterTurnPreparation.ts`). The owner's retaliation is planned against the Run as the hit found it, carried on the window's `application.meleeRetaliation`, and replayed exactly from that evidence on every later run of the coordinator (a later window's answer re-runs the earlier ones); a retained window whose replay plans no retaliation is stale. Concentration damage to the owner goes through `legendaryActionDamage`. `turnResourcesPersistence.ts` writes the owner's batch after its charge.
- `planEncounterMeleeRetaliation` replays recorded faces (`spatialExecutionRecordedFaces`) and refuses evidence that differs or leaves a die unused.
- Proofs:
  - `encounterMeleeRetaliation.test.ts`: a replay rebuilds the same evidence with no fresh die; an edited zone or missing recorded die is refused; a Creature attacker has no Character span.
  - `nativeRoomMeleeRetaliation.test.ts` (room): a Wolf whose opportunity Bite hits a mover holding a warm Fire Shield takes 2d8 fire, recorded on the reaction.
  - `nativeRoomLegendary.test.ts` (room): a dragon whose Legendary Tail hits a shielded Wolf takes 2d8 fire; the second dragon's declined window replays the first window and the burn is not applied twice.

### T5a (occupant save-bonus aura contracts, D155)

- Contract: a zone component may author `occupantSaveBonus` (schema, shared type, component node map): `domain: 'EVERY_SAVING_THROW'`, `dispositionFilter: 'ALLIES_AND_SOURCE'`, and either a `FIXED` amount or a `SOURCE_ABILITY_MODIFIER` with an optional `minimum`. A component with the bonus authors no behavior (`placedSpaceZone` returns `behavior: null`).
- Compiled: `occupantSaveBonus` on `compiledActionZonePlacementSchema`, amount `{kind: 'FIXED', value}` or `{kind: 'SOURCE_ABILITY_MODIFIER', ability, minimum | null}`. The placement has no trigger mode, turn trigger or grant; its entry is a lasting one-node graph (`durationPublishedGraph`) keyed by the zone entry id, so the spatial definition keeps one shape. The compiler refuses the bonus on a zone not centered on its source, beside any trigger, movement cost, blocking rule or other component rule, and refuses any scaled size except a radius scaled by class level.
- Placement (transitional): `planEncounterPlacedZone` refuses a zone with the bonus or a class-level radius, since placement does not yet resolve them against the source. T5b resolves both, places Character passive zones and applies the bonus at save time; the bound save fact records the bonus (orchestrator requirement).
- Data: the Paladin's Aura of Protection is a PASSIVE source zone: a 10-foot sphere scaling to 30 feet at paladin level 18, lending the Charisma modifier (minimum 1) to the paladin and its allies. CLOSED_RULE `CLASS_PALADIN_AURA_OF_PROTECTION` is deleted.
- Proofs:
  - `encounterOccupantSaveBonusCompilation.test.ts`: the SRD aura compiles to an untriggered source zone with the Charisma bonus and the scaled radius; it equals a core-options aura (ADR 0038); a fixed bonus compiles as authored; a trigger, a movement cost or a cast-level radius beside the bonus is unavailable; a point-placed zone with it goes manual; placement refuses it.
  - `classAuraAuthoringParity.test.ts`: the SRD aura and a fixed +2, 15-foot variant pass the class node map unchanged.

### T5b (Character passive zones placed and resolved, D155)

- Compile: a source ability-modifier bonus or a class-level radius compiles only on a PASSIVE zone (a cast zone needing one is unavailable); a FIXED bonus stays allowed on cast zones.
- Character discovery: `buildCharacterActionRuleFacts` routes PASSIVE feature, option and feat Effects that manifest a placed space into `passiveZones` (never policy facts or actions); the rule evaluation carries them as `passiveZoneSources`.
- Placement: `planEncounterPassiveZones` places Creature and Character zones; a Character's come from its rule evaluation (`characterRules`), compiled through `compilePassiveZone`, the one zone compile Creatures use too. `zoneShapeAtSource` resolves the class-level radius; `planEncounterPlacedZone` pins the bonus from `PlacedZoneSource` and the transitional refusal is gone.
- Hosts: `placeEncounterPassiveZones` takes `{ readScene, readCharacterRules(campaign, characterId) }`. Convex bind reads `loadCharacterSheetFacts` as the Campaign owner; the room bind and START commit read `readRoomOwnerCharacterRules`; the room START plan reads the turn's loaded targets, so plan and commit agree.
- Proofs:
  - `encounterPassiveZones.test.ts`: a paladin 6 with Charisma 16 keeps a 10-foot token zone lending +3; at 18 with Charisma 8 it reaches 30 feet and lends +1; the id is stable; no rules, no token or no acquired aura places nothing.
  - `encounterOccupantSaveBonusCompilation.test.ts`: placement pins the bonus and the 30-foot reach against its source, and refuses a modifier bonus with no source (replaces T5a's transitional refusal test, a deliberate behavior change).

#### Zone table: SRD zones with turn-start/end text (static audit, 2026-10-17)

A placeable zone is one ZONE manifest (label, shape, one component, one behavior), a point or caster-centered sphere/cylinder/circle/cube, a PASSIVE save with damage on failure (plus an optional stop-movement and one grant) and half damage on success.

| Zone                                                           | Trigger         | Authored today                             | Placeable | Exact blocker / verdict                                                                               |
| -------------------------------------------------------------- | --------------- | ------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------- |
| Spirit Guardians                                               | E+S             | ENTER_SPACE, START_TURN_IN_SPACE           | yes       | Flipped in this slice. Evil-caster necrotic choice: SPELLS-20.T4e. Half speed: T4d                    |
| Cloudkill                                                      | E+S             | bare ZONE                                  | no        | No label/shape/component; full zone authoring (SPELLS-4.2 T1a). Drift/obscurement unmodeled           |
| Insect Plague                                                  | E+N             | bare ZONE                                  | no        | Same (T1a)                                                                                            |
| Incendiary Cloud                                               | E+N             | CLOSED_RULE                                | no        | Not a ZONE; no closed-rule compile path (T1c)                                                         |
| Moonbeam                                                       | E+S             | CLOSED_RULE                                | no        | Same, plus shapechanger rider (T1c)                                                                   |
| Blade Barrier                                                  | E+S             | ENTER_OR_PASS_THROUGH, START_TURN_IN_SPACE | no        | WALL/ring shape; `movementCostMultiplier`, `blockingRules`, `hollow`, `wallThickness` unmodeled (T1b) |
| Wall of Fire                                                   | E/N, no save    | CLOSED_RULE                                | no        | Not a ZONE; wall geometry; no-save damage (T1b)                                                       |
| Wall of Thorns                                                 | E/N             | CLOSED_RULE                                | no        | Not a ZONE; wall geometry; movement cost (T1b)                                                        |
| Stinking Cloud                                                 | S               | START_TURN_IN_SPACE                        | no        | LOSE_ACTION outcome, `requiresFullyWithin`, auto-success conditions (SPELLS-20.T4b3)                  |
| Black Tentacles, Web                                           | E+S             | bare ZONE                                  | no        | RESTRAINED failure outcome (T1d)                                                                      |
| Grease, Sleet Storm                                            | E/N             | bare ZONE / CLOSED_RULE                    | no        | Prone, no damage row (T1d)                                                                            |
| Forbiddance                                                    | E+S, no save    | bare ZONE                                  | no        | No-save damage, creature-type filter, password                                                        |
| Hallow, Control Water (whirlpool), Zone of Truth, Gust of Wind | E+S             | bare / CLOSED_RULE                         | no        | Non-damage, multi-mode or push outcomes                                                               |
| Prismatic Wall                                                 | proximity, S    | ENTER_OR_PASS_THROUGH + `proximityRule`    | no        | Blinded outcome, proximityRule, multi-component. Named rules-gap exclusion in the corpus test         |
| Oil Flask                                                      | E or N, no save | ENTER_OR_PASS_THROUGH, END_TURN_IN_SPACE   | no        | No-save fixed damage, `requiresIgnition`, 2 components; stays MANUAL                                  |

No turn text: Sunbeam (saves on cast and new line only), Wall of Ice, Spike Growth, Entangle, Silence, Darkness, Fog Cloud. Not zones: Flaming Sphere (mobile), Guardian of Faith (enter-only). Creature/item auras with turn text are not audited (ATTACK-5.15). Corpus test: `packages/source-data/src/srd/zoneInteractionKinds.test.ts` fails while an authored zone with turn text lacks START/END (bare zones join once authored).
