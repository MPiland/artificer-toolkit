# UAT-PERF-2: Four people at a local table feel responsive

Four people at a local table feel responsive.

Level 3 (Core play) · Feature PERF · Mode: Group (GM, P1, P2, P3) · Path position 124 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Note the current turn. Press **Next turn** and start the stopwatch.
2. **P1, P2, P3:** Each stop your stopwatch when the turn marker changes in your own window. Record the three times.
3. **GM:** Use **Next turn** until it is Aria's turn.
4. **P1:** Open the action drawer and attack the Wolf. Roll when asked.
5. **GM, P2, P3:** Note how long until the attack result appears in your own window.
6. **P2 and P3, together:** P2 drags Bryn's token while P3 drags Cade's token. Note whether either feels stuck. If the Encounter refuses a move out of turn, record that and do this step on a Scene outside an Encounter (the Sandbox Campaign, as in [UAT-MOVE-5](../MOVE/UAT-MOVE-5.md)).
7. **P1:** Open Aria's Sheet in another tab, apply 1 point of damage or healing and save. Switch back to the table.
8. **P3:** Go to the Campaign page outside the table and watch the displayed hit points while the GM changes the Wolf's or Aria's hit points at the table.
9. **P1:** On Aria's turn, drag Aria's token away from the Wolf so a **Pending decision** opens.
10. **GM, P1, P2, P3:** Each confirm the turn and the chat in your own window match the GM's, and read what you see for the pending decision. Then the decision's owner resolves it (**Decline reaction** is enough).

## Expected

- Step 2: all three turn markers change within about a second of the GM's click. Record any time over three seconds with the time.
- Step 5: the attack result shows in all four windows at about the same time, with no window waiting for a page refresh.
- Step 6: both token moves show smoothly in the other windows, and neither move is lost.
- Step 7: the Sheet change appears at the table at once (no refresh).
- Step 8: P3's Campaign page updates without a refresh for the values P3 may see.
- Step 10: turn and chat are the same in all four windows; the decision's owner sees the prompt and the other windows show "Waiting on a movement decision." (or the same pending state), then everyone sees it cleared once resolved.

## Other users see

- **P2:** The result of P1's attack and the turn change at about the same moment as the GM.
- **P3:** Same as P2; on the Campaign page sees updated hit points only for Characters that P3 is allowed to see.

## ACs covered

PERF-1.3, PERF-3.2, PERF-3.3, PERF-3.7

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
