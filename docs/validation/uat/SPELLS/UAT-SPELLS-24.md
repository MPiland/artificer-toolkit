# UAT-SPELLS-24: Privacy and permissions refusals

Privacy and permissions refusals.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2, P3) · Path position 177 of 190

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

1. **P1:** Cast **Fireball** at the Goblin and the Wolf (with **GM**'s Auto-roll OFF). Confirm the action pauses on the creatures' saves for the **GM**, not for P1. **GM:** Turn Auto-roll ON, repeat the cast, and confirm the saves are rolled and the action continues with no pause.
2. **P2:** While a save prompt is open for Sage, try to answer Sage's prompt on P2's screen. Confirm it is refused or not offered.
3. **P3:** Try to answer a pending prompt for a Goblin. Confirm it is refused or not offered.
4. **GM:** Make a roll Private. **P1:** Confirm P1 cannot see it. Use **Show roll** and **Show that I rolled** once each and confirm the roll then becomes visible.
5. **P3:** Look for an Undo last action control. Confirm only the GM has it.
6. **P2:** Try to remove a creature from a pending area. Confirm refused.

## Expected

- A roll is answered only by the controller or the GM; private rolls stay private until revealed.
- In Assisted mode the creature's save for a player's spell pauses for the GM unless the GM's Auto-roll is ON.

## Other users see

- **P1:** Sees only public cards; must NOT see the GM's Private roll until revealed.
- **P3:** Same.

## ACs covered

SPELLS-1.1, SPELLS-1.2

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
