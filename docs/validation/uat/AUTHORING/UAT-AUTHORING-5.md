# UAT-AUTHORING-5: Author a Class and see the Spell guard

Author a Class and see the Spell guard.

Level 1 (Single-user basics) · Feature AUTHORING · Mode: Solo (P1) · Path position 31 of 190

## Prerequisites

- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-AUTHORING-4](UAT-AUTHORING-4.md): the Spell "UAT Ember Dart" is Active and lists a Class.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser window, signed in as P1 with the account from your set. Your normal browser is fine.

## Steps

1. **P1:** Open `<STAGING_URL>/classes/new`.
2. **P1:** Name it "UAT Ember Mage", fill the required fields and choose **Save Draft**, then **Activate**.
3. **P1:** Open "UAT Ember Dart", add "UAT Ember Mage" to its Classes, save the draft and **Activate** again.
4. **P1:** Open the Class list and open "UAT Ember Mage".
5. **P1:** Try to delete "UAT Ember Mage".
6. **P1:** Remove the Class from the Spell, activate the Spell, then delete the Class again.
7. **P1:** Make a draft copy of the Class ("Duplicate") and choose **Discard draft**.

## Expected

- Step 2-4: the Class is active, appears in the Class list, and is selectable on the Spell and in the Spell Class filter.
- Step 5: deletion is refused with a message naming that the Spell still refers to it; the Class stays.
- Step 6: with the reference removed, deletion succeeds and the Class disappears from the list and the Spell filter.
- Step 7: a copy opens as a draft and discards cleanly.

## Other users see

- Not applicable: single user.

## ACs covered

AUTHORING-4.3, AUTHORING-4.4, AUTHORING-4.1

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
