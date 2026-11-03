# UAT-ATTACK-4: Undo last action and its refusals

Undo last action and its refusals.

Level 4 (Advanced play) · Feature ATTACK · Mode: Group (GM, P1, P2) · Path position 145 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- The review data provides the Campaign **Review: Shield and Hold** (owner GM; member P1 with Ember, who has Shield and Hold Person; a Wolf and a Goblin; Assisted mode; the review Encounter started with the Goblin held by Ember's Hold Person and Ember's Shield reaction already used this round).
- Done in [UAT-ENCOUNTER-2](../ENCOUNTER/UAT-ENCOUNTER-2.md): the Party Encounter was completed; the Party Scene is still presented.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** If Review: Party in the Field has no running Encounter, create and start one with Aria, Bryn, Cade, a Wolf and a Goblin, as in [ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) steps 12 to 16, and advance until Aria is the active actor.
S2. **P1:** Switch **Auto-roll** ON. For step 7 **GM:** In Review: Shield and Hold use **Next turn** until Ember's reaction is available.

1. **P1:** On Aria's turn, attack the Wolf. Note the Wolf's hit points before and after.
2. **P1:** Look for an undo control. Confirm players cannot undo anything at the live table.
3. **GM:** In the Encounter turn menu choose **Undo last action**. Confirm the Wolf's hit points are back to the value before the attack, Aria's action is available again and the attack slot is returned.
4. **GM:** Choose **Undo last action** again right away. Read the refusal (nothing to undo or already undone).
5. **P1:** Attack again. Then **GM:** move any token. Then **GM:** **Undo last action**. Read the refusal (a later change touched an affected actor) and the "adjust manually" message.
6. **P1:** Attack again. **P1:** before the GM undoes, edit Aria's hit points or spend her Second Wind from the Sheet. **GM:** try **Undo last action**. Read the refusal (Sheet changed since).
7. **GM:** Switch to **Review: Shield and Hold** (GM and P1 only), where Ember holds Concentration on Hold Person. Have the Wolf attack Ember until a hit forces a Concentration check that Ember fails (or type a low roll when prompted), so the Concentration ends. **GM:** try to undo that damage action. Read the refusal naming what cannot be restored.
8. **P1:** Begin an action that raises a Pending decision (move out of an enemy's reach). While the decision is open, **GM:** try **Undo last action**. Read the refusal.
9. **GM:** Back in **Review: Party in the Field**, place a zone (hazard) with the zone tool as in [UAT-MOVE-8](../MOVE/UAT-MOVE-8.md) step 1 and use **Undo placement**. Confirm the zone disappears.
10. **GM:** Complete the Encounter, then try **Undo last action**. Read the refusal.

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
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
