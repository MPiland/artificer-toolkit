# Slice SPELLS-4.T2h: removed from play, returning at a boundary

Status: **design, awaiting ruling** (Phase 1; no production edits).
Class (D156): new generic option, class B. Unblocks SPELLS-31.T4s and SPELLS-33.T4gh (Ghost and Night Hag Etherealness).

## Brief

Convert `BANISHMENT`, `BLINK`, `ETHEREALNESS`, `MAZE` and `IMPRISONMENT` (and its sibling marker `IMPRISONMENT_FUTURE_CAST_IMMUNITY`, see Q5) from `CLOSED_RULE` kinds to generic authored options, with an authoring-parity proof each (SRD plus a homebrew variant through the effect node map, ADR 0038), and delete the kinds. Nothing spell-specific in code (ADR 0039, D156).

## What exists today (verified)

- All five kinds are marker-only: `CLOSED_RULE` outcomes in `packages/source-data/src/srd/spells/{banishment,blink,etherealness,imprisonment,maze}.ts`; no executor reads them. Kinds live in `packages/shared/src/domains/effects/core/closedRuleKind.ts`.
- **D128 already models "an actor leaves play"** for off-Scene teleports: Run actor field `absence: null | 'GM_REMOVED' | 'DEPARTED'` (`encounterActorAbsenceDtoSchema`, `packages/schema/src/api/encounterData.ts:77`), set by the `DEPART` application (`encounterCharacterMechanicsBatch.ts`), undone by before-state, cleared by GM `UPDATE_ACTOR returnToInitiative`. The initiative skip set and the Tabletop stage read it; the bound token is hidden without a Scene write. D128 records two gaps: an absent token still occupies its cell and **is still targetable**. A departed actor's own effects run their course.
- **Effect-owned actor state has a precedent** (SPELLS-4.T2t, `rules-runtime.md` "Effect-owned temporary hit points"): an optional actor field names the owning active effect; it clears when that effect ends, through the shared early-end seam (`actionEndedEffects`, `withLinkedDependents`, `endedEffectReleases`, `deleteCas` `ENDED`, D172/D174), so duration expiry, concentration loss, damage ends, dismissal, `END_EFFECTS` and undo all work with no new call site.
- Scene tokens (`sceneTokenDtoSchema`, `vttScenes.ts`) carry `position`, `hidden`, `characterId`. The room is the only writer of a presented Scene; an Encounter commit does not write token positions (D128).
- No "nearest unoccupied space" helper exists anywhere.

## SRD clauses and what runs

| Spell        | Clause                                                                                                                                                                                                                           | Disposition                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Banishment   | CHA save, fail: banished; native creature is incapacitated in a harmless demiplane until the spell ends; reappears in the space it left or the nearest unoccupied; extra target per slot above 4th                               | **Authored**: failed-save path, removal state + `INCAPACITATED` condition, 1-minute Concentration; return at effect end; upcast targets via existing option                                                                                                                                                                                                                                |
| Banishment   | Non-native target returns home and stays gone if the spell lasts a full minute                                                                                                                                                   | **Description-only** (plane model, future-enhancements; same as D156/T2i Divine Word)                                                                                                                                                                                                                                                                                                      |
| Blink        | End of each of your turns, d20; 11+: vanish; return at start of next turn, or when the spell ends, to an unoccupied space of your choice within 10 ft of where you left                                                          | **Authored**: turn-end d20 gate (min 11) applies a child "vanished" effect that ends at the holder's next turn start or with the parent; return space = Q3                                                                                                                                                                                                                                 |
| Blink        | Ethereal Plane perception and "only affect creatures on that plane"                                                                                                                                                              | **Description-only** (no plane model) beyond untargetability (below)                                                                                                                                                                                                                                                                                                                       |
| Etherealness | Holder remains in the border plane up to 8 h or until dismissed; may still move; ignores objects and effects not on the plane                                                                                                    | **Authored**: removal state with `keepsTurn: true`; movement through creatures/objects via the existing barrier-passing grant, untargetable by others; dismiss = existing action-ends-effect option; up to three more willing creatures per slot above 7th via upcast targets                                                                                                              |
| Etherealness | On return into an occupied spot, shunt to nearest unoccupied space and take 2 force per foot moved                                                                                                                               | **Q3**: GM places the token, damage description-only (needs a Scene write and a placement helper)                                                                                                                                                                                                                                                                                          |
| Maze         | Banished to a labyrinth demiplane for 10 min Concentration; the target may use its action for a DC 20 INT check to escape (ends the spell); minotaur/goristro auto-succeed; reappears in the space it left or nearest unoccupied | Removal authored; **escape check: Q4** (check flow is one fixed-DC check on a basic action or Creature feature, `checkActionSource`); automatic success for named creatures is description-only                                                                                                                                                                                            |
| Imprisonment | WIS save fail: bound; no need to breathe/eat/drink/age (no resolved state); Divination can't locate (description-only); caster chooses a form                                                                                    | **Authored per form** through the existing cast-time mode pick if one exists (verify in Phase 2, else Q5): Burial, Hedged Prison, Minimus Containment = removal state with no duration (ends only by the GM-adjudicated condition that already exists as `MANUAL_ADJUDICATION`); Chaining = `RESTRAINED` + cannot move or be moved (existing grants); Slumber = `UNCONSCIOUS` with no wake |
| Imprisonment | Save success: immune if cast again (`IMPRISONMENT_FUTURE_CAST_IMMUNITY`)                                                                                                                                                         | **Q5**                                                                                                                                                                                                                                                                                                                                                                                     |

## Proposed option

### 1. Schema and node map: `REMOVE_FROM_PLAY` outcome (new `EFFECT_KIND`)

```
{ effectKind: 'REMOVE_FROM_PLAY',
  keepsTurn: boolean }       // false: initiative skips the holder (Banishment, Maze, Blink, Imprisonment forms)
                             // true:  the holder acts and moves while absent (Etherealness)
```

It rides inside a result block with a `duration` (or none, for Imprisonment), so the return boundary is **the owning effect's end**; there is no separate timer and no `returnAt` field. Boundaries therefore come for free from existing options: `duration`, Concentration, turn-start end of the holder (Blink's child effect), damage/event ends, dismissal, `END_EFFECTS`.
Authoring: one entry in the Effect node map (`outcomes[].effectKind`), `keepsTurn` a boolean node; homebrew authors the same shape (parity proof compares SRD and a variant with another duration/`keepsTurn` through the node map and real compiler).

### 2. Stored state

Run actor gets `absenceSourceEffectId: string | null` (required-nullable) and `absence` gains `'EFFECT'`, mirroring D128 and T2t. `keepsTurn` is stored on the owning effect's state contribution (`PLAY_ABSENCE { keepsTurn }`), so the skip set reads actor `absence === 'EFFECT'` plus the contribution only when deciding to skip. Stored plans migrate in the same change; dev data reseeded (pre-launch, no shims).

### 3. Execution seam

- Apply: a target-only application `REMOVE_FROM_PLAY` beside `DEPART` (`dnd5e.remove-from-play-proposal`), set in the action commit's mechanics batch; refused with the D173 overridable warning if the target is already absent.
- Return: `endedEffectReleases` gains the release "clear `absence` when the effect named by `absenceSourceEffectId` ends and no other absence source holds it", the same shape as the sole-owner condition release; one transaction, one receipt.
- Targeting and occupancy: server-derived legal-target lists, area target resolution and attack/save target admission exclude actors with `absence !== null` (closes D128's "still targetable" gap for `GM_REMOVED`/`DEPARTED` too; they are the same state to a caster).

### 4. Return position

The token's stored position is untouched while absent (hidden, no Scene write), so a creature **reappears in the space it left** by construction. Because an absent token still occupies its cell (D128), other creatures cannot end a move there, so the "nearest unoccupied" fallback is not needed for `keepsTurn: false` states. For `keepsTurn: true` (Etherealness) the holder may move; a return onto an occupied spot is a GM placement (Q3), reported on the receipt as `RETURN_SPACE_OCCUPIED`.

### 5. Receipts, undo, privacy

- Receipt lists `absenceSet` / `absenceCleared` per actor with the effect id; undo restores both by the actors' before-state and the effect row's `ENDED` restore, and refuses, naming the actor, when the table already returned it (D128 rule reused).
- Projection: other viewers do not see the absent actor's token, name or targeting rows (`projectSceneForViewer`, `ACTOR_TOKEN_BINDINGS` already hide hidden tokens); the controlling player and GM see it marked "absent". No new private channel.

## Alternatives

|                     | Description                                                                                                | Pros                                                                                             | Cons                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **A (recommended)** | Effect-owned actor `absence: 'EFFECT'` + `absenceSourceEffectId`, cleared by the ended-effect release seam | Reuses D128 field, skip set, stage hiding and T2t/D172 seam; every end path and undo free; small | One more actor field and migration                                                                                                |
| B                   | Derive absence from held effects at read time (no actor field)                                             | No dual state                                                                                    | Skip set, stage, targeting and projection must load effects everywhere; encounter read budgets; larger blast radius               |
| C                   | Hide the Scene token (`hidden: true`) and keep Encounter state unchanged                                   | No migration                                                                                     | Room-owned Scene write from an Encounter commit; hidden is not untargetable; undo coupling; breaks D128's "no Scene write"        |
| D                   | Reuse `DEPARTED` plus a scheduled return timer                                                             | No new state value                                                                               | Second lifecycle beside effect duration/Concentration; ends on dismissal/damage need re-wiring; GM `returnToInitiative` ambiguity |

## Questions for the ruling

1. **Option A** (above) with `keepsTurn`: approve?
2. **Targeting gap**: fix it in this slice for all absence values (recommended; an Etherealness holder must be untargetable), or only for the new `'EFFECT'` value?
3. **Return placement**: a return onto an occupied cell (Etherealness only) becomes a GM placement with a receipt warning, and Etherealness's shunt damage and Blink's "choose a space within 10 ft" stay description-only (needs a Scene write + placement helper, a separate task). Approve, or require a `nearestUnoccupiedPlacement` pure helper in `shared/spatial` plus a room-side token write in this slice (size grows by ~3)?
4. **Maze escape check**: ship Maze with the escape check as `MANUAL_ADJUDICATION` until RULES-2.T6e3b2 lets a granted self-end action carry a fixed-DC check (recommended), or wait for it? Minotaur/goristro auto-success stays description-only either way.
5. **Imprisonment**: (a) the form pick: reuse the existing cast-time mode pick if present, else add nothing and author the removal form only (Chaining/Slumber via the existing condition outcomes); (b) `IMPRISONMENT_FUTURE_CAST_IMMUNITY`: reuse an existing immunity-to-source grant if Phase 2 finds one, else description-only and delete the kind. Approve?
6. **Blink**: needs a turn-end d20 gate (`min 11`) on a periodic outcome; I found no authored turn-end roll gate. If none exists, split Blink to SPELLS-4.T2h2 (new gate option, own ruling) and ship the other four now. Approve the split in that case?

## Acceptance (proposed)

1. A `REMOVE_FROM_PLAY` outcome sets the target absent, skips its turn (`keepsTurn: false`), and excludes it from legal targets, in one transaction and receipt; undo restores it.
2. The absence clears when the owning effect ends by duration, Concentration loss, damage or event end, dismissal or `END_EFFECTS`; the creature reappears at its recorded position.
3. Banishment, Etherealness, Imprisonment (and Maze, Blink per Q4/Q6) compile from core options; each has an authoring-parity proof; each kind is deleted from `closedRuleKind.ts`.
4. Room journey: a Banishment cast removes the target from targeting and initiative; ending Concentration returns it.
5. Docs: `rules-runtime.md`, ADR 0038 consequences, a decisions entry.

## Tests (red first)

- `packages/rules-runtime/src/__tests__/removeFromPlay.test.ts`: apply, skip set, `keepsTurn`, sole-source release, double source, undo.
- `packages/authoring/src/nodeRuntime/removeFromPlayAuthoringParity.test.ts`: SRD and homebrew variant through the node map and real compiler, per spell.
- `apps/session-worker/test/nativeRoomRemoveFromPlay.test.ts`: Banishment journey and a legal-target list that excludes the absent actor.

## Golden flips (expected)

One authored effect graph checksum each for Banishment, Etherealness, Imprisonment (+ Maze, Blink if in scope): `CLOSED_RULE` becomes `REMOVE_FROM_PLAY` (Banishment also gains its `INCAPACITATED` outcome; Imprisonment gains per-form outcomes). Creature features that embed these by reference (Ghost, Night Hag, Archmage, Androsphinx, Gynosphinx, Guardian Naga use the spell names) are enumerated by the golden harness in Phase 2; Ghost and Night Hag Etherealness (SPELLS-33.T4gh) are separate creature kinds and do not flip here.

## Size

5 as briefed for Banishment, Etherealness, Imprisonment, Maze (manual escape). Add 3 if Q3 requires the placement helper and Scene write, and 3 if Blink's turn-end gate must be built (recommended split to T2h2).

## D178 ruling and implementation (SPELLS-4.T2h1, current)

- Option A approved. Blink moved to T2h2 (generic turn-end d20 gate); Maze's escape check stays `MANUAL_ADJUDICATION` (T2h3, after T2f1).
- Every absent actor (any `absence` value) is untargetable: refused by the single-target policy and skipped by area resolution. Amends D128.
- Deviation from the packet: the `absence` enum gains `EFFECT` and `EFFECT_KEEPS_TURN` instead of an `absenceSourceEffectId`. The effect store recomputes absence from the `PLAY_ABSENCE` effects the holder still holds, so overlapping removals work and `GM_REMOVED`/`DEPARTED` are never touched.
- Imprisonment has no mode pick in the SRD authoring, so it is the removal alone; the future-cast immunity marker is description-only.
- Not built: the `RETURN_SPACE_OCCUPIED` GM-placement flag. No flag surface exists for effect-driven returns (the token never leaves the Scene), so it needs its own slice.

## D178 amendment: the turn-end roll gate (SPELLS-4.T2h2, current)

- A result block's `lifecycle.turnEndGate { minimumRoll }` (2..20) rolls a bare d20 at the end of the holder's turn, on the repeat-save pipeline (no ability, modifier 0, DC = `minimumRoll`). A total at or above it passes.
- A pass mints one child effect (`turnEndGateChildEffect`, `rules-runtime/encounterEffectTurnEndGate.ts`): `linkedEffectId` is the rolling effect (D172, so it ends with its parent), one tick decremented at the holder's next turn start, and the authored outcome's `PLAY_ABSENCE` state contribution. The id is derived from the parent's, since the prior child is gone by the next turn end. A failed roll mints nothing; the parent keeps rolling until its duration ends.
- The gating effect itself holds no outcome: Blink authors only `turnEndGate` plus the `REMOVE_FROM_PLAY { keepsTurn: true }` outcome, and `recurringKind` must not be authored beside it.
- The child carries its own frozen `condition-duration` graph, since it cannot reuse the parent's repeat-save graph.
- Proofs: `nativeRoomTurnEndGate.test.ts` (room journey: 11+ removes the caster until their next turn starts, 10 leaves them in play, the spell remains), `removeFromPlayAuthoringParity.test.ts` (SRD and homebrew through the effect node map), `playAbsencePersistence.test.ts` (child id, link, absence), and the Blink golden line.
- The `BLINK` closed rule kind is deleted. Blink returns to the space it left; "space of your choice within 10 feet" stays in [future enhancements](../roadmap/future-enhancements.md#return-placement-and-plane-rules).
