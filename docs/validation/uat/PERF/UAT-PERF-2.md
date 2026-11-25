# UAT-PERF-2: Four people at a local table feel responsive

Four people at a local table feel responsive.

Level 3 (Core play) · Feature PERF · Mode: Group (GM, P1, P2, P3) · Path position 129 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The Campaign has a Scene presented and an Encounter started in Assisted mode with a Wolf, a Goblin and the party's Characters, in round 2 ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, then **Next turn** until round 2).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Note the current turn. Press **Next turn** and start the stopwatch.
2. [ ] **P1, P2, P3:** Each stop your stopwatch when the turn marker changes in your own window. Record the three times.
3. [ ] **GM:** Use **Next turn** until it is Aria's turn.
4. [ ] **P1:** Open the action drawer and attack the Wolf. Roll when asked.
5. [ ] **GM, P2, P3:** Note how long until the attack result appears in your own window.
6. [ ] **P2 and P3, together:** P2 drags Bryn's token while P3 drags Cade's token. Note whether either feels stuck. If the Encounter refuses a move out of turn, record that and do this step on a Scene outside an Encounter (The Campaign, as in [UAT-MOVE-5](../MOVE/UAT-MOVE-5.md)).
7. [ ] **P1:** Open Aria's Sheet in another tab, apply 1 point of damage or healing and save. Switch back to the table.
8. [ ] **P3:** Go to the Campaign page outside the table and watch the displayed hit points while the GM changes the Wolf's or Aria's hit points at the table.
9. [ ] **P1:** On Aria's turn, drag Aria's token away from the Wolf so a **Pending decision** opens.
10. [ ] **GM, P1, P2, P3:** Each confirm the turn and the chat in your own window match the GM's, and read what you see for the pending decision. Then the decision's owner resolves it (**Decline reaction** is enough).

## Expected

- Step 2: all three turn markers change within about a second of the GM's click. Record any time over three seconds with the time.
- Step 5: the attack result shows in all four windows at about the same time, with no window waiting for a page refresh.
- Step 6: both token moves show smoothly in the other windows, and neither move is lost.
- Step 7: the Sheet change appears at the table at once (no refresh).
- Step 8: The Campaign page in P3's window updates without a refresh for the values P3 may see.
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
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
