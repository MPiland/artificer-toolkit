# UAT-SHEET-6: Equipment, inventory, attunement and deleting an item

Equipment, inventory, attunement and deleting an item.

Level 1 (Single-user basics) · Feature SHEET · Mode: Group (P1, P2) · Path position 42 of 191

## Prerequisites

- The account **P1** exists.
- The account **P2** exists (only tries to open P1's Sheet).
- Done in [UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md): Aria is committed and in no Campaign.
- Done in [UAT-AUTHORING-7](../AUTHORING/UAT-AUTHORING-7.md): "UAT Blade", an Active homebrew weapon with a damage action, is owned by P1.

## Accounts and windows

- **Roles used:** P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** On Aria's Sheet open the inventory section and add the homebrew item.
2. [ ] **P1:** Equip it. Check the actions list and any bonus it grants.
3. [ ] **P1:** Unequip it, then equip it again.
4. [ ] **P1:** Try to attune the item if it allows attunement; note the attunement slot count.
5. [ ] **P1:** Move some currency between types using **Amount to move** and **Currency type to move**.
6. [ ] **P1:** Go to Equipment, delete the homebrew item (confirm any prompt), and return to Aria's Sheet.
7. [ ] **P1:** Send P2 the address of Aria's Sheet. **P2:** Open it.

## Expected

- Equipping adds the item's action or bonus; unequipping removes it. Attunement uses a slot and is refused beyond the limit.
- Currency totals stay consistent (the amount moved leaves one type and arrives in the other).
- After step 6 the item is gone from the inventory and its action, bonus and charges are gone from the Sheet; unrelated items and bonuses remain.
- Step 7: P2 cannot open Aria's Sheet (it is in no Campaign); P2 sees a refusal or not-found page, not P1's data.

## Other users see

- **P2:** must NOT see Aria's inventory, currency or notes at any point in this scenario.

## ACs covered

SHEET-4.2, SHEET-4.3, SHEET-4.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
