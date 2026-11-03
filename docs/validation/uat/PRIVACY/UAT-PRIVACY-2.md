# UAT-PRIVACY-2: GM private rolls and monster rolls

GM private rolls and monster rolls.

Level 3 (Core play) · Feature PRIVACY · Run order 96 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Done in [UAT-PRIVACY-1](UAT-PRIVACY-1.md): the Party Encounter has a hidden Goblin token (step 4).

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **GM:** Set the roll switch to **Private**.
2. **GM:** Make the Wolf attack Aria.
3. **GM:** Open chat **Enemy rolls** and **My rolls**.
4. **P1:** Look at the Table chat and the Encounter history.
5. **P2:** Look at the Table chat and the Encounter history.
6. **GM:** Switch the roll switch to **Public** and have the Wolf attack Bryn.
7. **GM:** Make a hidden Goblin ([UAT-PRIVACY-1](UAT-PRIVACY-1.md)) roll with the switch on Public.
8. **P1:** Make a skill roll with **Just me** as the destination.
9. **GM:** Look in chat for P1's Just me roll. **P2:** confirm you also do not see it.

## Expected

- The GM sees the Private roll in **Enemy rolls** and **My rolls**. Players see only the consequences (hit or miss, damage taken), not the dice, total or attack bonus.
- The Public attack shows the roll card to everyone.
- A hidden Goblin's roll is always Private, even when the switch is on Public.
- The GM does not see P1's Just me roll.

## Other users see

- **P1 and P2:** must NOT see the Wolf's Private roll dice, the hidden Goblin's roll, or each other's Just me rolls.
- **GM:** must NOT see P1's Just me roll.

## ACs covered

PRIVACY-1.1, PRIVACY-1.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
