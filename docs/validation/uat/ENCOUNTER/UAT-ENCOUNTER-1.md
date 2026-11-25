# UAT-ENCOUNTER-1: Assisted and Manual Encounter journeys pass

Assisted and Manual Encounter journeys pass.

Level 4 (Advanced play) · Feature ENCOUNTER · Mode: Group (GM, P1, P2, P3) · Path position 148 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- The account **P2** exists and is seated as a player in The Campaign.
- The account **P3** exists and is seated as a player in The Campaign.
- **The Campaign** is running: P1, P2 and P3 are seated with Campaign Characters Aria, Bryn and Cade (Level 1 Fighters, each built by their own player in the Character Builder), a presented Scene with a Wolf token and a Goblin token, Assisted mode with the Speed Factor initiative, and an Encounter started and in round 2 (built in the CAMPAIGN, SCENE and ENCOUNTER scenarios).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P1, P2, P3:** Switch **Auto-roll** ON in the tabletop header.
Part A: Assisted, three players

1. [ ] **GM:** Open **The Campaign**, then **Open tabletop window** in the **Live tabletop** panel. Note whose turn it is, the round number, and each creature's hit points on screen.
2. [ ] **P1, P2, P3:** Open the same live table. Confirm each header shows the **Player** badge and the Scene is visible.
3. [ ] **GM:** Open the Encounter drawer and the Encounter history. Confirm Aria, Bryn and Cade are listed as Characters (Friendly) and Wolf and Goblin as creatures (Hostile).
4. [ ] **GM:** Use **Next turn** until it is Aria's turn (or use **Current turn** if the tool offers a picker).
5. [ ] **P1:** Open the action drawer, pick Aria's weapon attack, aim it at the Wolf, and confirm. With auto-roll on, no roll prompt should appear.
6. [ ] **P1:** Choose **End turn**.
7. [ ] **P2:** Repeat steps 5 and 6 on Bryn's turn against the Goblin (the GM advances the turn first).
8. [ ] **P3:** On Cade's turn, attack the Wolf or Goblin and end the turn.
9. [ ] **GM:** On a creature's turn, act for the Wolf (attack a Character), then end its turn. Note the round number when the turn order wraps.
10. [ ] **GM:** Open the Encounter history and read every entry from this scenario.
11. [ ] **GM:** Choose **Complete encounter**. Confirm the Encounter is finished and the live table shows no active turn.

Part B: Manual

12. [ ] **GM:** In The Campaign's table settings, change **Automation mode** to **Manual** (the Encounter from Part A is already complete). Reuse the presented Scene, which has tokens for Aria, Bryn and Cade.
13. [ ] **GM:** Create an Encounter with a Goblin; the party takes in The Campaign's assigned Characters. Check that **Start encounter** stays disabled until every combatant has initiative.
14. [ ] **GM:** Use **Roll initiative** for the Goblin, then enter an Initiative number for each of P1's, P2's and P3's Characters, then **Start encounter**.
15. [ ] **P1:** Open the live table. Confirm the action drawer is not shown (Manual mode) and that you can still move your own Character's token.
16. [ ] **GM:** Use **Next turn** through a full round. Edit a hit point total by hand on a creature and confirm the app records it without applying any rule or prompt.
17. [ ] **GM:** Complete the Encounter. Change **Automation mode** back to **Assisted**, then start a new Encounter from the Scene with the same three Characters, so later scenarios find The Campaign as it was before Part B.

## Expected

- In Part A every player attack is resolved by the app (damage and hit points change on screen) without a roll prompt, and each player acted only on their own Character's turn.
- Each action is one line in Encounter history, naming the actor and the result, and the round number rises once after the last creature acts.
- A Character's assigned player is already a controller of that Character (P1 can act for Aria without the GM setting anything); the Wolf and Goblin can be acted for only by the GM.
- After **Complete encounter** the Run no longer shows as active.
- In Part B the **Start encounter** button is disabled until every combatant has initiative, then enabled.
- In Manual mode the action drawer is hidden for players, no roll prompts or reaction prompts appear, and the table tracks turns, rounds and reminders only. (The "Assisted only" refusal of a rules action cannot be triggered by hand because no rules control is offered; the ledger proof covers it.)
- The Manual Encounter's party is exactly The Campaign's active Character assignments: Aria, Bryn and Cade are in the order.

## Other users see

- **P2, P3:** Every attack, hit point change and turn change from other users appears live without a refresh. They never see the GM's private rolls.
- **P1 (Part B):** A Manual-mode table shows turn order and rounds but no attack outcomes computed by the app.

## ACs covered

ENCOUNTER-2.2, ENCOUNTER-2.3, ENCOUNTER-2.7, ENCOUNTER-3.3, ENCOUNTER-3.4, ENCOUNTER-3.5, ENCOUNTER-3.6, ENCOUNTER-5.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
