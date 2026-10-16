# SPELLS-28: outcome executors for TELEPORT, MANIFEST and TELEPATHIC_LINK

Closes AC SPELLS-28.1 (tasks T1 TELEPORT, T2 MANIFEST, T3 TELEPATHIC_LINK). Status: rulings received; T1 (TELEPORT, off-Scene) on CI; T3 (TELEPATHIC_LINK) built, awaiting T1 green before push.
Build order: **T1 → T3 (TELEPATHIC_LINK) → T2 (MANIFEST/CREATURE_FORM) → T1b (in-Scene teleport, AC SPELLS-28.2)**, each green before the next. T4 (Polymorph family, below) follows T2; T4b (form outlasts the Run, D99 carry-over) follows T4.

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Survey (what exists, verified in source)

| Area                                                        | Today                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compiler outcome map (`effectActionCompiler.ts` ~2530-2640) | Only CONDITION_APPLY, STABILIZE, CONCEAL, DETECT_CONCEALED, CANCEL_TRIGGERING_EVENT, MODIFIER_GRANT, MANUAL_ADJUDICATION, ADD_SPEED_TO_MOVEMENT, DICE_HEAL, HEAL, TEMPORARY_HIT_POINTS, DAMAGE compile. Everything else is `unsupported(...)`. A chosen-creature action must be a HEAL ("must be a heal").                                                    |
| Movement                                                    | `encounterSpatialMovementRuleService` and `schema/shared/spatial.ts` already model `movementKind: TELEPORT` (origin and destination only; zones with `TELEPORT` in `movementKinds` fire). **No action produces it.** `SCENE_TOKEN_MOVED` exists only as a contested-action (Shove) state transition.                                                          |
| Leaving an Encounter                                        | `REMOVE_ACTOR` run command only. There is **no add-actor command**: `encounterRunActors` is fixed at run start.                                                                                                                                                                                                                                               |
| Timed grants (`schema/shared/activeRuleEffects.ts`)         | Closed contribution union: `ACTOR_RELATIONSHIP`, `MODIFIER_GRANT` and the others. Duration, concentration and end events are in the grant. No contribution models "these actors share a channel".                                                                                                                                                             |
| Authored spells                                             | Word of Recall: TELEPORT, `CHOSEN_CREATURES`, `LINKED_LOCATION`, no duration. Plane Shift: `CLOSED_RULE` PLANE_SHIFT then `MANUAL_ADJUDICATION` "Choose a Destination" (ADR 0018 fail-closed). Giant Insect: `MANIFEST` `CREATURE` with **no `creatureId`**, 1 hour. Telepathic Bond: `TELEPATHIC_LINK`, 8 creatures, Intelligence > 2, any distance, 1 hour. |

## Per-outcome Encounter behavior (proposed)

- **TELEPORT.** In-Scene destinations (`SELF`, `VISIBLE`, `SPECIFIED_POINT`) move the token through the existing spatial
  movement service as `movementKind: TELEPORT` (so zones and reactions already apply). Off-Scene destinations
  (`LINKED_LOCATION`, `SPECIAL`: Word of Recall, the travel half of Plane Shift) remove the actor from the Encounter.
- **MANIFEST (CREATURE).** Giant Insect transforms creatures that are already in the Encounter, so it is a stat-block
  swap on the chosen actors for the duration, not a placement.
- **TELEPATHIC_LINK.** A timed link grant on the chosen actors (duration, concentration-free, ends with the duration).

## Rulings (main session)

- **T1 TELEPORT, option A (D128).** One `absence` field on every Run actor kind replaces D82's `outOfInitiative`;
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

## T1b conditions (approved)

- Model the allowance on the movement-economy pattern: extend the existing per-turn/one-shot movement grant with `maxFeet`, kind `TELEPORT` and an expiry, not a new contribution kind. It expires at the end of the caster's turn.
- Close ungated `MOVE_SCENE_TOKEN` TELEPORT for player/actor moves; GM moves stay ungated. On web the player picks the destination right after the cast as one flow.
- Cast undo is refused once the move landed. Undo order is the move first, then the cast (state in the D-entry).
- In-Scene teleports run through the spatial movement service as `movementKind: TELEPORT`.

## T2 proof (D130)

- Design: option A, swap in place; `form` required nullable on CREATURE/CUSTOM Run actors; origin by reference; one revert path (see D130).
- Compile: `encounterAreaActionCompilation.test.ts` (Giant Insect forms, 600-turn plan, no carry-over; Polymorph-shaped clone carries).
- Plan: `encounterMechanicsBatchPlan.test.ts` (enter, refuse a second form, revert at 0 with and without carry-over, carried excess defeats the origin, revert idempotent).
- Authoring parity: `packages/authoring/src/nodeRuntime/creatureFormAuthoringParity.test.ts`.
- Journey: `apps/session-worker/test/nativeRoomGiantInsect.test.ts` (cast and byte-exact undo, duration expiry, Magic Missile ends one form while the other stays; a repeated dart on a reverted form is deferred, refusals).
- Migration: `apps/apis/convex/encounters/actorFormMigration.test.ts`; main runs it locally after merge.
- Web: `CampaignTabletopActionDrawer.test.tsx` (form picker sends `formId`).
- Deferred (`future-enhancements.md`): undo of a damage action that auto-reverted a form.

## T3 proof (D129)

- Compile: `encounterAreaActionCompilation.test.ts` (Telepathic Bond: ACTORS target of 8, 600-turn plan, Intelligence floor 2).
- Plan: `encounterActionEffectBaseline.test.ts` (members sorted per target; fewer than two reached yields none).
- Warning: `encounterActionRuleWarnings.test.ts` (`TARGET_INTELLIGENCE_EXCLUDED`).
- Journey: `apps/session-worker/test/nativeRoomActorLink.test.ts` (cast bonds every chosen creature, undo removes all; a dull creature warns, overridably).
- Deferred (registered in `future-enhancements.md`): web bond badge, Character Intelligence.

## T4 plan (D130 amendment, rulings Q1 A, Q2, Q3)

Closes AC SPELLS-28.1. Two stages, each red on `ci/spells-28-t4-red` then green on `ci/spells-28-t4`.

- **Stage 1, creature targets.** A rule-filtered form choice beside the fixed list (core option: creature type, CR cap from target CR/level, caster level or a fixed value, excluded speed modes), validated at cast against the System creature corpus; the command carries the chosen `creatureId`. Form-after-save compile plan (Polymorph, True Polymorph creature to creature). Corpus proof against the real compiler; one journey.
- **Stage 2, Characters.** `form` on CHARACTER Run actors with the same shape and one revert path; form HP and temp HP live on the actor while the Sheet HP row is untouched; in-Encounter damage and healing route to the form; revert carry-over goes through the normal Sheet damage batch. Shapechange (creature form, self), Wild Shape re-authored as a core option (level-scaled duration and CR cap, no swim below druid level 4, no fly below 8), retained INT/WIS/CHA and save/skill proficiencies (higher bonus wins) as an authored form option, casting refused while in a form that cannot cast (Wild Shape, Polymorph; Concentration kept).
- **Not in T4:** the form outliving the Run (T4b); known forms, object forms, True Polymorph permanence, Shapechange re-forming (`future-enhancements.md`).

## T4 stage 1 status (2026-10-16)

- Red: `ci/spells-28-t4-red` a13f8cf76, Tests 38944606546, Live 38944606568 (both failed as intended).
- Green: `ci/spells-28-t4` 2b10ea73f (includes the merge of `codex/phase-08-2-convex-cutover` and the regenerated SRD manifest), Tests 38957200514, Live 38957200558.
- Proof: `packages/rules-runtime/src/__tests__/encounterFormChoice.test.ts`, `encounterAreaActionCompilation.test.ts`, `packages/schema/src/__tests__/encounter-action-actors-target.test.ts`, `packages/authoring/src/nodeRuntime/creatureFormAuthoringParity.test.ts`, `apps/session-worker/test/nativeRoomPolymorph.test.ts`, `CampaignTabletopActionDrawer.test.tsx`.
- Stage 2 (Character Run actors, retained INT/WIS/CHA and proficiencies, casting refused in form, one revert path) is NOT built; AC SPELLS-28.1 stays open until it is.

## D130 amendment, 2026-10-16: a Character takes a creature form (SPELLS-28.T4c)

Approved by the orchestrator (Phase 8) on 2026-10-16. Changes a persisted contract: the `form` field on Run actors, today CREATURE and CUSTOM only (D130), is also carried by CHARACTER actors. T4d (the form's action list replacing the Character's) is out of T4c.

- **Shape.** A CHARACTER actor's `form` is `null | { effectId, excessDamageCarriesOver, creature: { sourceId, sourceRevision, snapshot }, currentHitPoints, maxHitPoints, tempHitPoints }`. There is no `origin`: the Character's own state stays on the Sheet, untouched while the form lasts. The form creature's snapshot is stored by reference (checksum), like the actor's own.
- **Hit points.** While `form` is set, the Character actor's current, temporary and maximum hit points, and its defeat, are the form's. Damage and healing applied to the actor in the mechanics batch change the form's hit points and never the Sheet's. Death saves and the 0 hit point condition are not touched while in form.
- **One revert path.** `revertActorForm` also covers a Character actor: it runs when the form's hit points reach 0, when the effect ends, and on cast undo. Excess damage past the form's last hit point, when `excessDamageCarriesOver`, becomes a `DAMAGE` application on the Sheet in the same mechanics batch (the normal Sheet damage fold, with its temporary then current hit points and its 0 hit point rules). Healing never carries over.
- **Armor class.** While in form, attacks against the Character use the form creature's armor class.
- **Projection.** A player sees the form's public stat block merged with the Character's retained abilities: Intelligence, Wisdom, Charisma and the save and skill proficiencies (the higher bonus wins). The Character's own sheet panel is unchanged.
- **Casting.** The Character cannot cast while in a form (Polymorph's form cannot cast); Concentration on a spell cast before the form is kept.
- **Not in T4c:** the form's actions replacing the Character's (T4d), the form outliving the Run (T4b), object forms, True Polymorph permanence, Shapechange re-form.
