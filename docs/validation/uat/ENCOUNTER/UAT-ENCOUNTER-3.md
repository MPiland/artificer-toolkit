# UAT-ENCOUNTER-3: Prepare, start, delete and persist a Run

Prepare, start, delete and persist a Run.

Level 2 (GM setup) · Feature ENCOUNTER · Mode: Group (GM, P1) · Path position 68 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- Done in [UAT-SCENE-1](../SCENE/UAT-SCENE-1.md): the Scene "UAT Cavern" exists in The Campaign.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1 is seated in The Campaign with Aria as their Campaign Character.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.
- **Settings:** The Campaign's Automation mode is **Assisted** (table settings).

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open The Campaign and check P1 is a member with a Character and the Scene exists.
2. [ ] **GM:** Create an Encounter Blueprint with a Wolf and a Goblin. Confirm it appears in the Campaign's Encounter list and the picker offers only Blueprints for this Campaign's game system.
3. [ ] **GM:** Create a Run from the Blueprint on the Scene. Confirm it is **Prepared** and the map shows tokens for each actor.
4. [ ] **GM:** Choose **Delete encounter** on the Prepared Run and confirm. Confirm it disappears and the Blueprint is still there.
5. [ ] **GM:** Create a Run again and **Start encounter**. Confirm it becomes active.
6. [ ] **GM:** Try to start a second Run in the same Campaign while the first is active. Read the refusal.
7. [ ] **GM:** Close the tab, then reopen the live table. Confirm the active Encounter and presented Scene are still there.
8. [ ] **P1:** Open the live table, confirm you see the same Scene and Encounter. Close and reopen; confirm it persists.
9. [ ] **GM:** Finish the Session (end the current Session from the Campaign session page). Confirm the Encounter is still active in the next Session.
10. [ ] **GM:** Remove an actor mid-combat when it is not its turn. Confirm the turn marker stays on the same actor.
11. [ ] **GM:** Add a reinforcement. Confirm the turn marker and history are unchanged.
12. [ ] **GM:** Complete the Encounter. Confirm the Scene stays presented to players.
13. [ ] **GM:** Create a new Run from the same Blueprint on the same Scene and start it. Confirm each actor's token binds again, with no duplicate tokens.
14. [ ] **GM:** Open the first Run's history. Confirm it still names its actors and results unchanged.

## Expected

- The Prepared Run can be deleted; a started one cannot be deleted, only completed.
- Starting a second Run while one is active is refused with a message naming the active Run.
- The active Encounter survives closing the tab, reconnecting and finishing a Session.
- Removing or adding an actor does not move the turn marker or erase history.
- The Scene stays presented after the Encounter completes.
- Steps 13 to 14: the second Run reuses the Scene's tokens without duplicates, and the first Run's history is intact.

## Other users see

- **P1:** The same Scene and Encounter; on completion the map remains and the turn order clears.

## ACs covered

ENCOUNTER-1.1, ENCOUNTER-2.1, ENCOUNTER-2.2, ENCOUNTER-2.4, ENCOUNTER-2.5, ENCOUNTER-3.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
