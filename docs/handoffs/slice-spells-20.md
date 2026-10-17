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
