# UAT-SHEET-6: Equipment, inventory, attunement and deleting an item

Equipment, inventory, attunement and deleting an item.

Level 1 (Single-user basics) · Feature SHEET · Run order 45 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md): "UAT Dara" is committed and in no Campaign.
- Done in [UAT-AUTHORING-7](../AUTHORING/UAT-AUTHORING-7.md): "UAT Blade", an Active homebrew weapon with a damage action, is owned by P1.

## Accounts and windows

- **Accounts:** P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1:** On UAT Dara's Sheet open the inventory section and add the homebrew item.
2. **P1:** Equip it. Check the actions list and any bonus it grants.
3. **P1:** Unequip it, then equip it again.
4. **P1:** Try to attune the item if it allows attunement; note the attunement slot count.
5. **P1:** Move some currency between types using **Amount to move** and **Currency type to move**.
6. **P1:** Go to Equipment, delete the homebrew item (confirm any prompt), and return to UAT Dara's Sheet.
7. **P2:** Copy the address of UAT Dara's Sheet from P1's browser and open it in P2's window.

## Expected

- Equipping adds the item's action or bonus; unequipping removes it. Attunement uses a slot and is refused beyond the limit.
- Currency totals stay consistent (the amount moved leaves one type and arrives in the other).
- After step 6 the item is gone from the inventory and its action, bonus and charges are gone from the Sheet; unrelated items and bonuses remain.
- Step 7: P2 cannot open UAT Dara's Sheet (she is in no Campaign); P2 sees a refusal or not-found page, not P1's data.

## Other users see

- **P2:** must NOT see UAT Dara's inventory, currency or notes at any point in this scenario.

## ACs covered

SHEET-4.2, SHEET-4.3, SHEET-4.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
