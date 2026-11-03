# UAT-BUILDER-4: Removing content a Character uses repairs the Character

Removing content a Character uses repairs the Character.

Level 1 (Single-user basics) · Feature BUILDER · Run order 40 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-AUTHORING-8](../AUTHORING/UAT-AUTHORING-8.md): the Feat "UAT Sharp Eyes" is Active and owned by P1.
- Done in [UAT-AUTHORING-3](../AUTHORING/UAT-AUTHORING-3.md): the Background "UAT Wanderer" is Active and owned by P1.
- Done in [UAT-AUTHORING-7](../AUTHORING/UAT-AUTHORING-7.md): the Equipment item "UAT Blade" is Active and owned by P1.

## Accounts and windows

- **Accounts:** P1
- **Windows:** One browser window signed in as the account above.

## Steps

S1. **P1:** Build a Character named "UAT Reconcile" as in [BUILDER-1](../BUILDER/UAT-BUILDER-1.md) steps 1 to 10, choosing the Feat "UAT Sharp Eyes", the Background "UAT Wanderer" and the Equipment item "UAT Blade". Activate it, take some damage so hit points are below maximum, and add a custom note to the inventory.

1. **P1:** Open "UAT Reconcile" on the Sheet and note the Feat's effect, the current hit points, the inventory and the URL.
2. **P1:** Open "UAT Sharp Eyes", edit a detail and **Activate** a new version (a replacement).
3. **P1:** Reopen "UAT Reconcile"'s Sheet and the Builder preview.
4. **P1:** Delete "UAT Sharp Eyes" from the Feat page.
5. **P1:** Open the Character list and the Sheet.
6. **P1:** Open the Character in the Builder and read the preview before changing anything.
7. **P1:** Choose **Activate** on the repaired Character.
8. **P1:** Open the Sheet again, then do the same with the Background and the Equipment (delete each, preview, activate).

## Expected

- Step 3: the Character still works; the Sheet's URL, name, hit points and inventory are unchanged after the replacement.
- Step 5: the Character is marked as needing repair and the Sheet blocks play with a message that it needs repair.
- Step 6: the preview removes only the invalid grant (the missing Feat); everything else is kept.
- Step 7-8: committing returns the Character to Active; hit points (still damaged), the custom inventory note and the identity are unchanged. The Feat's effect, and later the Background's and Equipment's contributions, are gone from the Sheet; unrelated choices remain.

## Other users see

- Not applicable: "UAT Reconcile" is in no Campaign, so no other account is involved. (Repair of a Character that is in a Campaign is [UAT-BUILDER-5](UAT-BUILDER-5.md).)

## ACs covered

BUILDER-3.1, BUILDER-3.2, BUILDER-3.3, AUTHORING-3.3, AUTHORING-7.2, AUTHORING-6.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
