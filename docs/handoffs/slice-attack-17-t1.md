# Slice workbook: ATTACK-17.T1 (the roller sees their own private roll card)

**Status:** OPEN (written 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Before any work, confirm that your worktree is based on `codex/phase-08-2-convex-cutover`. If it is based on `main`, merge the lane branch first. Session cards can't carry the base branch.

Roll cards have two audiences: `TABLE` and `PRIVATE`. A `PRIVATE` card goes only into the GM's history. `readRuleRollRouting` and `recordRuleRollCard` in `packages/encounter-persistence/src/ruleRollCards.ts` decide this.

A roller is private when its actor is not public (D62). A roller is also private when the area's caster can't perceive it: `rollerAsPerceivedByCaster` applies at `evidenceRolls.ts` (about line 259) and `areaCommitPersistence.ts` (about line 480).

In both cases, the player who controls that creature and presses Roll dice gets no card. `evidenceRolls.ts` (about line 274) nulls the roll in that player's answer. AC 17.5 says the player must still see their own card, while the table and the caster must not.

- **Rule:**
  - A `PRIVATE` roll card is retained for the GM, as today.
  - When the roller's controlling member is not the GM, the card is also retained in that member's private roll history.
  - That member's command answer carries the roll.
  - Nobody else gets it: not the table, the caster, or other players.
  - Decide this once, in `recordRuleRollCard`, so both the evidence-roll path and the area-commit path get it. No per-caller branches.
- **Ports:**
  - `retainPrivateRoll` (formerly `retainGmRoll`) already takes a user id: the Worker's `apps/session-worker/src/roomEncounterWritePorts.ts` and Convex's `apps/apis/convex/encounters/encounterPorts.ts`.
  - If the port is reused for the player, rename it to describe what it does (for example `retainPrivateRoll`) across every implementation and caller. Don't add a second near-identical port.
  - The Worker already sends a retained private roll only to that user's sockets (`nativeLiveSessionRoom.ts`, about line 2874). Confirm this rather than re-implementing it.
- **GM reveal:**
  - The GM's later reveal of a private roll keeps working unchanged.
  - The player's copy needs no reveal, because it's their own roll.
- **Out of scope:** the target-list and map visibility (ATTACK-17.T2 and T3) and the drawer UI. The Encounter roll-card UI already renders a player's private history entries. If it doesn't, stop and report.

Escalate (`SendMessage` to the main session) only if:

- the player's copy needs a new persisted field or table; or
- the rule conflicts with D62 or D83 as written.

Read first:

- D62, D83 and the SPELLS-7 slice 5e entry (the ISSUER timeline audience) in `docs/handoffs/phase-08-2-decisions.md`.
- `ruleRollCards.ts`, `evidenceRolls.ts` and the `retainPrivateRoll` implementations (formerly `retainGmRoll`).

## Closes

- AC ATTACK-17.5 (task ATTACK-17.T1).

## File scope

- `packages/encounter-persistence`: `ruleRollCards.ts`, `evidenceRolls.ts`, and `areaCommitPersistence.ts` only if a caller must change.
- `packages/encounter-persistence`: the port type.
- The port implementations in `apps/session-worker/src` and `apps/apis/convex/encounters`.
- Tests next to each.
- No web change.

Other sessions are editing `areaCommitPersistence.ts`, `nativeLiveSessionRoom.ts` and `roomEncounterCommands.ts`. Keep your edits there minimal, and merge the base branch before your final batch.

## Red-first checklist

1. **Routing, unit:**
   - A hidden actor controlled by a player rolls. The card is retained for the GM and for that player; no table card is posted.
   - A GM-controlled hidden actor's card is retained for the GM only.
   - A public player actor's card still goes to the table.
2. **Area save, unseen by the caster:**
   - A player's creature that the caster can't perceive rolls its area save.
   - Its controller's answer carries the roll, and their history holds it.
   - The caster's answer and history don't.
3. **Journey:** a Worker Encounter journey through real code.
   - Player A casts an area on Player B's creature, which A can't perceive.
   - B presses Roll dice. B's socket receives the private roll.
   - A's socket and the table's chat receive nothing.
   - The GM's history holds the card.
4. **Regression:** the existing D62 and SPELLS-7 roll-privacy tests pass unchanged.

## Status log

- 2026-10-14: workbook written.
- 2026-10-14: worktree was missing 522f6b9ae; merged `codex/phase-08-2-convex-cutover`.
- 2026-10-14: red first (`local-validation/attack-17-t1/red-*.log`, builds exit 0). The unit, Convex, area-save and journey tests failed for the intended reasons: no `retainPrivateRoll`, the controller's answer and history empty. One Convex case (GM-controlled hidden creature) failed on setup (`NOT_ACTOR_CONTROLLER`, later `TARGET_UNAVAILABLE`); I rewrote its setup to a GM-controlled hidden attacker, the assertions are unchanged in intent.
- 2026-10-14: green (`green-*.log`, `green2-*.log`). One journey assertion still failed after the routing fix: the Worker's fan-out sent the roller's `evidenceRoll` (same roll id and faces) to every recipient of the command, including the caster. Fixed in `roomEncounterCommands.ts` (see Deviations).
- 2026-10-14: review round (frozen list): `evidenceRoll` made initiator-scoped (dropped the holders set), checkpoint member copy requires an active member plus profile with a per-user cache, negative checkpoint cases added, reveal refusal for an unbound roll, workbook names fixed. Reruns in `green3-*.log`.
- Process slip: early in the slice I edited two Worker test files with a Python heredoc and used shell `ls`/`head`/`git diff`, against the workbook rules. Files were re-read afterwards; no functional damage.

### Checklist

1. Routing, unit: `ruleRollCards.test.ts` (5 cases: hidden player actor, sight-adjusted `gmRoll`, GM-controlled hidden actor, controller who left, public player actor). Red `red-unit.log`, green `green2-unit.log`. Convex: `evidenceRolls.test.ts` "Roll cards of a hidden creature a player controls" (3 cases). Red `red-convex.log`, green `green2-convex.log`.
2. Area save, unseen by the caster: `nativeRoomAreaAction.test.ts` (controller's answer carries the roll; holders are the GM and the controller only). Red `red-worker.log`, green `green2-worker.log`.
3. Worker journey: `nativeRoomAreaJourney.test.ts` (A casts, B rolls; B's socket gets the private roll, A's socket and the table's chat get nothing, the GM holds the card). Red `red-worker.log`, green `green2-worker.log`.
4. Regression: `initiativeRollCards`, `checkpointRecords` (`green-unit.log`); `evidenceRolls`, `checkpoint`, `initiativeDeclarations`, `turnConcentration`, `actionCommands` (`green-convex.log`, `green2-convex.log`); Worker `nativeLiveSessionRoom`, `nativeRoomEvidence`, `nativeCharacterSheet`, `nativeRoomLegendary`, plus `test:unit` `roomPrivateRolls` and `roomEncounterConcentrationResponse` (`green2-worker*.log`). Typechecks: schema, encounter-persistence, apis (`typecheck`, `typecheck:convex`) and session-worker, all exit 0 (`green*-tsc-*.log`).

### Deviations

- `retainGmRoll` was renamed `retainPrivateRoll` in every port, `Pick` and caller; its binding is `GmCampaignRollDto | null`. The player's copy has a null binding, so no reveal button or "Revealed to table" label shows. It holds the generic `roll`, never `gmRoll`, so the sight reason does not leak.
- Checkpoint retained-roll schema: `gmCampaignRoll` is now nullable (not a new field or table, so no escalation). `checkpointPrivateRolls.ts` accepts a member's own roll only when the binding is null and the member has an `ACTIVE` membership and a `userProfiles` row (checked once per user per checkpoint); the owner's roll still needs a binding for this Campaign. The "belongs to another owner, Campaign or System" cases in `checkpoint.test.ts` still throw, and a new test covers a non-member, a `LEFT` member, an owner with a null binding, a member copy with a binding, a changed record, and null-versus-bound mismatches both ways. One test literal in that file was rewritten as an explicit object so it typechecks against the nullable binding; the assertion is unchanged.
- Worker fan-out (`roomEncounterCommands.ts`): the roller's `evidenceRoll` is initiator-scoped, like `roll` and as on the Convex route (`evidenceRolls.ts`). The caster no longer receives the dice of a roll they cannot perceive; the journey test asserts the caster's `evidenceRoll` is null and the roller's is their own. This is not a change to the card routing and adds no second copy of the privacy rule.
- Reveal (`roomChatCommands.ts`): a retained roll with no binding for this Campaign now gets its own refusal ("not a private GM roll of this Campaign"), not the "made before the live table started" one.
- Fixtures: a second player (`otherPlayerId`, token), `otherPlayerControlledActorIds`, `sendAsPlayer(..., who)`, `readRoomPrivateRollHolders`.
- Docs: `live-sessions.md` and `persistence.md` describe the player's copy.

### Risks

- Out of scope, follow-up for the ledger: concentration check cards (`concentrationRollPersistence.ts`, `concentrationEnd.ts`) still retain for the GM only, so a player controlling a hidden concentrating creature sees no card for the check. Not part of AC 17.5.
- A reveal request on a roll with no binding for this Campaign (a player's own copy) is refused with its own message; only the owner can reveal today, so no user-visible change.
- Typecheck of `apps/web` was not run (no web import of the changed types).

## Proposed ledger edits (filled by the slice session)

- ATTACK-17.5 (task ATTACK-17.T1): done. Proof: the tests above.
- New follow-up for the ledger: concentration check cards for a hidden creature a player controls (see Risks).
