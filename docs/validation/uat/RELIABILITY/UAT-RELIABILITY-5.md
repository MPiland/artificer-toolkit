# UAT-RELIABILITY-5: Forms and sign-out recover without silent data loss

Forms and sign-out recover without silent data loss.

Level 5 (Reliability, performance and release) · Feature RELIABILITY · Mode: Group (GM, P1) · Path position 186 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open `/spells` and start a new Spell. Leave the name empty, fill in whatever else is required, and try to save.
2. [ ] **GM:** Give the Spell the name "Reliability Probe" and save it.
3. [ ] **GM:** Open the Spell's edit page in two browser tabs, A and B.
4. [ ] **GM (tab A):** Start typing a sentence into the description but do not save.
5. [ ] **GM (tab B):** Change the Spell's name and save.
6. [ ] **GM (tab A):** Read what the page shows, then continue typing.
7. [ ] **P1:** Open Aria's Sheet, go to the Extras area and click the Creature select. Type the first letters of a creature name.
8. [ ] **P1:** Keep typing and watch whether the typed letters stay.
9. [ ] **P1:** Set the browser to Offline, then choose sign out from the account menu.
10. [ ] **P1:** Read the page. Set the browser back to No throttling and use the retry control offered.
        R1. **GM:** Delete the "Reliability Probe" Spell. **P1:** Sign back in if step 9 signed you out.

## Expected

- Step 1: the save is refused with an error on the name field; no Spell called "Untitled Spell" is created.
- Step 2: the Spell is created under the typed name.
- Step 6: tab A keeps what you typed in step 4 and tells you the name changed elsewhere, rather than silently replacing your text.
- Step 8: the letters you type in the Creature select stay; the field does not reset on every keystroke.
- Step 10: the page says sign-out failed (it does not say "Signing you out..." forever) and offers a retry; after going back online, retry signs you out.

## Other users see

- Not applicable: one person acts in this scenario.

## ACs covered

RELIABILITY-8.3, RELIABILITY-9.1, RELIABILITY-9.6, RELIABILITY-21.14

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
