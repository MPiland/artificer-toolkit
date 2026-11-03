# UAT-SPELLS-4: Area caster cannot see a hidden creature

Area caster cannot see a hidden creature.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1) · Path position 156 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Mark a Goblin token hidden (its token menu).

1. **GM:** Add a Goblin token and mark it hidden so players are not sent it.
2. **GM:** Place it inside an area Sage will fireball, with two visible Goblins.
3. **P1:** Cast Fireball over all three.
4. **GM:** Answer all save prompts; give the hidden Goblin a failed save first time.
5. **P1:** Read the results. Confirm the hidden Goblin appears only if it failed its save.
6. **GM:** Undo, and repeat with the hidden Goblin succeeding. Confirm P1 sees nothing about it.

## Expected

- The GM sees every target and roll.
- The caster sees the hidden creature only on a failed save, and nothing on a success; no token for it ever appears on P1's map.

## Other users see

- **P1:** As above; the save prompt for the hidden Goblin goes to the GM only.

## ACs covered

SPELLS-7.3

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
