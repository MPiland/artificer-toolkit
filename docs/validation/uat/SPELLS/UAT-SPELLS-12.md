# UAT-SPELLS-12: Single-use items and Antitoxin

Single-use items and Antitoxin.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2) · Path position 166 of 191

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in The Campaign with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. Hale carries 2 vials of Antitoxin (Equipment on the Sheet).

1. [ ] **P2:** On Hale's Sheet note the Antitoxin count. In the Encounter use Antitoxin on Sage.
2. [ ] **P2:** Confirm the Sheet shows one fewer vial and an Action was spent.
3. [ ] **GM:** Force Sage to save against a poison effect. Confirm advantage with the reason "Antitoxin (vial)". Force a non-poison save. Confirm no advantage.
4. [ ] **P2:** Try Antitoxin on the Zombie. Confirm an overridable undead warning.
5. [ ] **GM:** Undo the Antitoxin use. Confirm the grant is gone, the Action is back, the vial returns and rolls already made stay on the record.
6. [ ] **P2:** Use the last vial. Confirm it disappears from equipment and is no longer offered as an action.
7. [ ] **P2:** Reload the table in another tab with stale data and try to use the item again. Confirm a refusal message.
8. [ ] **GM:** Choose **Complete encounter**, set **Automation mode** to Manual in the Campaign's table settings, and start a new Encounter with Hale and Sage. **P2:** Use the Potion of Healing. Confirm the app does not change the potion count by itself; edit it on the Sheet by hand.
9. [ ] **GM:** Set **Automation mode** back to Assisted, **Complete encounter**, and rebuild the arena with scenario 2 steps 4 and 5.

## Expected

- Assisted mode uses up one; the last removes the item; undo gives it back.
- Manual mode leaves the item count alone.

## Other users see

- **P1:** Sees the "Antitoxin (vial)" grant on Sage for the hour, and must NOT see Hale's equipment list or counts.

## ACs covered

SPELLS-5.1, SPELLS-5.2, SPELLS-11.1, SPELLS-11.2, SPELLS-11.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
