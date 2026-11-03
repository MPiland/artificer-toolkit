# UAT-SPELLS-21: Invisibility, Sanctuary, Fear and Blindness

Invisibility, Sanctuary, Fear and Blindness.

Level 4 (Advanced play) · Feature SPELLS · Run order 170 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Accounts:** GM, P1, P2, P3
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Add a Goblin; Sage needs Invisibility, Charm Person, Fear and Blindness/Deafness prepared. Draw a wall with the wall tool for step 6.

1. **P1:** Cast Invisibility on Sage. Make an attack roll. Confirm the Invisibility ends. Undo the attack: confirm it returns.
2. **P1:** Recast and cast a spell instead: confirm it ends.
3. **P2:** Hale casts **Sanctuary** on Sage; have **P1** attack an enemy with Sage. Confirm Sanctuary ends when Sage attacks. Recast it and have Sage cast an offensive spell at an enemy: confirm it ends the same way.
4. **P1:** Cast **Charm Person** on the Goblin and fail its save. **P2:** Have Hale (a companion) hit the Goblin. Confirm the charm ends because the caster's companion harmed the target. Undo the hit and confirm the charm returns.
5. **P1:** Cast **Fear** on the Goblin. Fail its save. Confirm Frightened records Sage as the source.
6. **GM:** Move the Goblin so it loses line of sight to Sage, then have it attack. Confirm disadvantage only while it can see her (Heavy setup: a wall drawn by hand to break the line of sight).
7. **GM:** Move the Goblin closer to Sage. Confirm a soft warning that you can override.
8. **GM:** Start the Goblin's turn. Confirm the GM is told it must Dash and move away; do something else and confirm a "Do it anyway" warning logged for the GM.
9. **GM:** End the Goblin's turn without line of sight. Confirm it is offered a Wisdom save; success ends the effect for it only. Undo.
10. **P1:** Cast **Blindness/Deafness** on a Goblin choosing Blinded. Confirm the condition on a failed save with a repeat save at the end of each of its turns. Recast it with a 3rd-level slot and confirm an extra target can be chosen.
11. **GM:** Apply Frightened to the Goblin by hand, with no source. Confirm its attacks always roll with disadvantage, whether or not it can see anyone.

## Expected

- Authored end events fire from one consumer; Frightened follows its source.

## Other users see

- **P2:** Sees Frightened and Blinded badges but must NOT see the Goblin's private roll.
- **P3:** Same.

## ACs covered

SPELLS-27.1, SPELLS-27.2, SPELLS-29.1, SPELLS-29.2, SPELLS-30.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
