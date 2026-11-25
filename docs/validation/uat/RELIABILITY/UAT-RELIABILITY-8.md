# UAT-RELIABILITY-8: The Sheet shows correct rests, ability checks and hit points

The Sheet shows correct rests, ability checks and hit points.

Level 3 (Core play) · Feature RELIABILITY · Mode: Solo (P1) · Path position 128 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** On Aria's Sheet, reduce her hit points (edit them to below her maximum).
2. [ ] **P1:** Start a short rest and spend one hit die. Read the roll and the new hit points.
3. [ ] **P1:** Reload. Confirm the hit points and the hit dice remaining kept their values.
4. [ ] **P1:** Roll Athletics and read the roll card. Roll Stealth and read the roll card.
5. [ ] **P1:** Set Aria's temporary hit points to 5 and save. Reload. Then clear them back to nothing and reload.
6. [ ] **P1:** In the Extras area add a Creature (for example a pet), choosing an origin other than the world default, and save. Reload and read the origin.
       R1. **P1:** Set Aria's hit points back to the value you noted before step 1.

## Expected

- Step 2: the hit die roll resolves (the die roll plus Constitution modifier, never above the maximum) and one hit die is spent.
- Step 4: Athletics names the Strength modifier and Stealth the Dexterity modifier; no skill uses the wrong ability.
- Step 5: temporary hit points show 5, then show none (zero) rather than blank or an error.
- Step 6: the Creature keeps the origin you chose and is not changed to World.

## Other users see

- Not applicable: one person acts in this scenario.

## ACs covered

RELIABILITY-6.1, RELIABILITY-6.3, RELIABILITY-6.19

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
