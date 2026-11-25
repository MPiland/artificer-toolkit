# UAT-SHEET-8: Hands, two-handed weapons and shields

Hands, two-handed weapons and shields.

Level 1 (Single-user basics) · Feature SHEET · Mode: Solo (P1) · Path position 44 of 195

## Prerequisites

- The account **P1** exists.
- Done in [UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md): Aria is committed and in no Campaign.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** On Aria's Sheet open Equipment and equip the first one-handed weapon.
2. [ ] **P1:** Equip the second one-handed weapon.
3. [ ] **P1:** Note the Armor Class, then equip the shield.
4. [ ] **P1:** Equip a third item and observe what happens.
5. [ ] **P1:** Swap the main-hand and off-hand items.
6. [ ] **P1:** Unequip the item in the main hand.
7. [ ] **P1:** Equip the two-handed weapon.
8. [ ] **P1:** Equip a second shield (if you have one) and compare Armor Class.

## Expected

- Step 1 puts the weapon in the main hand; step 2 puts the second in the off hand.
- Each hand holds at most one item; with both hands full the app does not silently drop one.
- A shield counts toward Armor Class only while held in a hand, and only one shield counts even if two are held.
- Swap exchanges the two hands. Emptying the main hand moves an off-hand weapon into the main hand; an off-hand shield stays in the off hand.
- A two-handed weapon takes the main hand and blocks the off hand.

## Other users see

- Not applicable: single user.

## ACs covered

SHEET-8.1, SHEET-8.2, SHEET-8.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
