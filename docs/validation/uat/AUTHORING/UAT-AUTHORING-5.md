# UAT-AUTHORING-5: Author a Class and see the Spell guard

Author a Class and see the Spell guard.

Level 1 (Single-user basics) · Feature AUTHORING · Mode: Solo (P1) · Path position 24 of 195

## Prerequisites

- The account **P1** exists (a free account).
- Done in [UAT-AUTHORING-4](UAT-AUTHORING-4.md): the Spell "UAT Ember Dart" is Active and lists a Class.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open `<STAGING_URL>/classes/new`.
2. [ ] **P1:** Name it "UAT Ember Mage", fill the required fields and choose **Save Draft**, then **Activate**.
3. [ ] **P1:** Open "UAT Ember Dart", add "UAT Ember Mage" to its Classes, save the draft and **Activate** again.
4. [ ] **P1:** Open the Class list and open "UAT Ember Mage".
5. [ ] **P1:** Try to delete "UAT Ember Mage".
6. [ ] **P1:** Remove the Class from the Spell, activate the Spell, then delete the Class again.
7. [ ] **P1:** Make a draft copy of the Class ("Duplicate") and choose **Discard draft**.

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
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
