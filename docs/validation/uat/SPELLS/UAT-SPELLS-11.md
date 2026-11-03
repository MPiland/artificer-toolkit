# UAT-SPELLS-11: Stabilizing: Spare the Dying, Healer's Kit and first aid

Stabilizing: Spare the Dying, Healer's Kit and first aid.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2, P3) · Path position 164 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Add a Zombie and a Wolf next to Hale. Sage is the dying target.

1. **GM:** Reduce Sage to 0 HP so she is dying. **P2:** On Hale's turn cast **Spare the Dying** at Sage. Confirm Sage becomes stable with no further death saves.
2. **P2:** Try Spare the Dying at the Zombie. Confirm the undead exclusion warning.
3. **GM:** Damage Sage again. Confirm she is dying again, and Undo restores the stable state with its death saves.
4. **P2:** On a creature that is not dying (the Wolf), use the Healer's Kit. Confirm the overridable warning that the target is not dying and that nothing changes if overridden.
5. **GM:** Make Sage dying. **P2:** Use the Healer's Kit on Sage. Confirm Sage becomes stable.
6. **GM:** Make Sage dying again. **P2:** Use the first aid basic action. Confirm it spends an Action and asks for a DC 10 Wisdom (Medicine) check; success makes Sage stable, failure does not.

## Expected

- Stabilizing is the same result whether by Spare the Dying, the kit or first aid.

## Other users see

- **P1:** Sees Sage's Dying and Stable badge change, and must NOT see Hale's private rolls.
- **P3:** Sees the same badge and Hale's actions on the table.

## ACs covered

SPELLS-8.2, SPELLS-3.5, SPELLS-3.7

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
