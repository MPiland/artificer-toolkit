# Slice SPELLS-4: SRD hazard zones from core options

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Resume here

- T1 (audit) is done: the zone table is in [slice-spells-20.md](slice-spells-20.md#zone-table-srd-zones-with-turn-startend-text-static-audit-2026-10-17).
- T1a (Cloudkill and Insect Plague) merged in m80; T1c (Moonbeam and Incendiary Cloud) in m81. The Moonbeam shapechanger rider waits on the ruling below. T1d (prone zones: Grease, Sleet Storm) is on `ci/spells-4-t1d`; its restrained zones (Web, Black Tentacles, Entangle) wait on the T1d ruling below. Next: T1b (wall geometry).

## Scope

- AC SPELLS-4.2: every SRD hazard zone spell places a zone whose entry and turn rules are authored from core options and resolve in Encounters.
- No spell-specific code: each zone is authored data compiled by the generic placed-zone compiler (`placedSpaceZone`, `zonePlacementPlan`). A rule the compiler does not model stays unauthored and is named below, never partly honored.

## Log

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
  - Grease: its bare zone gains a label, the 10-foot square, `ENTER_OR_PASS_THROUGH` + `END_TURN_IN_SPACE`, and a Dexterity save against `SOURCE_SAVE_DC` whose failure knocks the creature prone. No per-turn limit: the SRD gives a save on each entry and at each turn end. Its separate cast-time area save (effect 2) is removed: an Encounter offers no spell with two non-reaction effect groups (uildCharacterSpellCastActions), so Grease was never castable there. That makes it the same named gap as Insect Plague's area save.
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
