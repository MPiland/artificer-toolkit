# UAT-SPELLS-5: Cones, lines, Self cubes and aiming on the map

Cones, lines, Self cubes and aiming on the map.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2) · Path position 157 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Place the Wolf adjacent to Sage and Goblins in a line 3 and 5 squares away. **Everyone:** Take a Long Rest on the Sheet first if the scenario needs spare slots, and clear old grants and conditions from earlier scenarios.

1. **P1:** Choose **Burning Hands**. Press on Sage's token, drag toward the Goblins and release. Confirm a cone is drawn from where you pressed in the direction you dragged and that the list shows the creatures inside it.
2. **P1:** Cast it. **GM:** answer the saves. Confirm damage per creature as in scenario 3.
3. **GM:** Undo. **P1:** Choose **Lightning Bolt**. Drag a line through two Goblins. Confirm the line catches the two it crosses.
4. **P1:** Choose **Thunderwave** and pick which side of Sage's space the cube extends from. Confirm it snaps to the grid on that side, centered along that side. Pick each of the four sides and confirm each snap.
5. **P1:** Confirm Sage is never in her own Thunderwave list.
6. **P1:** Try to pick a single point for Burning Hands (a click with no drag). Confirm it is refused with a message about needing a direction.
7. **P1:** Try to drag a direction for Fireball. Confirm a different refusal message about needing a point.
8. **GM:** Add a **Magma Mephit** next to two Goblins and reduce it to 0 HP so its Death Burst (a 5-foot area centered on itself) triggers. Confirm every creature whose token overlaps that area is caught except the Mephit, and each gets its own save (the printed DC is 11). Doubt: Death Burst's exact area wording and whether it triggers from a hand-set 0 HP or only from damage; if not, hit it with damage instead.

## Expected

- The shape you drag is exactly the shape committed. Cones and lines catch every creature inside. A Self cube never catches the caster.
- A point given to a directed area, or a direction to a point area, gets its own refusal.

## Other users see

- **P2:** Sees the resolved damage cards after the casting but not the aiming drag preview.

## ACs covered

SPELLS-13.1, SPELLS-13.2, SPELLS-22.1, SPELLS-23.1, SPELLS-23.2

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
