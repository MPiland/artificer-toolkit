# UAT-ATTACK-4: Undo last action and its refusals

Undo last action and its refusals.

Level 4 (Advanced play) · Feature ATTACK · Mode: Group (GM, P1, P2) · Path position 152 of 195

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- **The Campaign** has Aria (P1), Bryn (P2) and Cade (P3), level 1 Fighters each player built, seated; Assisted mode with the Speed Factor initiative; and a running Encounter in round 2 with tokens for the three Fighters, a Wolf and a Goblin, as the GM built it in [UAT-ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) (steps 12 to 16) and played on.
- Done in [UAT-REACTION-1](../REACTION/UAT-REACTION-1.md): P1 built **Ember**, a level 3 Wizard with Shield and Hold Person prepared (used in step 7: the party's wizard joins for that fight, so P1 marks Ember active, and marks Aria active again in R1). Ember is on the bench in The Campaign from REACTION-1.
- Done in [UAT-ENCOUNTER-2](../ENCOUNTER/UAT-ENCOUNTER-2.md): the Campaign's first Encounter was completed and its Scene is still presented.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** If The Campaign has no running Encounter, create and start one with Aria, Bryn, Cade, a Wolf and a Goblin, as in [ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) steps 12 to 16, and advance until Aria is the active actor.
S2. **P1:** Switch **Auto-roll** ON.

1. [ ] **P1:** On Aria's turn, attack the Wolf. Note the Wolf's hit points before and after.
2. [ ] **P1:** Look for an undo control. Confirm players cannot undo anything at the live table.
3. [ ] **GM:** In the Encounter turn menu choose **Undo last action**. Confirm the Wolf's hit points are back to the value before the attack, Aria's action is available again and the attack slot is returned.
4. [ ] **GM:** Choose **Undo last action** again right away. Read the refusal (nothing to undo or already undone).
5. [ ] **P1:** Attack again. Then **GM:** move any token. Then **GM:** **Undo last action**. Read the refusal (a later change touched an affected actor) and the "adjust manually" message.
6. [ ] **P1:** Attack again. **P1:** before the GM undoes, edit Aria's hit points or spend her Second Wind from the Sheet. **GM:** try **Undo last action**. Read the refusal (Sheet changed since).
7. [ ] **GM:** Choose **Complete encounter**. **P1:** Choose **Mark active** on Ember, who is benched in The Campaign (the party's wizard joins for this fight). **GM:** Create and start a new Encounter with Ember, a Wolf and a Goblin. **P1:** Cast Hold Person on the Goblin so Ember holds Concentration. **GM:** Have the Wolf attack Ember until a hit forces a Concentration check that Ember fails (or type a low roll when prompted), so the Concentration ends. **GM:** try to undo that damage action. Read the refusal naming what cannot be restored. Steps 8 to 10 use this new Encounter.
8. [ ] **P1:** Begin an action that raises a Pending decision (move out of an enemy's reach). While the decision is open, **GM:** try **Undo last action**. Read the refusal.
9. [ ] **GM:** Place a zone (hazard) with the zone tool as in [UAT-MOVE-8](../MOVE/UAT-MOVE-8.md) step 1 and use **Undo placement**. Confirm the zone disappears.
10. [ ] **GM:** Complete the Encounter, then try **Undo last action**. Read the refusal.
        R1. **P1:** Choose **Mark active** on Aria again (the wizard sits out the next arc); Ember stays on the bench.

## Expected

- Undo exactly restores hit points, conditions, resources, effects, action used and slots when the action was the latest change.
- Undo is refused with a plain explanation when a decision is pending, the Encounter is not active, it was already undone, a later command or Sheet write touched an involved actor, or the action involved something the app cannot rewind (contest, escape, mirrored damage, ended Concentration).
- After undo the action cannot be redone.

## Other users see

- **P2:** Sees hit points and the history return to the earlier state live.
- **P1:** Sees the attack disappear from history with a note that the GM undid it.

## ACs covered

ATTACK-3.3, ATTACK-8.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
