# UAT-RULES-3: A reaction pauses a hit; answering resumes it; privacy of the pause

A reaction pauses a hit; answering resumes it; privacy of the pause.

Level 3 (Core play) · Feature RULES · Mode: Group (GM, P1, P2) · Path position 111 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Shield and Hold** (owner GM; member P1 with Ember, who has Shield and Hold Person; a Wolf and a Goblin; Assisted mode; the review Encounter started with the Goblin held by Ember's Hold Person and Ember's Shield reaction already used this round).
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** In Review: Shield and Hold use **Next turn** until a new round starts and Ember's Shield reaction is available again.

1. **GM:** Open the tabletop of Review: Shield and Hold and advance to the Wolf's turn.
2. **GM:** Have the Wolf attack Ember from the action drawer.
3. **GM:** Read the Encounter panel while the attack is waiting.
4. **P1:** Read the reaction prompt that appears for Ember (Shield).
5. **P1:** Close the tab, wait a few seconds, and reopen the tabletop. (Alternatively set the browser's Network panel to Offline for 10 seconds and back.)
6. **P1:** Read the prompt again, then choose **Use reaction**.
7. **P1:** If asked, roll or enter the dice and let the attack complete.
8. **GM:** Read the Encounter history for this attack.
9. **GM:** Advance through Ember's turn (her reaction becomes available again) to the Wolf's next turn. Repeat steps 2-4, then choose **Skip decision** instead of waiting.
10. **P2:** In P2's own window, try to open the tabletop of Review: Shield and Hold (paste its address).

## Expected

- Step 3: the attack is held; Ember's hit points and slots have not changed yet.
- Step 4: Ember's controller (P1) sees the prompt; the GM can see that a decision is pending but cannot be fooled into resolving it as P1 unless they choose the GM override.
- Step 5-6: the same prompt is still waiting after the reconnect; no duplicate prompts.
- Step 7: after the answer, the attack finishes once: Shield's bonus applies to that attack (a hit can become a miss) and a first-level slot is spent.
- Step 8: the history shows one attack, the reaction, and the outcome, each once.
- Step 9: **Skip decision** treats a declinable choice as declined and play continues; no slot is spent.
- Step 10: P2 is refused (not a member); nothing of the Campaign is shown.

## Other users see

- **GM:** Sees the pending state and the final result.
- **P2:** In the Party in the Field window sees nothing of this Campaign's decision, dice or prompts at any step.

## ACs covered

RULES-1.2, RULES-1.4

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
