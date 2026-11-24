# UAT-SPELLS-4: Area caster cannot see a hidden creature

Area caster cannot see a hidden creature.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1) · Path position 157 of 191

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in The Campaign with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Mark a Goblin token hidden (its token menu).

1. [ ] **GM:** Add a Goblin token and mark it hidden so players are not sent it.
2. [ ] **GM:** Place it inside an area Sage will fireball, with two visible Goblins.
3. [ ] **P1:** Cast Fireball over all three.
4. [ ] **GM:** Answer all save prompts; give the hidden Goblin a failed save first time.
5. [ ] **P1:** Read the results. Confirm the hidden Goblin appears only if it failed its save.
6. [ ] **GM:** Undo, and repeat with the hidden Goblin succeeding. Confirm P1 sees nothing about it.

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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
