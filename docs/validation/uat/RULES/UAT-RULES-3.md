# UAT-RULES-3: A reaction pauses a hit; answering resumes it; privacy of the pause

A reaction pauses a hit; answering resumes it; privacy of the pause.

Level 3 (Core play) · Feature RULES · Mode: Group (GM, P1, P2, P5) · Path position 114 of 191

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- Done in [UAT-REACTION-1](../REACTION/UAT-REACTION-1.md): P1 built **Ember**, a level 3 Wizard with Shield and Hold Person prepared and 1st-level slots. Ember is not seated yet; the setup step has P1 swap to her.
- **The Campaign** has Aria (P1), Bryn (P2) and Cade (P3), level 1 Fighters each player built, seated; Assisted mode with the Speed Factor initiative; and a running Encounter in round 2 with tokens for the three Fighters, a Wolf and a Goblin, as the GM built it in [UAT-ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) (steps 12 to 16) and played on.

## Accounts and windows

- **Roles used:** GM, P1, P2, P5 (P5 is not a member of The Campaign)
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Choose **Complete encounter** on any running Encounter. **P1:** Use **Change Character** to put Ember in The Campaign in place of Aria. **GM:** Create and start an Encounter in Assisted mode with Ember, a Wolf and a Goblin, and use **Next turn** until Ember's Shield reaction is available.

1. [ ] **GM:** Open the tabletop of The Campaign and advance to the Wolf's turn.
2. [ ] **GM:** Have the Wolf attack Ember from the action drawer.
3. [ ] **GM:** Read the Encounter panel while the attack is waiting.
4. [ ] **P1:** Read the reaction prompt that appears for Ember (Shield).
5. [ ] **P1:** Close the tab, wait a few seconds, and reopen the tabletop. (Alternatively set the browser's Network panel to Offline for 10 seconds and back.)
6. [ ] **P1:** Read the prompt again, then choose **Use reaction**.
7. [ ] **P1:** If asked, roll or enter the dice and let the attack complete.
8. [ ] **GM:** Read the Encounter history for this attack.
9. [ ] **GM:** Advance through Ember's turn (her reaction becomes available again) to the Wolf's next turn. Repeat steps 2-4, then choose **Skip decision** instead of waiting.
10. [ ] **P5:** Paste the address of The Campaign's tabletop (the GM sends it) and try to open it. P5 is not a member.
        R1. **GM:** Complete the Encounter. **P1:** Use **Change Character** to put Aria back in The Campaign in place of Ember.

## Expected

- Step 3: the attack is held; Ember's hit points and slots have not changed yet.
- Step 4: Ember's controller (P1) sees the prompt; the GM can see that a decision is pending but cannot be fooled into resolving it as P1 unless they choose the GM override.
- Step 5-6: the same prompt is still waiting after the reconnect; no duplicate prompts.
- Step 7: after the answer, the attack finishes once: Shield's bonus applies to that attack (a hit can become a miss) and a first-level slot is spent.
- Step 8: the history shows one attack, the reaction, and the outcome, each once.
- Step 9: **Skip decision** treats a declinable choice as declined and play continues; no slot is spent.
- Step 10: P5 is refused (not a member); nothing of the Campaign is shown.

## Other users see

- **GM:** Sees the pending state and the final result.
- **P2:** As a seated player watching the table, sees the held attack and the result but never a prompt, decision or private dice belonging to Ember.
- **P5:** Sees nothing of The Campaign at any step.

## ACs covered

RULES-1.2, RULES-1.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
