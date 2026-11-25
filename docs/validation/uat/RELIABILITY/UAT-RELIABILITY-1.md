# UAT-RELIABILITY-1: Privacy, replay, rollback, concurrency and performance hold together

Privacy, replay, rollback, concurrency and performance hold together.

Level 3 (Core play) · Feature RELIABILITY · Mode: Group (GM, P1, P2) · Path position 124 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The Campaign has a Scene presented and an Encounter started in Assisted mode with a Wolf, a Goblin and the party's Characters, in round 2 ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, then **Next turn** until round 2).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. Note Aria's and the Wolf's hit points and Aria's position before you start. **All:** Roll my dice automatically OFF.

1. [ ] **GM:** Set the **Roll visibility** switch in the action drawer to **Private**. Make any roll for the Wolf (for example roll its initiative or an attack roll). Note what the roll shows.
2. [ ] **P1:** Drag Aria's token away from the Wolf so Aria leaves the Wolf's reach (a small step is enough).
3. [ ] **P1:** Read the screen. The move must pause rather than finish.
4. [ ] **GM:** Find the **Pending decision** drawer and read it. It offers **Use reaction** and **Decline reaction** for the Wolf. Do not answer yet.
5. [ ] **P2:** Try to drag Bryn's token a short distance. Read the message.
6. [ ] **GM:** Set the browser to Offline for about 15 seconds, then set it back to No throttling (or close the tab and reopen the live table).
7. [ ] **GM:** Read the **Pending decision** drawer again.
8. [ ] **P1:** Reload the page (browser refresh) while the decision is still open. Reopen the live table. Read what Aria's token and the drawer show.
9. [ ] **GM:** Double-click **Use reaction** quickly (two clicks in under a second).
10. [ ] **GM:** Open the Encounter history. Count the opportunity attacks against Aria that were just added.
11. [ ] **P1:** Reload the page again and compare Aria's hit points, the Wolf's reaction, and the history with before the reload.
12. [ ] **GM:** In the Encounter turn menu choose **Undo last action**. Note Aria's hit points afterwards.
13. [ ] **GM:** Reload the page, open the turn menu again and try **Undo last action** a second time. Read the message.
14. [ ] **P1:** Look for any undo control at the table. Then open chat and look for **My rolls**.
15. [ ] **P2:** Reload and check that the GM's private roll from step 1 is not in chat or the roll cards.

## Expected

- Step 3: Aria's move is paused on a **Pending decision**, not completed.
- Step 5: Bryn's move is refused with "Waiting on a movement decision."
- Step 7: the decision is still open, unchanged, after the reconnect; wording such as "This choice is durable. Reconnecting returns to the same decision." may appear. No second prompt appears and none has been lost. (A temporary preview, such as an aimed area, may have vanished; that is allowed.)
- Step 8: after the reload the decision is still pending and Aria's token has not jumped.
- Steps 9-10: exactly one opportunity attack is recorded, with no repeated roll. The Wolf's reaction is spent once. P1's window shows Aria's move arrive and the result of the opportunity attack once each, with nothing repeated.
- Step 11: after reload the hit points, history entry count and reaction state are identical to before the reload; nothing is rolled again.
- Step 12: Aria's hit points and the Wolf's reaction return to their values before the opportunity attack.
- Step 13: the second undo is refused (already undone, or nothing to undo); nothing changes.
- Step 14: P1 has no undo control. The GM's private roll is only in the GM's **My rolls**.
- Step 15: the private roll is absent for P2 both before and after the reload.

## Other users see

- **P1:** After step 9 sees Aria's move complete and the opportunity attack result; after step 12 sees Aria's hit points restored.
- **P2:** Sees the "Waiting on a movement decision." refusal; must NOT see the GM's private roll at any point, including after a reload.

## ACs covered

RELIABILITY-1.1, RELIABILITY-1.2, RELIABILITY-3.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
