# UAT-RELIABILITY-11: Authoring selects, labels and lists

Authoring selects, labels and lists.

Level 5 (Reliability, performance and release) · Feature RELIABILITY · Mode: Group (GM, P1) · Path position 181 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Open `/spells`, start a new Spell, and read whether a System and a School are preselected.
2. **GM:** Fill in everything else and try to save without choosing a School. Read the result.
3. **GM:** Open a new Feature and a new Feat. In each, open the type and charge reset selects and try to clear the choice.
4. **GM:** Compare the charge reset options in the Feature editor and the Feat editor.
5. **GM:** Read the enum values shown in the editors (for example reset timing) for raw text such as LONG_REST.
6. **GM:** Open the Campaign page and note the owner-only controls (edit, archive, transfer, invite).
7. **P1:** Open the same Campaign page and look for the same controls.
8. **GM:** Open the list of all SRD Spells (or Equipment). Scroll to the very bottom and note the last item and the total shown.
9. **GM:** Search for an item that would be on a later page and confirm it is found.
   R1. **GM and P1:** Delete the Spell and Feature drafts you made.

## Expected

- Step 1: the System comes from the route you opened or your selection, and no School is preselected.
- Step 2: the save is refused with a message asking for a School; the Spell is not created with a default School.
- Step 3: neither select can be left blank once chosen; there is no "Trait" or "Long rest" fallback that appears without being chosen.
- Step 4: both editors offer the same charge reset options in the same order.
- Step 5: values read as words ("Long rest"), not raw identifiers.
- Steps 6-7: the GM sees owner-only controls when they are the active owner; P1 sees none of them.
- Steps 8-9: the list shows every item, not only the first page; search finds items from later pages.

## Other users see

- **P1:** Never sees owner-only controls on a Campaign they do not own.

## ACs covered

RELIABILITY-8.2, RELIABILITY-8.4, RELIABILITY-8.7, RELIABILITY-9.2

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
