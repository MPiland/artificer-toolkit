# UAT-ENCOUNTER-4: Controllers, dispositions and removing a member

Controllers, dispositions and removing a member.

Level 4 (Advanced play) · Feature ENCOUNTER · Mode: Group (GM, P1, P2, P3) · Path position 143 of 191

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- The account **P2** exists and is seated as a player in The Campaign.
- The account **P3** exists and is seated as a player in The Campaign.
- **The Campaign** is running: P1, P2 and P3 are seated with Campaign Characters Aria, Bryn and Cade (Level 1 Fighters, each built by their own player in the Character Builder), a presented Scene with a Wolf token and a Goblin token, Assisted mode with the Speed Factor initiative, and an Encounter started and in round 2 (built in the CAMPAIGN, SCENE and ENCOUNTER scenarios).
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in The Campaign with their Characters.
- Done in [UAT-ENCOUNTER-3](UAT-ENCOUNTER-3.md): The Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. For steps 7 and 8: **GM:** In The Campaign, with "UAT Cavern" presented, create and start a new Run from the Wolf and Goblin Blueprint as in [ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5 (complete any Run still running first). Do not start it; leave it Prepared.

1. [ ] **GM:** Open the Encounter drawer. For the Goblin, open **Controllers** and add P1 as a controller (the companion/granted-creature case).
2. [ ] **P1:** On the Goblin's turn, act for it. Confirm you can resolve its action and end its turn.
3. [ ] **P2:** Try to act for the Goblin. Read the refusal.
4. [ ] **GM:** Remove P1 from the Goblin's **Controllers**. Confirm P1 can no longer act for it.
5. [ ] **GM:** Open Aria's controllers. Confirm P1 is listed and cannot be removed (a Character's assigned player always controls it).
6. [ ] **GM:** Change the Wolf's disposition to Friendly, then Neutral, then back to Hostile. Confirm the token ring colour changes each time (Friendly blue, Hostile red; note the Neutral colour).
7. [ ] **GM:** In The Campaign, before starting the Prepared Run, remove P3's Character from the Campaign's active Characters. Start. Confirm that Character is not in the order.
8. [ ] **GM:** Remove P3 from The Campaign. Confirm P3 drops from every controller list and the P3 window is removed from the live table.
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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
