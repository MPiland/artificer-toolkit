# UAT-REACTION-1: Shield prompts the right player while the attacker waits

Shield prompts the right player while the attacker waits.

Level 3 (Core play) · Feature REACTION · Mode: Group (GM, P1, P2, P3) · Path position 110 of 191

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- P1 has Aria seated in The Campaign. P1 has 1 of 6 personal Characters, so there is room to build Ember in step S0.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S0. **P1:** In the Builder (as in [BUILDER-1](../BUILDER/UAT-BUILDER-1.md) steps 1 to 10) build and activate **Ember**, a level 3 Wizard who has Shield and Hold Person prepared and first-level spell slots. Later scenarios reuse her.
S1. **GM:** Choose **Complete encounter** on any running Encounter. **P1:** Use **Change Character** to put Ember in The Campaign in place of Aria. **GM:** Create and start an Encounter in Assisted mode with Ember, a Wolf and a Goblin, and use **Next turn** until Ember's Shield reaction is available.
S2. **P1:** Auto-roll ON.

1. [ ] **GM:** Open the live table. Note Ember's hit points, armor class, remaining first-level slots and that her reaction is available.
2. [ ] **GM:** Advance to the Wolf's turn. Have the Wolf attack Ember with an attack that will hit (use the roll the app produces).
3. [ ] **P1:** Confirm a reaction prompt appears for Ember offering **Use** or **Decline**, and that the hit has not been applied yet (Ember's hit points unchanged).
4. [ ] **GM:** Confirm you see the attack held and waiting, and that no timer is running.
5. [ ] **P1:** Wait 60 seconds without answering. Confirm nothing is applied.
6. [ ] **P1:** Close the tab and reopen the live table. Confirm the prompt is still there.
7. [ ] **P1:** Choose **Use**. Confirm one first-level slot is spent, Ember's reaction is used and her armor class goes up.
8. [ ] **GM:** Confirm the Wolf's hit became a miss if the new armor class beat the roll, and read the history.
9. [ ] **GM:** Choose **Undo last action**. Confirm the reaction, the slot and the hit are restored.
10. [ ] **GM:** Advance to the Wolf's next turn and have it attack Ember again (repeat steps 2 to 3), then **P1:** choose **Decline**. Confirm the hit is applied and Ember's reaction and slot are not spent.
11. [ ] **GM:** Repeat steps 2 to 3 once more, then **P1:** choose **Use**. Then, in the same round, have the Wolf (or the other hostile) attack Ember again. Confirm no second reaction is offered (one reaction per round).
12. [ ] **GM:** Advance to the next round and confirm Ember's reaction is available again.
13. [ ] **P1:** On Ember's turn, try to cast Shield from the ordinary action list (not as a reaction). Read the refusal.
        R1. **GM:** Complete the Encounter. **P1:** Use **Change Character** to put Aria back in The Campaign in place of Ember.

## Expected

- The Use/Decline prompt reaches only Ember's controller (P1) and the GM.
- The hit waits for the answer with no timer; the prompt survives a reload.
- Use spends the reaction and slot and the new AC counts against the triggering attack; Decline applies the hit; undo restores everything.
- A creature gets one reaction per round (step 11); Decline leaves the reaction and slot unspent (step 10).
- A reaction-only spell such as Shield cannot be cast as an ordinary action (step 13).
- After the reload in step 6 the prompt shows the same offer, not a new one.

## Other users see

- **GM:** Sees the attack held while the decision is open and sees who has answered.
- **P2, P3:** Watching the same table as seated players: they see the held attack but get no Use or Decline prompt for Ember.

## ACs covered

REACTION-1.1, REACTION-1.2, REACTION-3.1, REACTION-4.1, REACTION-4.4, REACTION-4.5

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
