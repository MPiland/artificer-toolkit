# UAT-RULES-1: Authoring forms show, hide and require fields as choices change

Authoring forms show, hide and require fields as choices change.

Level 1 (Single-user basics) · Feature RULES · Mode: Solo (P1) · Path position 37 of 188

## Prerequisites

- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser window, signed in as P1 with the account from your set. Your normal browser is fine.
- **Settings:** **Authoring experience** in Settings, Preferences is **Guided**.

## Steps

1. **P1:** Open `<STAGING_URL>/spells/new`.
2. **P1:** Note which fields are shown. Change the Spell's level from a leveled Spell to a cantrip and note which fields appear or disappear.
3. **P1:** Change it back. Check whether any field you had filled in earlier has been cleared.
4. **P1:** Choose a field whose answer reveals more fields (for example the kind of duration, casting time or targeting). Pick each option in turn and note the new fields.
5. **P1:** Leave a newly revealed required field empty and try to **Activate**.
6. **P1:** Fill in the revealed field, then switch back to the option that hides it.
7. **P1:** Switch to the option again and check the field's value.
8. **P1:** Open `<STAGING_URL>/creatures/new` and repeat steps 4-7 on one choice that reveals a group (for example adding an attack or a trait).
9. **P1:** Discard both drafts.

## Expected

- Fields appear and disappear immediately as the choice changes; no stale fields remain on screen.
- A field that is required only for one choice is marked required only while that choice is selected.
- Step 5: publishing is refused with a message naming the missing field and the step it is on.
- Step 6-7: a field hidden by your choice has its value cleared; it is empty when it reappears.
- Required rules, options and labels are the same after reload of the saved draft.

## Other users see

- Not applicable: single user.

## ACs covered

RULES-1.1

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
