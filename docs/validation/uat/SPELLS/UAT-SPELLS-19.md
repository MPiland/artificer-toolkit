# UAT-SPELLS-19: Zones, auras and lasting hazards

Zones, auras and lasting hazards.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2, P3) · Path position 172 of 190

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

S1. **GM:** Complete the Encounter. **P3:** Use **Change Character** to swap Vex for Moss. **GM:** Rebuild the arena as in [SPELLS-2](../SPELLS/UAT-SPELLS-2.md) steps 4 and 5.
S2. Hale has Spirit Guardians and Blade Barrier; Moss has Spike Growth, Moonbeam and Entangle; Sage has Caltrops (bag of 20), Oil (flask) and Hunting Trap. Remove old grants first.

1. **P2:** Hale casts **Spirit Guardians**. Confirm an aura circle drawn on the map centered on her and that it moves when she moves.
2. **GM:** Move a Goblin in; confirm it saves on entry and at the start of its turn. Park a creature with only its edge or a corner touching the circle and confirm it is not affected.
3. **P3:** Moss casts **Moonbeam**, **Spike Growth** and **Entangle** (one at a time, using Undo placement between). Confirm each places a zone and resolves its entry and turn rules.
4. **P2:** Cast **Blade Barrier**, choosing the wall shape. Confirm a zone with save, damage, cover and difficult terrain.
5. **P1:** Sage uses the **Caltrops (bag of 20)** item from her equipment in the Encounter. Confirm the field appears on the map.
6. **GM:** Move a Goblin so it ends its move inside the field: confirm a DC 15 Dexterity save, and on a failure its movement stops, it takes 1 piercing damage, and its speed is down 10 feet.
7. **GM:** Move another Goblin that only passes through the field. Confirm the save is made on entering and that it stops in the field on a failure.
8. **GM:** Raise the slowed Goblin's hit points by any amount using the token's HP control. Confirm its speed returns; Undo the heal and confirm the speed reduction returns. Then repeat the heal as **P3**: move Moss (reduce her hit points first with the GM) into the field, fail the save, and heal Moss from her own Sheet; confirm the slow ends.
9. **GM:** Give the Goblin resistance to piercing damage, make it fail the save again, and confirm no piercing damage is dealt but the slow still applies.
10. **P1:** Drag Sage's token across a visible half-speed field. Confirm a choice between careful and normal movement and that the chosen move commits.
11. **P1:** Use the **Oil (flask)** and the **Hunting Trap** items. **GM:** Move a creature through each and confirm each triggers on pass-through, as Blade Barrier did in step 4 (these three are the zones SPELLS-17.5 names).

## Expected

- Zones catch by positive-area overlap; touching an edge or corner does not trigger it.

## Other users see

- **P2:** Sees the zones and aura radius from sources they are allowed to see; must NOT see a hidden creature's zone.
- **P3:** Same.

## ACs covered

SPELLS-4.2, SPELLS-17.1, SPELLS-17.2, SPELLS-17.3, SPELLS-17.4, SPELLS-17.5, SPELLS-20.1, SPELLS-24.1, SPELLS-30.1

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
