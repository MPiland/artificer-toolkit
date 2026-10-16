# SPELLS-28: outcome executors for TELEPORT, MANIFEST and TELEPATHIC_LINK

Closes AC SPELLS-28.1 (tasks T1 TELEPORT, T2 MANIFEST, T3 TELEPATHIC_LINK). Status: rulings received; T1 (TELEPORT, off-Scene) built and on CI.
Build order: **T1 → T1b (in-Scene teleport) → T3 (TELEPATHIC_LINK) → T2 (MANIFEST/CREATURE_FORM)**. T4 (Polymorph family) is out of scope.

## Survey (what exists, verified in source)

| Area                                                                   | Today                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compiler outcome map (`effectActionCompiler.ts` ~2530-2640)           | Only CONDITION_APPLY, STABILIZE, CONCEAL, DETECT_CONCEALED, CANCEL_TRIGGERING_EVENT, MODIFIER_GRANT, MANUAL_ADJUDICATION, ADD_SPEED_TO_MOVEMENT, DICE_HEAL, HEAL, TEMPORARY_HIT_POINTS, DAMAGE compile. Everything else is `unsupported(...)`. A chosen-creature action must be a HEAL ("must be a heal"). |
| Movement                                                               | `encounterSpatialMovementRuleService` and `schema/shared/spatial.ts` already model `movementKind: TELEPORT` (origin and destination only; zones with `TELEPORT` in `movementKinds` fire). **No action produces it.** `SCENE_TOKEN_MOVED` exists only as a contested-action (Shove) state transition.            |
| Leaving an Encounter                                                   | `REMOVE_ACTOR` run command only. There is **no add-actor command**: `encounterRunActors` is fixed at run start.                                                                                                                                                                                                    |
| Timed grants (`schema/shared/activeRuleEffects.ts`)                    | Closed contribution union: `ACTOR_RELATIONSHIP`, `MODIFIER_GRANT` and the others. Duration, concentration and end events are in the grant. No contribution models "these actors share a channel".                                                                                                                  |
| Authored spells                                                        | Word of Recall: TELEPORT, `CHOSEN_CREATURES`, `LINKED_LOCATION`, no duration. Plane Shift: `CLOSED_RULE` PLANE_SHIFT then `MANUAL_ADJUDICATION` "Choose a Destination" (ADR 0018 fail-closed). Giant Insect: `MANIFEST` `CREATURE` with **no `creatureId`**, 1 hour. Telepathic Bond: `TELEPATHIC_LINK`, 8 creatures, Intelligence > 2, any distance, 1 hour. |

## Per-outcome Encounter behavior (proposed)

- **TELEPORT.** In-Scene destinations (`SELF`, `VISIBLE`, `SPECIFIED_POINT`) move the token through the existing spatial
  movement service as `movementKind: TELEPORT` (so zones and reactions already apply). Off-Scene destinations
  (`LINKED_LOCATION`, `SPECIAL`: Word of Recall, the travel half of Plane Shift) remove the actor from the Encounter.
- **MANIFEST (CREATURE).** Giant Insect transforms creatures that are already in the Encounter, so it is a stat-block
  swap on the chosen actors for the duration, not a placement.
- **TELEPATHIC_LINK.** A timed link grant on the chosen actors (duration, concentration-free, ends with the duration).

## Rulings (main session)

- **T1 TELEPORT, option A (D125).** One `absence` field on every Run actor kind replaces D82's `outOfInitiative`;
  a `DEPART` application sets `DEPARTED` in the action commit, revert restores it by before-state, the stage hides the
  bound token (derived), initiative skips through the existing skip set, GM `returnToInitiative` clears it. D81 is
  Campaign departure only; the actor's own Run effects run their course.
- **Plane Shift** is one TELEPORT/CHOSEN_CREATURES/SPECIAL outcome. The `PLANE_SHIFT` closed-rule marker and the manual
  "Choose a Destination" step are gone (a SEQUENCE with it would not compile as a direct action). The unwilling-banish
  half (melee spell attack plus Charisma save) is GM adjudication.
- **T1b.** `SELF`, `VISIBLE`, `SPECIFIED_POINT` destinations (Misty Step, Dimension Door) run through the spatial
  movement service as `movementKind: TELEPORT`, with a destination input on the MOVE command family.
- **T3.** Check whether ACTOR_RELATIONSHIP can carry kind, members and duration; if not, a new contribution kind
  (one line to the main session). No gameplay effect beyond provenance, a link badge and ending at the duration; the
  Intelligence filter applies at cast.
- **T2.** `CREATURE_FORM` as the general shape-change grant (stat block reference, separate form HP over the original,
  revert at 0 form HP with excess carrying over, revert at duration end). `creatureId` per target option authored on
  Giant Insect; a unit test that a Polymorph-shaped authoring runs on the same executor.

## T1 proof

- Compile: Word of Recall and Plane Shift compile to `dnd5e.depart-proposal` (`encounterActionExecution.test.ts`,
  `encounterAreaActionCompilation.test.ts`); fold/plan (`encounterMechanicsBatchPlan.test.ts`); skip set
  (`encounterActorDefeat.test.ts`).
- Journey: `apps/session-worker/test/nativeRoomDepartAction.test.ts` (cast, undo, GM return).
