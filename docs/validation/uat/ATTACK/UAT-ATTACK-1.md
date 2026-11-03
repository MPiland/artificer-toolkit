# UAT-ATTACK-1: Effects, movement, reactions and the turn lifecycle pass end to end

Effects, movement, reactions and the turn lifecycle pass end to end.

Level 3 (Core play) · Feature ATTACK · Mode: Group (GM, P1, P2, P3) · Path position 93 of 190

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

S1. **All players:** Switch **Auto-roll** ON in the tabletop header.

1. **GM:** In the live table, read the round number, whose turn it is, and every hit point total. Write them down.
2. **GM:** Use **Next turn** until it is Aria's turn.
3. **P1:** Open the action drawer. Confirm the actions that cannot be used right now appear dimmed with a reason. Pick the weapon attack for Aria.
4. **P1:** Confirm the map shows a range ring around Aria's token and targetable creatures highlighted. Hover the Wolf and read the distance and roll modifiers shown. Press Esc and confirm targeting stops; pick the attack again.
5. **P1:** In targeting mode, open the Encounter drawer. Confirm the actor list is now sorted by distance with range shown. Click the Wolf on the list, not the map, and confirm it is the same target as clicking on the map would give.
6. **P1:** Confirm the attack. Read the roll card (hit or miss, damage, advantage reasons) and the Wolf's new hit points. Aria's club is her main-hand weapon, so damage is the full weapon roll plus her ability modifier.
7. **P1:** Aria has one attack in her Attack action (no Extra Attack), so confirm the drawer offers no further attack as part of that action and shows no "Attack 1 of 2". (Seeing "Attack 1 of 2" needs an Extra Attack Character: [UAT-ATTACK-9](UAT-ATTACK-9.md) step 6a.)
8. **P1:** Drag Aria's token one square away from the Wolf. Read the movement readout ("used / budget ft").
9. **GM:** When the Pending decision for an opportunity attack appears, choose **Use reaction** for the Wolf. Read the result. Note that no decision reached P2 or P3 (they were not in the audience).
10. **P1:** Choose **End turn**. Confirm the turn moves to the next creature in order.
11. **GM:** Act for the Wolf on its turn: attack Aria. Aria has no reaction feature, so no reaction prompt should reach P1; note that none appears.
12. **GM:** Advance through Bryn's and Cade's turns. Each of **P2** and **P3** attack a hostile creature on their own turn using the same steps 3 to 6.
13. **GM:** Complete a full round. Confirm the round number rose by one and that the turn-start steps ran in order for any creature that needed them (Recharge, death save, start-of-turn effects).
14. **GM:** Open the Encounter history and read the entries: each action, movement, reaction and turn change appears once.

## Expected

- Each player could act only for their own Character on that Character's turn; the same drawer, targeting ring and range list worked the same for each of the three players.
- Attack results change hit points on screen; a hit, miss or critical shows the dice and reasons.
- Turn order wraps. Taking the Attack action spends the Action once; with one attack in the action, no further attack is offered under it and no warning appears for the one attack made.
- Every step above appears in the history in order with the actor's name.

## Other users see

- **P2, P3:** Every attack, movement and reaction outcome appears live; the opportunity-attack decision is not shown to them while it is open.
- **P2 (during P1's turn):** The action drawer shows P2's own Character actions only as unavailable out of turn.

## ACs covered

ATTACK-1.1, ATTACK-2.1, ATTACK-2.5, ATTACK-3.1, ATTACK-8.1, ATTACK-17.1, ATTACK-17.2, ATTACK-19.1

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
