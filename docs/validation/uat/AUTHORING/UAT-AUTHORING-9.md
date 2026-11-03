# UAT-AUTHORING-9: Reusable effects, grants and modifiers on a System

Reusable effects, grants and modifiers on a System.

Level 1 (Single-user basics) · Feature AUTHORING · Mode: Solo (GM) · Path position 32 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the SRD System with its Reusable definitions list; the GM account can create System definitions there (if no create control is shown to the GM, stop and report it).

## Accounts and windows

- **Roles used:** GM
- **Windows:** One browser window, signed in as GM with the account from your set. Your normal browser is fine.

## Steps

1. **GM:** Open `<STAGING_URL>/systems` and the SRD System, then find **Reusable definitions**.
2. **GM:** Page through the list with **Next definitions page** and **Previous definitions page**; use **Definition family** to see the seven families.
3. **GM:** Under **Create reusable definition**, choose one family, enter a **Label** and a description, and create it.
4. **GM:** Edit its **Reusable definition document**, save, and reload.
5. **GM:** Open the same definition in a second browser tab, change the label there and save.
6. **GM:** In the first tab (still on the older version), try to save and publish.
7. **GM:** Reload the first tab and publish.

## Expected

- Step 2: all seven families exist and the list pages without repeats; compiler-generated Effect actions are not listed.
- Step 3-4: the new definition is an owner-private draft with one current publication; your local edits are kept if the list refreshes in the background.
- Step 6: the stale save/publish is refused with a message about a newer version; nothing is overwritten.
- Step 7: after reload the newer content appears and publishing succeeds.

## Cross-role check

Owner follow-up, run after the tester finishes, from the same set's P1 profile (not part of the tester's run):

- **P1:** After step 4, open the SRD System's **Reusable definitions** list: the GM's draft definition is not listed.

## ACs covered

AUTHORING-11.1, AUTHORING-11.2, AUTHORING-11.3, AUTHORING-11.4

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
