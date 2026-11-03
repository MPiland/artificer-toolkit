# UAT-RELIABILITY-8: The Sheet shows correct rests, ability checks and hit points

The Sheet shows correct rests, ability checks and hit points.

Level 3 (Core play) · Feature RELIABILITY · Run order 119 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Accounts:** P1
- **Windows:** One browser window signed in as the account above.

## Steps

1. **P1:** On Aria's Sheet, reduce her hit points (edit them to below her maximum).
2. **P1:** Start a short rest and spend one hit die. Read the roll and the new hit points.
3. **P1:** Reload. Confirm the hit points and the hit dice remaining kept their values.
4. **P1:** Roll Athletics and read the roll card. Roll Stealth and read the roll card.
5. **P1:** Set Aria's temporary hit points to 5 and save. Reload. Then clear them back to nothing and reload.
6. **P1:** In the Extras area add a Creature (for example a pet), choosing an origin other than the world default, and save. Reload and read the origin.
   R1. **P1:** Set Aria's hit points back to the value you noted before step 1.

## Expected

- Step 2: the hit die roll resolves (the die roll plus Constitution modifier, never above the maximum) and one hit die is spent.
- Step 4: Athletics names the Strength modifier and Stealth the Dexterity modifier; no skill uses the wrong ability.
- Step 5: temporary hit points show 5, then show none (zero) rather than blank or an error.
- Step 6: the Creature keeps the origin you chose and is not changed to World.

## Other users see

- Not applicable: single user.

## ACs covered

RELIABILITY-6.1, RELIABILITY-6.3, RELIABILITY-6.19

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
