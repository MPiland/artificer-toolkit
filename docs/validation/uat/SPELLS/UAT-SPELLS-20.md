# UAT-SPELLS-20: Multi-target spells and teleports

Multi-target spells and teleports.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2, P3) · Path position 173 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).
- Done in [UAT-SPELLS-19](UAT-SPELLS-19.md): P3 plays Moss (Druid 9) in the arena.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** Cast **Magic Missile** choosing the same Goblin for two darts and another for one. Confirm each dart is its own damage instance.
2. **P1:** Cast **Scorching Ray** with a different target mix. Confirm per-ray attack rolls.
3. Eldritch Blast needs a Warlock, which no shared Character is; its beam split and level scaling are checked in [UAT-SPELLS-27](UAT-SPELLS-27.md) step 9. Continue here.
4. **P1:** Cast a multi-target spell with per-creature saves such as Hold Person at a higher slot (3rd level or above). Confirm one save per creature, each answered by the GM for the creatures.
5. **P1:** Cast **Misty Step**. Click a free square within range. Confirm the token teleports with no path and no opportunity attacks.
6. **P1:** Cast **Dimension Door** and teleport. Confirm it too.
7. **P1:** Try a second teleport move without casting. Confirm it is refused.
8. **GM:** Undo the cast. Confirm the position returns.
9. **P2:** Hale casts **Word of Recall** and **Plane Shift** (Plane Shift is a 7th-level spell, which is why Hale is level 13; its travel half teleports the target). **P3:** Moss casts **Giant Insect**. **P1:** Sage casts **Telepathic Bond**. Confirm each resolves the right outcome (teleport, manifest, link).

## Expected

- Spells that target chosen creatures resolve per target; teleport allowance is bounded and consumed.

## Other users see

- **P3:** Sees the new token position after the teleport, and must NOT see the movement of a hidden creature.
- **P2:** Sees the same token positions.

## ACs covered

SPELLS-26.1, SPELLS-28.1, SPELLS-28.2

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
