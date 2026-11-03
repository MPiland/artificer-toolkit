# UAT-RELIABILITY-5: Forms and sign-out recover without silent data loss

Forms and sign-out recover without silent data loss.

Level 5 (Reliability, performance and release) · Feature RELIABILITY · Mode: Group (GM, P1) · Path position 181 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Open `/spells` and start a new Spell. Leave the name empty, fill in whatever else is required, and try to save.
2. **GM:** Give the Spell the name "Reliability Probe" and save it.
3. **GM:** Open the Spell's edit page in two browser tabs, A and B.
4. **GM (tab A):** Start typing a sentence into the description but do not save.
5. **GM (tab B):** Change the Spell's name and save.
6. **GM (tab A):** Read what the page shows, then continue typing.
7. **P1:** Open Aria's Sheet, go to the Extras area and click the Creature select. Type the first letters of a creature name.
8. **P1:** Keep typing and watch whether the typed letters stay.
9. **P1:** Set the browser to Offline, then choose sign out from the account menu.
10. **P1:** Read the page. Set the browser back to No throttling and use the retry control offered.
    R1. **GM:** Delete the "Reliability Probe" Spell. **P1:** Sign back in if step 9 signed you out.

## Expected

- Step 1: the save is refused with an error on the name field; no Spell called "Untitled Spell" is created.
- Step 2: the Spell is created under the typed name.
- Step 6: tab A keeps what you typed in step 4 and tells you the name changed elsewhere, rather than silently replacing your text.
- Step 8: the letters you type in the Creature select stay; the field does not reset on every keystroke.
- Step 10: the page says sign-out failed (it does not say "Signing you out..." forever) and offers a retry; after going back online, retry signs you out.

## Other users see

- Not applicable: single user.

## ACs covered

RELIABILITY-8.3, RELIABILITY-9.1, RELIABILITY-9.6, RELIABILITY-21.14

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
