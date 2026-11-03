# UAT-PLATFORM-5: A Concentration save shows its result on the roll card

A Concentration save shows its result on the roll card.

Level 4 (Advanced play) · Feature PLATFORM · Mode: Group (GM, P1) · Path position 158 of 188

## Prerequisites

- The review data provides the Campaign **Review: Shield and Hold** (owner GM; member P1 with Ember, who has Shield and Hold Person; a Wolf and a Goblin; Assisted mode; the review Encounter started with the Goblin held by Ember's Hold Person and Ember's Shield reaction already used this round).
- Done in [UAT-SPELLS-7](../SPELLS/UAT-SPELLS-7.md): steps 1 to 7 are finished: Sage holds Concentration on Hold Person and the Wolf has bitten Sage.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** After the Wolf's bite in [UAT-SPELLS-7](../SPELLS/UAT-SPELLS-7.md) step 7, open the chat and find the Concentration save roll card for Sage.
2. **P1:** Open the chat in P1's window and find the same card.
3. **GM:** Read the card: the DC, the d20 and total, and the result wording.
4. **P1:** Compare with the Encounter history entry for the bite and the save.
5. **GM:** Reload the tabletop and find the card again.

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
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
