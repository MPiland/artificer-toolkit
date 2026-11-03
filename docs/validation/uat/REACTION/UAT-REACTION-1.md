# UAT-REACTION-1: Shield prompts the right player while the attacker waits

Shield prompts the right player while the attacker waits.

Level 3 (Core play) · Feature REACTION · Mode: Group (GM, P1, P2, P3) · Path position 107 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Shield and Hold** (owner GM; member P1 with Ember, who has Shield and Hold Person; a Wolf and a Goblin; Assisted mode; the review Encounter started with the Goblin held by Ember's Hold Person and Ember's Shield reaction already used this round).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** In Review: Shield and Hold use **Next turn** until a new round starts and Ember's Shield reaction is available again.
S2. **P1:** Auto-roll ON.

1. **GM:** Open the live table. Note Ember's hit points, armor class, remaining first-level slots and that her reaction is available.
2. **GM:** Advance to the Wolf's turn. Have the Wolf attack Ember with an attack that will hit (use the roll the app produces).
3. **P1:** Confirm a reaction prompt appears for Ember offering **Use** or **Decline**, and that the hit has not been applied yet (Ember's hit points unchanged).
4. **GM:** Confirm you see the attack held and waiting, and that no timer is running.
5. **P1:** Wait 60 seconds without answering. Confirm nothing is applied.
6. **P1:** Close the tab and reopen the live table. Confirm the prompt is still there.
7. **P1:** Choose **Use**. Confirm one first-level slot is spent, Ember's reaction is used and her armor class goes up.
8. **GM:** Confirm the Wolf's hit became a miss if the new armor class beat the roll, and read the history.
9. **GM:** Choose **Undo last action**. Confirm the reaction, the slot and the hit are restored.
10. **GM:** Advance to the Wolf's next turn and have it attack Ember again (repeat steps 2 to 3), then **P1:** choose **Decline**. Confirm the hit is applied and Ember's reaction and slot are not spent.
11. **GM:** Repeat steps 2 to 3 once more, then **P1:** choose **Use**. Then, in the same round, have the Wolf (or the other hostile) attack Ember again. Confirm no second reaction is offered (one reaction per round).
12. **GM:** Advance to the next round and confirm Ember's reaction is available again.
13. **P1:** On Ember's turn, try to cast Shield from the ordinary action list (not as a reaction). Read the refusal.

## Expected

- The Use/Decline prompt reaches only Ember's controller (P1) and the GM.
- The hit waits for the answer with no timer; the prompt survives a reload.
- Use spends the reaction and slot and the new AC counts against the triggering attack; Decline applies the hit; undo restores everything.
- A creature gets one reaction per round (step 11); Decline leaves the reaction and slot unspent (step 10).
- A reaction-only spell such as Shield cannot be cast as an ordinary action (step 13).
- After the reload in step 6 the prompt shows the same offer, not a new one.

## Other users see

- **GM:** Sees the attack held while the decision is open and sees who has answered.
- **P2/P3:** Not members of this Campaign; they see nothing of it.

## ACs covered

REACTION-1.1, REACTION-1.2, REACTION-3.1, REACTION-4.1, REACTION-4.4, REACTION-4.5

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
