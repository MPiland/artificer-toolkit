# Slice SPELLS-20: auras that move with their source

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

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
- `D-pending-spells-20` (T1b decisions, Phase 8 assigns the number):
  5. A SOURCE zone reuses the placed-zone compile and creator; the caster's save DC is pinned at placement from the resolved action mechanic, not rolled.
  6. Radius is the authored radius plus half the token width (circle, not the rounded rectangle of the SRD wording): smaller than the rule on diagonals for a square token.
  7. Until T4 a higher-slot cast deals the base 3d8, a made save deals 0 (no half damage), and there is no half-speed or start-of-turn damage. Each is a refused or absent zone feature, not partly honored.
  8. Spirit Guardians' necrotic-or-radiant alignment choice has no generic option; the zone is radiant.
- Follow-up: the aura's alignment-damage choice (generic authoring option).
- CI fixes on 4ee8b1c65: `zoneAttachment.test.ts` now expects Spirit Guardians among the SOURCE zones (the intended T1b change, assertion widened by the one new owner, none removed); the zone-save helper moved into `characterActionRuleFacts.ts` because the web boundary test (ADR 0036 S6) forbids the web bundle reaching `encounter*` rules modules.

Docs updated by the tasks that change them: `rules-runtime.md` (zone seam), `persistence.md` / `transport.md` (aura projection), ADR 0038 note (SOURCE zones).

### T2a (zone-only cast opens Concentration, zone is its dependent, D135)

- Red: `ci/spells-20-t2a-red` at bac84acaa. Tests: `nativeRoomSourceAura.test.ts` (state opened, zone points at it, GM undo removes both), `spatialEffectStore.test.ts` (`maintainedEffectStateId` round trip), `encounterZonePlacementCompilation.test.ts` (non-concentration zone compiles `maintenance: null`).
- Seams: `compiledActionMaintenanceSchema` shared by the effect plan and `zonePlacement.maintenance`; `maintainedEffectStateId` on the stored/record spatial-effect schemas and `LiveSessionPlacedSpatialEffect`; area root `maintenanceTransition` for a cast no creature outcome carries; `prepareMaintenanceReplacement` and `applyMaintenanceReplacement` split out of the effect persistence so the root and a creature outcome share them; identical policies on a cast's effect and zone are one Concentration.
- Dev data: local Encounters with placed zones need a reset (new required column, no compatibility default).
- Left to T2b: cleanup removes dependent zones (`removedZoneIds`, `by_state_encounter` index), GM undo restores them, a replacement removes the old zone (until then a replaced state leaves its old zone pointing at a deleted state).
