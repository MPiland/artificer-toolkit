# UAT-ENCOUNTER-1: Assisted and Manual Encounter journeys pass

Assisted and Manual Encounter journeys pass.

Level 4 (Advanced play) · Feature ENCOUNTER · Mode: Group (GM, P1, P2, P3) · Path position 143 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- The review data provides the Campaign **Review: Sandbox** (owner GM; members P1, P2 and P3 with Iris, Juno and Kit; Manual mode; dim light and per-player fog; a wall with a closed door, a rubble line and one light; a visible Ogre in the east room and a hidden Goblin and a hidden Wolf; the review Encounter started and nobody has acted).
- Done in [UAT-MOVE-9](../MOVE/UAT-MOVE-9.md): the Sandbox Scene is back to its seeded walls and zones.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **P1, P2, P3:** Switch **Auto-roll** ON in the tabletop header.
Part A: Assisted, three players

1. **GM:** Open **Review: Party in the Field**, then **Open tabletop window** in the **Live tabletop** panel. Note whose turn it is, the round number, and each creature's hit points on screen.
2. **P1, P2, P3:** Open the same live table. Confirm each header shows the **Player** badge and the Scene is visible.
3. **GM:** Open the Encounter drawer and the Encounter history. Confirm Aria, Bryn and Cade are listed as Characters (Friendly) and Wolf and Goblin as creatures (Hostile).
4. **GM:** Use **Next turn** until it is Aria's turn (or use **Current turn** if the tool offers a picker).
5. **P1:** Open the action drawer, pick Aria's weapon attack, aim it at the Wolf, and confirm. With auto-roll on, no roll prompt should appear.
6. **P1:** Choose **End turn**.
7. **P2:** Repeat steps 5 and 6 on Bryn's turn against the Goblin (the GM advances the turn first).
8. **P3:** On Cade's turn, attack the Wolf or Goblin and end the turn.
9. **GM:** On a creature's turn, act for the Wolf (attack a Character), then end its turn. Note the round number when the turn order wraps.
10. **GM:** Open the Encounter history and read every entry from this scenario.
11. **GM:** Choose **Complete encounter**. Confirm the Encounter is finished and the live table shows no active turn.

Part B: Manual

12. **GM:** Open **Review: Sandbox** and, in its table settings, check **Automation mode** is **Manual**. Choose **Complete encounter** on its already started Encounter. Reuse its presented Scene, which has tokens for Iris, Juno and Kit.
13. **GM:** Create an Encounter with a Goblin; the party takes in the Sandbox's assigned Characters. Check that **Start encounter** stays disabled until every combatant has initiative.
14. **GM:** Use **Roll initiative** for the Goblin, then enter an Initiative number for each of P1's, P2's and P3's Characters, then **Start encounter**.
15. **P1:** Open the live table. Confirm the action drawer is not shown (Manual mode) and that you can still move your own Character's token.
16. **GM:** Use **Next turn** through a full round. Edit a hit point total by hand on a creature and confirm the app records it without applying any rule or prompt.
17. **GM:** Complete the Encounter. Leave **Automation mode** as **Manual**; afterwards start a new Encounter in Review: Sandbox from its Scene with the same three Characters, so later scenarios find it started.

## Expected

- In Part A every player attack is resolved by the app (damage and hit points change on screen) without a roll prompt, and each player acted only on their own Character's turn.
- Each action is one line in Encounter history, naming the actor and the result, and the round number rises once after the last creature acts.
- A Character's assigned player is already a controller of that Character (P1 can act for Aria without the GM setting anything); the Wolf and Goblin can be acted for only by the GM.
- After **Complete encounter** the Run no longer shows as active.
- In Part B the **Start encounter** button is disabled until every combatant has initiative, then enabled.
- In Manual mode the action drawer is hidden for players, no roll prompts or reaction prompts appear, and the table tracks turns, rounds and reminders only. (The "Assisted only" refusal of a rules action cannot be triggered by hand because no rules control is offered; the ledger proof covers it.)
- The Manual Encounter's party is exactly the Sandbox's active Character assignments: Iris, Juno and Kit are in the order.

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
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
