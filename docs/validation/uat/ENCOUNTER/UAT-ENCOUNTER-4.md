# UAT-ENCOUNTER-4: Controllers, dispositions and removing a member

Controllers, dispositions and removing a member.

Level 4 (Advanced play) · Feature ENCOUNTER · Run order 138 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.
- Done in [UAT-ENCOUNTER-3](UAT-ENCOUNTER-3.md): the Sandbox Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.

## Accounts and windows

- **Accounts:** GM, P1, P2, P3
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. For steps 7 and 8: **GM:** In the Sandbox Campaign, with "UAT Cavern" presented, create and start a new Run from the Wolf and Goblin Blueprint as in [ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5 (complete any Run still running first). Do not start it; leave it Prepared.

1. **GM:** Open the Encounter drawer. For the Goblin, open **Controllers** and add P1 as a controller (the companion/granted-creature case).
2. **P1:** On the Goblin's turn, act for it. Confirm you can resolve its action and end its turn.
3. **P2:** Try to act for the Goblin. Read the refusal.
4. **GM:** Remove P1 from the Goblin's **Controllers**. Confirm P1 can no longer act for it.
5. **GM:** Open Aria's controllers. Confirm P1 is listed and cannot be removed (a Character's assigned player always controls it).
6. **GM:** Change the Wolf's disposition to Friendly, then Neutral, then back to Hostile. Confirm the token ring colour changes each time (Friendly blue, Hostile red; note the Neutral colour).
7. **GM:** In the Sandbox, before starting the Prepared Run, remove P3's Character from the Campaign's active Characters. Start. Confirm that Character is not in the order.
8. **GM:** Remove P3 as a Sandbox member. Confirm P3 drops from every controller list and the P3 window is removed from the live table.
   R1. **GM:** Re-seat P3 if step 8 removed them, as in [CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md).

## Expected

- Only the GM and a listed controller can act for an actor; others are refused with a message that they do not control it.
- Disposition defaults: Characters Friendly (blue ring), creatures Hostile (red ring); GM edits change the ring colour. The Encounter drawer lists Aria, Bryn and Cade as Friendly and the Wolf and Goblin as Hostile before step 6.
- Removing a member removes them from every controller list.

## Other users see

- **P2:** Sees the ring colour changes live and cannot act for a creature they do not control; sees no controller changes for Characters that are not theirs beyond what the Party shows.
- **P3 (after step 8):** Is removed from the room and gets an access message on reload.

## ACs covered

ENCOUNTER-3.3, ENCOUNTER-3.4, ENCOUNTER-3.5, ENCOUNTER-3.6, ENCOUNTER-3.7

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
