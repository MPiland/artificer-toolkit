# Slice SPELLS-4: SRD hazard zones from core options

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Resume here

- T1 (audit) is done: the zone table is in [slice-spells-20.md](slice-spells-20.md#zone-table-srd-zones-with-turn-startend-text-static-audit-2026-10-17).
- T1a (Cloudkill and Insect Plague) merged in m80; T1c (Moonbeam and Incendiary Cloud) in m81. The Moonbeam shapechanger rider waits on the ruling below. T1d (prone zones: Grease, Sleet Storm) is on `ci/spells-4-t1d`; its restrained zones (Web, Black Tentacles, Entangle) wait on the T1d ruling below. T1b (wall geometry: Wall of Fire, Wall of Thorns) merged in m103. T1b2 (Wall of Fire's one-side band) is in m106. T1g (the save as a zone appears, seven spells) is on `ci/spells-4-t1g`; Blade Barrier's re-authoring is SPELLS-30.T2.

## Scope

- AC SPELLS-4.2: every SRD hazard zone spell places a zone whose entry and turn rules are authored from core options and resolve in Encounters.
- No spell-specific code: each zone is authored data compiled by the generic placed-zone compiler (`placedSpaceZone`, `zonePlacementPlan`). A rule the compiler does not model stays unauthored and is named below, never partly honored.

## Log

### T2b (description-only closed rules, D156 T2 class C)

- The 34 class C spells drop their `CLOSED_RULE` outcome, and their kinds leave `CLOSED_RULE_KIND`: Arcane Lock, Arcanist's Magic Aura, Astral Projection, Clone, Comprehend Languages, Demiplane, Detect Thoughts, Disguise Self, Dream, Feather Fall, Gentle Repose, Guards and Wards, Meld into Stone, Mislead, Nondetection, Passwall, Prestidigitation, Private Sanctum, Programmed Illusion, Purify Food and Drink, Rope Trick, Seeming, Sending, Speak with Animals, Speak with Dead, Speak with Plants, Stone Shape, Suggestion, Thaumaturgy, Tongues, Water Breathing, Water Walk, Wish, Zone of Truth.
- The 17 that already authored a `MANUAL_ADJUDICATION` beside the closed rule keep it alone (`SEQUENCE` becomes `SINGLE`). The other 17 had only the closed rule, so it becomes a `MANUAL_ADJUDICATION` with the same id, like the 35 description-only spells before them (Detect Magic): its instructions quote the description's opening, and the GM rules the rest. The spell stays castable in an Encounter, which spends the Action.
- Proof: `packages/source-data/src/srd/descriptionOnlySpells.test.ts` (no closed rule at any depth, the description intact, every ruling's instructions quoted from it, no kind left).

### T1g (the save as a zone appears)

- Contract (D154 amendment, option B): the cast authors its appear save as an ordinary ON_USE `SAVING_THROW` path beside the zone manifest, run as the cast's area occurrence against the zone's aimed area. Grease, Insect Plague and Incendiary Cloud author both triggers (cast and zone); Wall of Fire (5d8 fire) and Wall of Thorns (7d8 piercing) deal half on a success; Wind Wall (3d8 bludgeoning) places a zone with no interaction; Entangle's save is its only one, restraining the creature held by its zone with the T1e escape.
- Code: `zonePlacementPlan` accepts a WALL area and a component-less zone; the entry-point compiler compiles the appear save with its held lifecycle stripped and the zone's target shape; the Worker catches the area for it (`appearSave`, snapshot `zoneAppearSave`) and plans Entangle's hold through `planSpatialHeldCondition`. Spatial schemas no longer require a trigger.
- Out of scope: Wind Wall's projectile and gas blocking (future-enhancements).
- Proofs: `nativeRoomZoneAppearSave.test.ts` (full and half damage, a creature outside spared, undo, Grease prone, Entangle restrained and held, escape, Concentration end, undo), `characterSpellCastActions.test.ts` (all seven compile, triggers kept, Entangle's hold, Wind Wall inert, a held condition beside components refused), `zoneInteractionKinds.test.ts`. Setup-only changes: the hazard turn tests stand a Brown Bear in the area (it survives both saves) and Grease's turn test wins its appear save.

### T1a (Cloudkill and Insect Plague)

- Authoring only, no product code: each spell's `PLACED_SPACE` `ZONE` gains its label, the 20-foot sphere, one component and one PASSIVE Constitution save against `SOURCE_SAVE_DC`. Damage is a `PER_LEVEL` `SPELL_CAST_LEVEL` row (Cloudkill 5d8 poison, Insect Plague 4d10 piercing at the 5th level, one die more per slot level up to the 9th) on the failed save, halved on a made save. Triggers: Cloudkill `ENTER_SPACE` + `START_TURN_IN_SPACE`, Insect Plague `ENTER_SPACE` + `END_TURN_IN_SPACE`, both `maxApplicationsPerTurn: 1` ("for the first time on a turn"), the same options Spirit Guardians uses.
- Proofs:
  - `apps/session-worker/test/nativeRoomHazardZoneSpells.test.ts`: a real cast in the local room places the fixed zone (label, triggers, per-turn limit, Constitution and the caster's pinned DC); entering it at 5th and 6th level deals the rolled dice; the turn boundary each spell names (Cloudkill start, Insect Plague end) runs the save and damage, and the other boundary does nothing.
  - `packages/authoring/src/nodeRuntime/sourceZoneAuthoringParity.test.ts`: both zones pass the equipment node map exactly as authored (ADR 0038 parity).
  - `packages/source-data/src/srd/zoneInteractionKinds.test.ts`: both components author their entry and turn triggers; the named gaps below are recorded. Both spells now also join the turn-trigger corpus check.
  - `packages/source-data/src/srd/saveForHalfDamage.test.ts`: both left the damage-not-authored list (its rule: a spell leaves the moment its damage is authored) and now carry the halved success path.
- CI on `7544db3c3`: Tests 39047887206 and Live backend 39047887179 green. Red proof: the room test, `zoneInteractionKinds` and `saveForHalfDamage` RED; the parity test ALREADY-PASSING (the earlier bare zone passed the node map too, so it guards against regression rather than proving new behavior).
- Named gaps (not authored, because the zone compiler refuses an option it does not model; recorded in `zoneInteractionKinds.test.ts`):

| Spell         | SRD rule                                                                         | Authoring option                           | Owner                         |
| ------------- | -------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------- |
| Cloudkill     | Heavily obscured area                                                            | `obscurementKind: 'HEAVY'`                 | none registered               |
| Cloudkill     | Spreads around corners                                                           | `spreadsAroundCorners`                     | none registered               |
| Cloudkill     | Drift: moves 10 ft away from the caster at the start of each of its turns        | none (new core option)                     | none registered               |
| Cloudkill     | Sinks to the lowest ground; strong wind disperses it                             | none (new core option)                     | none registered               |
| Insect Plague | Lightly obscured area                                                            | `obscurementKind: 'LIGHT'`                 | none registered               |
| Insect Plague | Spreads around corners                                                           | `spreadsAroundCorners`                     | none registered               |
| Insect Plague | Difficult terrain                                                                | component `movementCostMultiplier`         | SPELLS-20.T4d (movement cost) |
| Insect Plague | Each creature in the area saves when it appears                                  | none: a zone-placing cast has no area save | none registered               |
| Insect Plague | A creature that enters and ends the same turn in it saves twice (SRD); once here | per-turn limit counts every application    | orchestrator decision         |

- The last row is a semantic question for the orchestrator: `maxApplicationsPerTurn` counts entry and turn-boundary applications together (T4b1 ruling), while the SRD "for the first time on a turn" limits only entries. Options: (a) keep it (one save on enter-then-end; Spirit Guardians has the same shape on start-then-re-enter); (b) count only movement triggers against the limit, which changes T4b1 for Spirit Guardians too; (c) drop the limit on Insect Plague (two saves, but repeated entries in one turn each trigger).

### T1c (Moonbeam and Incendiary Cloud)

- Authoring only, plus the retired `CLOSED_RULE_KIND` entries `MOONBEAM` and `INCENDIARY_CLOUD` deleted (nothing else used them). Both now place a `PLACED_SPACE` `ZONE` with the T1a shape:
  - Moonbeam: a 5-foot-radius, 40-foot-high cylinder, `ENTER_SPACE` + `START_TURN_IN_SPACE`, Constitution save, 2d10 radiant `PER_LEVEL` (one die more per slot level up to the 9th), halved on a made save.
  - Incendiary Cloud: a 20-foot sphere, `ENTER_SPACE` + `END_TURN_IN_SPACE`, Dexterity save, 10d8 fire with no scaling, halved on a made save. It also gains the SRD Concentration attribute it was missing.
  - Both: `maxApplicationsPerTurn: 1`, a 1-minute duration.
- Proofs: the same four files as T1a, now covering both spells. In the room test Moonbeam casts at the 2nd and 3rd level. Incendiary Cloud casts only at the 8th, because a spell whose effects do not read the cast level is offered only at its own level.
- Named gaps (recorded in `zoneInteractionKinds.test.ts`):

| Spell            | SRD rule                                                                             | Authoring option                           | Owner                 |
| ---------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ | --------------------- |
| Moonbeam         | Shapechanger saves with disadvantage, reverts on a failure, no new form in the light | none: see the ruling below                 | orchestrator decision |
| Moonbeam         | Dim light fills the cylinder                                                         | `light` (radius-based, not area fill)      | none registered       |
| Moonbeam         | Move the beam 60 feet with an action on later turns                                  | none (new core option)                     | none registered       |
| Incendiary Cloud | Heavily obscured area; spreads around corners                                        | `obscurementKind`, `spreadsAroundCorners`  | none registered       |
| Incendiary Cloud | Drift 10 feet away from the caster each turn; wind disperses it                      | none (new core option)                     | none registered       |
| Incendiary Cloud | Each creature in the area saves when it appears                                      | none: a zone-placing cast has no area save | none registered       |
| Incendiary Cloud | Enter and end the same turn in it: two saves (SRD), one here                         | per-turn limit counts every application    | T1a ruling            |

- Ruling needed for the shapechanger rider. It needs two things the contracts lack:
  - A creature-trait condition on a save. `savingThrowDtoSchema` has no roll-influence field, and "shapechanger" lives only in free-text creature `tags`, which no rule reads.
  - A creature form state to revert. Shapechanger traits are `CREATURE_*_SHAPECHANGER` closed rules, so the Encounter has no "original form" to restore or form change to block.
- Options:
  - (a) Add an optional `rollInfluence: { influence: 'DISADVANTAGE', when: { kind: 'TARGET_TAG', tag } }` to the saving throw contract, and author creature tags as a controlled vocabulary. This ships the disadvantage now and leaves the revert as a gap until shapechanger forms are modeled.
  - (b) The same condition keyed on a trait vocabulary id instead of a tag (needs a new System vocabulary).
  - (c) Leave the rider as a named gap until shapechanger form state exists, then do both halves together.
  - Recommendation: (c), since half a rider (disadvantage without the revert) gives a shapechanger a worse save with no lasting effect, and the form model decides which key the condition reads.

### T1d (condition zones)

- Compiler: `zonePlacementPlan` also accepts a failed save that applies exactly one condition from the pinned System vocabulary and nothing else, with no made-save outcome. The entry graph's failed-save proposal is then the existing `CONDITION_APPLY`, which the zone trigger already settles. A condition beside damage, two conditions, a condition outside the vocabulary, or a condition on the made save stay MANUAL.
- Authoring (prone):
  - Grease: its bare zone gains a label, the 10-foot square, `ENTER_OR_PASS_THROUGH` + `END_TURN_IN_SPACE`, and a Dexterity save against `SOURCE_SAVE_DC` whose failure knocks the creature prone. No per-turn limit: the SRD gives a save on each entry and at each turn end. Its separate cast-time area save (effect 2) is removed: an Encounter offers no spell with two non-reaction effect groups (`buildCharacterSpellCastActions`), so Grease was never castable there. That makes it the same named gap as Insect Plague's area save.
  - Sleet Storm: re-authored from `CLOSED_RULE` `SLEET_STORM` (deleted, since nothing else used it) as a 40-foot-radius, 20-foot-tall cylinder with `ENTER_OR_PASS_THROUGH` + `START_TURN_IN_SPACE`, `maxApplicationsPerTurn: 1`, and the same Dexterity save and prone failure.
  - "Enters the area" uses `ENTER_OR_PASS_THROUGH`, following SPELLS-17.2 and Blade Barrier. ENTER alone fires only when a move ends inside the area.
- Proofs:
  - `apps/session-worker/test/nativeRoomHazardZoneSpells.test.ts`: a real cast places each zone (label, triggers, per-turn limit, Dexterity at the caster's DC). A Wolf that walks in and fails falls prone and takes no damage. The turn boundary each spell names knocks a Wolf in the area prone, and the other boundary does nothing.
  - `packages/rules-runtime/src/__tests__/encounterZonePlacementCompilation.test.ts`: the condition-only failure compiles to one condition proposal. The four refused variants above stay MANUAL.
  - `zoneInteractionKinds.test.ts` and `sourceZoneAuthoringParity.test.ts` cover both spells.
- Named gaps (recorded in `zoneInteractionKinds.test.ts`):

| Spell       | SRD rule                                                     | Authoring option                           | Owner                         |
| ----------- | ------------------------------------------------------------ | ------------------------------------------ | ----------------------------- |
| Grease      | Difficult terrain                                            | component `movementCostMultiplier`         | SPELLS-20.T4d (movement cost) |
| Grease      | Each creature in the area saves when it appears              | none: a zone-placing cast has no area save | none registered               |
| Sleet Storm | Difficult terrain                                            | component `movementCostMultiplier`         | SPELLS-20.T4d (movement cost) |
| Sleet Storm | Heavily obscured area                                        | `obscurementKind: 'HEAVY'`                 | none registered               |
| Sleet Storm | A concentrating creature in the area saves (Con) or loses it | none (zone save on a maintained state)     | none registered               |
| Sleet Storm | Exposed flames are doused                                    | none (light-source state)                  | none registered               |

- Ruling needed for the restrained zones (Web, Black Tentacles, Entangle). Each needs things no contract has:
  - A condition held for the zone's lifetime. Web's also ends when the creature leaves the webs. Today a zone failure leaves only a `MODIFIER_GRANT` with end events (`planSpatialEntryGrant`), and a `CONDITION_APPLY` stays until removed by hand.
  - An escape action: the restrained creature uses its action for a Strength check (Black Tentacles: Strength or Dexterity) against the caster's spell save DC. `ESCAPE_CHECK` exists only as an `ACTOR_RELATIONSHIP` module held by a source creature (grapples), and `escapeDcDtoSchema` takes only `FIXED` or `CONTEST` DCs.
  - Black Tentacles: 3d6 bludgeoning and restrained on the same failed save (a zone save branch holds one proposal), and 3d6 with no save to a creature already restrained by it that starts its turn there.
  - Entangle: the save happens only when the spell is cast (no entry or turn trigger), so it is a cast-time area save, which a zone-placing cast cannot hold today (see Grease above).
- Options:
  - (a) A zone-held condition. The zone failure leaves a `CONDITION_OWNERSHIP` active effect under the placed zone, built like `planSpatialEntryGrant`'s grant. It ends with the zone, optionally on leaving the area. It carries an optional authored escape that reuses the `ESCAPE_CHECK` module shape (activation, checks) plus a new `SOURCE_SAVE_DC` escape DC kind, settled by the existing escape settlement. Contract changes: the CONDITION outcome (or its result block lifecycle) gains `escape` and `endsOnLeavingArea`, plus the new DC kind.
  - (b) Model the restraint as an `ACTOR_RELATIONSHIP` whose source is the zone rather than a creature. This reuses ESCAPE_CHECK as it is, but relationships are held by a source actor (`heldAtOnce`, release, follow), and a zone is not an actor.
  - (c) Leave the three spells MANUAL until (a) or (b) is ruled.
  - Recommendation: (a). It keeps the condition generic (any zone, trap or hazard can restrain with an escape), reuses the existing escape settlement, and matches D138 (fixed at placement, ends with the zone). Black Tentacles additionally needs a zone branch with damage and a condition together, and a turn trigger gated on holding the zone's condition. Both are separate follow-ups.
- Finding on T1a/T1c (my earlier slices): Cloudkill, Insect Plague, Moonbeam and Incendiary Cloud author `ENTER_SPACE`, so a creature that passes through without stopping is not caught. SPELLS-17.2 reads SRD "enters the area" as `ENTER_OR_PASS_THROUGH`, and Blade Barrier, with the same "for the first time on a turn" wording, uses it. Spirit Guardians (SPELLS-20) also uses `ENTER_SPACE`. Recommendation: switch all five to `ENTER_OR_PASS_THROUGH` in one follow-up, with a pass-through room proof.

### T1f (enter-the-area zones pass through)

- Cloudkill, Insect Plague, Moonbeam, Incendiary Cloud and Spirit Guardians now author `ENTER_OR_PASS_THROUGH` in place of `ENTER_SPACE`, so a creature whose move passes through the area and ends outside it is caught, as SPELLS-17.5 reads SRD "enters the area". Each zone is placed with `triggerModes: ['ENTER', 'CROSS']`.
- Proofs:
  - `packages/source-data/src/srd/zoneInteractionKinds.test.ts`: a corpus test fails on any authored SRD zone whose text says a creature enters its area and that authors `ENTER_SPACE`; the five components author `ENTER_OR_PASS_THROUGH` beside their turn trigger.
  - `apps/session-worker/test/nativeRoomHazardZoneSpells.test.ts`: for each of the four hazard spells a Wolf that walks through the area and ends its move outside it fails the save and takes the cast's damage.
  - `nativeRoomTurnZoneEffects.test.ts` reads Spirit Guardians' placement with both modes.

### T1e (restrained zones: Web, Black Tentacles)

- Contract (D146):
  - A failed-save result block opts in with `lifecycle.heldBySource`. It may add `endOnEvents: ['ON_LEAVING_AREA']` and an `escape` (activation, checks, `dc` `FIXED` or `SOURCE_SAVE_DC`).
  - The compiled zone carries `heldCondition`. The placed zone pins the escape DC (`SOURCE_SAVE_DC` takes the caster's save DC at placement).
  - Grease and Sleet Storm prone stay unheld.
- Graph: a condition beside damage gets its own proposal node `proposal-on_save_fail-condition` with its own source-entry binding. `testApplications` applies each path's proposal, then the condition beside it, and skips a condition the creature is immune to. Unheld conditions beside damage now compose too (the T4b3b refusal is gone).
- Holder effect: when the failed save applied the held condition, entry (`liveMovementSpatialPersistence.ts`) and turn (`turnZoneEffectsPersistence.ts`) settlement create one active effect (`planSpatialHeldCondition`). It holds `CONDITION_OWNERSHIP` with `heldBySpatialEffectId` and, when authored, `CONDITION_ESCAPE`. It carries the zone's `maintainedEffectStateId`, so it ends with Concentration through the existing dependent cleanup. A held condition on a zone without maintenance is refused at compile time.
- Escape: `ESCAPE_RELATIONSHIP` is renamed `ESCAPE` everywhere (no alias). The escape context carries one `escapeSourceId`, and a zone escape names the zone. The existing escape settlement ends the holder effect and the condition it alone owns.
- Authoring:
  - Web: 20-foot cube, `ENTER_OR_PASS_THROUGH` + `START_TURN_IN_SPACE`, Dexterity save at `SOURCE_SAVE_DC`. On a failure: restrained and movement stops. Held, ends on leaving the area, Strength escape at the caster's DC.
  - Black Tentacles: the same, plus `maxApplicationsPerTurn: 1` and 3d6 bludgeoning on the failure. Strength or Dexterity escape. Does not end on leaving the area: the creature is held until the spell ends or it escapes.
- Proofs:
  - `nativeRoomHazardZoneSpells.test.ts` (real casts): an entering Wolf that fails is restrained, stopped and, for Black Tentacles, damaged. Ending Concentration releases it. An escape check that reaches the DC frees it, and a short one keeps it held. A turn start in the area restrains.
  - `encounterZonePlacementCompilation.test.ts`: two proposal nodes and bindings for damage plus condition. Refusals for a held condition without maintenance, an unheld condition with a lifecycle, a held condition ending on another event, and a held condition with a further lifecycle.
  - `zoneInteractionKinds.test.ts` and `sourceZoneAuthoringParity.test.ts` cover both spells.
- Leave-area release (Web): Option A approved (orchestrator, to be added to D146 at merge). The compiler adds `EXIT` to the trigger modes of a held zone that ends on leaving. An exit candidate settles TERMINAL with a release that ends the holder effects that zone holds with `ON_LEAVING_AREA` and removes the conditions they alone owned, through one write path with receipts and replay. A releasing move loses Scene undo like every other settled move. No speed-0 enforcement and no forced-movement changes.
  - Receipt ruling: option 2 approved (orchestrator). A held condition that ends on leaving settles as an `AREA_DEPARTURE` movement settlement step, following `CONCENTRATION_END`, and the spatial receipt is unchanged.
    - A held mover is released when its footprint where the move ends lies outside the zone, at its exit distance or, without one, at the start. A creature stopped on entering only touches the area's edge ("touching is not in it"), so its move away has no exit contact.
    - The evaluator splits release exits from the graph candidates. A move whose only contact is a release is TERMINAL `MOVEMENT_COMPLETE` (Run version +1) and carries `areaDepartures` on the retained preparation outcome, so replay and its checksum cover it.
    - The room plans one `AREA_DEPARTURE` per departure (departure, ended holder effect, removed conditions). The commit checks each against the retained departures, re-derives the holder effect from current rows, and ends it through the escape end path.
    - Proof: `nativeRoomHazardZoneSpells.test.ts` "releases a creature that leaves the area, in a settled move" (Web) and "keeps a creature that leaves the area restrained" (Black Tentacles).
  - Deferred edge cases (rare, recoverable):
    - A move that leaves the area and then ends on a passage stop is not released; the release needs another move.
    - Departures settle after every other contact in the move, so a zone entered later in the same move sees the creature still restrained.
    - A zone's per-turn application limit does not count release exits.
- Named gaps:

| Spell           | SRD rule                                                           | Authoring option                   | Owner                              |
| --------------- | ------------------------------------------------------------------ | ---------------------------------- | ---------------------------------- |
| Web             | Difficult terrain                                                  | component `movementCostMultiplier` | SPELLS-20.T4d (movement cost)      |
| Web             | Lightly obscured area                                              | `obscurementKind: 'LIGHT'`         | none registered                    |
| Web             | Webs burn away in fire (2d4 fire)                                  | `destructionCriteria`              | none registered                    |
| Web             | Unanchored webs collapse                                           | none                               | none registered                    |
| Web             | Ends when the creature leaves the webs                             | holder `ON_LEAVING_AREA`           | T1e (`AREA_DEPARTURE` settlement)  |
| Black Tentacles | Difficult terrain                                                  | component `movementCostMultiplier` | SPELLS-20.T4d (movement cost)      |
| Black Tentacles | 3d6 with no save to a creature it already restrains, at turn start | zone outcome with no save          | check SPELLS-20.T6a once it merges |

- Other findings:
  - For the orchestrator: restrained makes speed 0, and the server does not enforce speed 0 on later moves, so a restrained creature can still walk.
  - Forced movement through zones is still refused (unchanged).
  - A creature that a zone stops on entering stands touching the area's edge, which spatial geometry counts as outside it. So a Black Tentacles creature restrained on entry is not "in" the area at its next turn start and does not save again there. Pre-existing stop geometry (T1a), not changed here.
  - Reverting the move or turn that restrained a creature may leave the holder effect in place. The entry-grant effect has the same behavior. Not yet confirmed by a test.
  - Black Tentacles: a creature it already restrains that starts its turn there saves again. A failure deals damage, and the condition is not held twice.

### T1b (wall geometry: Wall of Fire, Wall of Thorns)

- Contract (D154, amending D140):
  - Targets `WALL` (two ends, up to the option's `maxLength`, `thickness` centered on the segment, stored as a `POLYGON`) and `RING` (center and an outer radius up to `maxOuterRadius`; inner = outer − thickness, stored as a `RING`).
  - Every zone cast choice is a `ZONE_OPTIONS` target: the client picks an option, then aims it. The zone `choiceOptions` on `POINT` and `CASTER_CENTERED` are gone; the non-zone `ACTOR`/`ACTORS` choiceOptions (D148) stay. Options agree on attachment, designated-unaffected, Concentration and the cast save DC; each may have its own area.
  - The Worker refuses a kind that does not match the option, a wall or ring over its maximum, and a ring no wider than its thickness (`prepareCasterSource`, `evaluateEncounterZoneTarget`).
  - Unsaved dice run on `ENTER` and the creature's own `END_TURN`, rolled by the caster. `movementCostMultiplier` applies to every mover and the highest wins. `blockingRules` are projected, plus `BLOCKS_SIGHT`; cover is SPELLS-14.
- Shared geometry: `wallOutline`, `undirectedAreaGeometry`, `wallAreaBoundsInSceneCoordinates`. Web: `drawnAreaAim` and the area-aim gesture draw a wall end to end or a ring out from its center; the action drawer picks the option first.
- Authoring: Wall of Fire (5d8 fire, no save on enter or turn end, `BLOCKS_SIGHT`) and Wall of Thorns (7d8 piercing, Dexterity save for half, ×4 movement cost), each with a straight wall and a ring option.
- Proofs: `nativeRoomWallZoneSpells.test.ts` (real casts: polygon and ring placement, damage on crossing, turn end and leaving the ring, the five refusals), `characterSpellCastActions.test.ts`, `vtt-spatial.test.ts`, `vttAreaAimGesture.test.ts`, `vttSceneRenderer.model.test.ts`, `CampaignTabletopActionDrawer.test.tsx`, `zoneInteractionKinds.test.ts`, `sourceZoneAuthoringParity.test.ts`. Two `encounterZoneChoiceCompilation.test.ts` tests changed by the ruling (zone choices moved to `ZONE_OPTIONS`). `saveForHalfDamage.test.ts` drops Wall of Thorns from the unauthored list.
- Not here: Wall of Fire's 10-foot one-side band (T1b2), the save when a wall appears (T1g), Blade Barrier (SPELLS-30.T2).

### T1b2 (Wall of Fire's burning side)

- Contract (D154 amendment, option A):
  - A zone may author several components. The first covers the zone's shape; a later one authors `region: { kind: 'SIDE_BAND', distance }`, the wall plus `distance` on one side. At most one band, only beside a `WALL` or `RING`, sharing the cast's Concentration and not sparing designated creatures.
  - The choice target carries `sideBand: { distance }`; the command names `side` (`LEFT`/`RIGHT` of travel from `from` to `to`, `INSIDE`/`OUTSIDE` a ring) exactly when there is a band (`SIDE_REQUIRED`, `SIDE_NOT_OFFERED`).
  - Each component places its own record. The area root names them all in `placedSpatialEffectIds` (the receipt in `placedZones`), so undo and Concentration end remove every record the cast placed.
- Shared geometry: `wallSideBandGeometry`, `authoredLengthInSceneCoordinates` (exported). Web: after aiming, the drawer asks for the side and the stage previews the band (`areaBandOverlay`).
- Authoring: Wall of Fire's wall burns on `ENTER_OR_PASS_THROUGH` (once a turn, `BLOCKS_SIGHT`); its "Wall of Fire Burning Side" band burns on `END_TURN_IN_SPACE`.
- Proofs: `nativeRoomWallZoneSpells.test.ts` (wall and band placed under one Concentration; the band burns a creature ending its turn on the side picked and spares the other side; a wall with no side refused; undo and Concentration end remove both records), `characterSpellCastActions.test.ts` (band compilation, four malformed bands refused, side required and not offered), `vtt-spatial.test.ts`, `vttSceneRenderer.model.test.ts`, `CampaignTabletopActionDrawer.test.tsx`. Two `characterSpellCastActions.test.ts` Wall of Fire tests changed by the ruling (the wall no longer burns at turn end; the band does).
- Pre-launch data: the area root's `placedSpatialEffectId` became `placedSpatialEffectIds`; stored local executions from before need the local reset.

### T2a1 (hit-point pool conditions, Color Spray, Awaken)

- Contract (D156 amendment): `AREA_CONTENTS` targeting gains `hitPointPoolIgnoredConditionIds`: a creature holding any of them is passed over by the pool and keeps its hit points out of it. Sleep ignores Unconscious; Color Spray ignores Unconscious and Blinded (a creature that can't see).
- `tickAnchor` moved from the grant contribution to the active-effect plan, one home for every effect. A timed condition plan accepts `lifecycle.turnAnchor` (not beside a grant, not without a duration). A `SOURCE`-anchored effect stores no recurrence stage and is counted by `planEncounterGrantTicks` on its source's turns, with the own-turn extra tick; `planEncounterGrantTicks` and `planDepartedSourceGrantRemovals` no longer require a Modifier Grant.
- Authoring: Color Spray rolls 6d10 (+2d10 a slot level) and blinds from the lowest hit points up for 1 round, until the end of the caster's next turn. Awaken is class C: its closed rule became a GM ruling quoting the description; no day-scale duration (future-enhancements). `COLOR_SPRAY` and `AWAKEN` left `CLOSED_RULE_KIND`.
- Proofs: `nativeRoomHitPointPoolSpell.test.ts` (Sleep passes over a Wolf already asleep; red before), `nativeRoomColorSpray.test.ts` (pool skips the blinded Wolf; blindness ends at the end of the caster's next turn), `encounterHitPointPool.test.ts`, `grantLifetimes.test.ts` (source-anchored condition: stage, extra tick, counting, departure release), `awakenRuling.test.ts`, `conditionSourceAuthoringParity.test.ts` (Sleep, Color Spray, Awaken through the node map). `grantLifetimes.test.ts` and `hitGrant.test.ts` assert `tickAnchor` at plan level now (moved, same values).
- Not here: Contact Other Plane (T2a1b).