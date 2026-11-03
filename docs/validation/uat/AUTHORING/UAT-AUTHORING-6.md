# UAT-AUTHORING-6: Creature copy, computed AC and the item loadout

Creature copy, computed AC and the item loadout.

Level 3 (Core play) · Feature AUTHORING · Run order 88 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Done in [UAT-AUTHORING-4](UAT-AUTHORING-4.md): P1 owns the Active Spell "UAT Ember Dart".

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **GM:** Open the SRD Wolf at http://localhost:3000/creatures and read its Armor Class and any natural armor line.
2. **GM:** Open the SRD Goblin and read its Armor Class and its loadout (main hand, off hand, carried, worn).
3. **GM:** Choose **Duplicate to edit** on the Goblin and name the copy "UAT Goblin".
4. **GM:** In the loadout, put a two-handed weapon in the main hand and try to also place a shield in the off hand.
5. **GM:** Replace the weapon with a one-handed weapon and keep the shield. Note the computed AC.
6. **GM:** Remove the shield. Note the AC.
7. **GM:** Set a +1 shield and note the AC again.
8. **GM:** Look for any field that sets a fixed Armor Class or an AC note.
9. **GM:** Choose **Save Draft** and **Activate**, then add UAT Goblin to an Encounter of Review: Party in the Field (see Preconditions).
10. **GM:** In that Encounter, change the instance's shield and watch its AC.

## Expected

- Wolf shows AC 13 (10 + 2 Dex + 1 natural). Goblin shows 15 (leather armor, shield), matching its stat block.
- Step 4: the form refuses or clears the off hand when a two-handed weapon is in the main hand.
- Step 5-7: the AC recomputes from what is worn and held: no shield lowers it by 2; the +1 shield raises it by 1 over a plain shield.
- Step 8: there is no free-text AC field; AC is computed.
- Step 9: the Encounter creature copies the authored loadout.
- Step 10: changing or removing the instance's shield changes only that instance's AC, not the authored UAT Goblin.

## Other users see

- **P1:** In the live table the instance's AC shows the changed value after step 10.

## ACs covered

AUTHORING-5.1, AUTHORING-17.1, AUTHORING-17.2, AUTHORING-17.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
