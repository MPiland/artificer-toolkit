# UAT-PLATFORM-5: A Concentration save shows its result on the roll card

A Concentration save shows its result on the roll card.

Level 4 (Advanced play) · Feature PLATFORM · Mode: Group (GM, P1) · Path position 165 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1's Active Character in The Campaign is Ember, who has Shield and Hold Person. She is benched in The Campaign from [UAT-REACTION-1](../REACTION/UAT-REACTION-1.md); P1 marks her active between Encounters, before the Encounter below starts (the party's wizard joins for this arc).
- An Encounter is running in The Campaign in Assisted mode with a Wolf, a Goblin and Ember ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5).
- Done in [UAT-SPELLS-7](../SPELLS/UAT-SPELLS-7.md): steps 1 to 7 are finished: Sage holds Concentration on Hold Person and the Wolf has bitten Sage.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** After the Wolf's bite in [UAT-SPELLS-7](../SPELLS/UAT-SPELLS-7.md) step 7, open the chat and find the Concentration save roll card for Sage.
2. [ ] **P1:** Open the chat in P1's window and find the same card.
3. [ ] **GM:** Read the card: the DC, the d20 and total, and the result wording.
4. [ ] **P1:** Compare with the Encounter history entry for the bite and the save.
5. [ ] **GM:** Reload the tabletop and find the card again.

## Expected

- The card shows the DC (10 or half the damage, whichever is higher), the roll and total, and a single clear result (passed or failed), consistent with whether Hold Person ended.
- The Encounter history entry for the save shows the same result; no second, conflicting result label appears.
- After the reload the card and history show the same result.

## Other users see

- **P1:** The same card and result as the GM; no private GM rolls.

## ACs covered

PLATFORM-15.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
