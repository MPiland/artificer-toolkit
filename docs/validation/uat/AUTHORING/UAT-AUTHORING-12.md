# UAT-AUTHORING-12: Option descriptions and adding a Check and a DC

Option descriptions and adding a Check and a DC.

Level 1 (Single-user basics) · Feature AUTHORING · Run order 31 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Accounts:** P1
- **Windows:** One browser window signed in as the account above.
- **Settings:** **Authoring experience** is **Advanced** for step 4 (change it in Settings, Preferences).

## Steps

1. **P1:** Open http://localhost:3000/creatures/new and find a field with System options such as speeds, senses, damage types, skills or abilities.
2. **P1:** Hover (or focus) several options in the dropdown and read the tooltip.
3. **P1:** Do the same for damage types and for proficiencies on a new Spell or Class.
4. **P1:** In the Spell editor, open the mechanics/effects section and add an invocation **Check**; then add a **DC** to that Check.
5. **P1:** Save the draft and reload.
6. **P1:** Discard the draft.

## Expected

- Step 2-3: each System option shows a tooltip with the description of that option (not blank, not a raw code).
- Step 4: adding a Check and a DC each creates a filled-in default row ready to edit, without an error.
- Step 5: the added rows survive the reload.

## Other users see

- Not applicable: single user.

## ACs covered

AUTHORING-18.1, AUTHORING-19.1, AUTHORING-20.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
