# UAT-AUTHORING-14: Author a Fireball-like spell from scratch

Author a Fireball-like spell from scratch.

Level 1 (Single-user basics) · Feature AUTHORING · Run order 33 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Accounts:** P1
- **Windows:** One browser window signed in as the account above.
- **Settings:** **Authoring experience** is **Advanced**. Keep the SRD Fireball open in a second tab as the reference. Start a stopwatch before step 1.

## Steps

1. **P1:** Start the timer. Open http://localhost:3000/spells/new.
2. **P1:** Under Basics, enter the **Name** "UAT Fireball Copy" and a **Description**. Set **Level** to Level 3, **Magic School** to Evocation, and add Sorcerer and Wizard to **Classes**. Set **Casting Time** to 1 action and tick Verbal, Somatic and Material **Components**.
3. **P1:** Under Effects, add one effect. In **How It Starts** set **Kind** to Action and **Trigger** to Saving Throw. In **Saving Throw** set **DC Method** to the option that uses the caster's spell save DC, and **Save Ability** to Dexterity. Set **Activation** to Action with **Amount** 1.
4. **P1:** Set **Range** to Distance, **Amount** 150, **Unit** Feet. Set **Shape Kind** to Sphere with **Radius** **Amount** 20, **Unit** Feet. Set **Target Selection** to Area Contents and **Target Eligibility** to Any valid target.
5. **P1:** Under **Outcome Paths** add a first path: **Outcome Path** On Save Failure, **Outcome Group** Single, **Selection Model** Direct, **Starts From** Source. In its **Result** set **Outcome Type** Single and add an outcome: **Effect Kind** Damage, **Damage Type** Fire, **Value Kind** Dice, **Scaling Kind** Per Level, **Scaling Source** Spell Cast Level.
6. **P1:** In that outcome's **Levels** table add seven rows: **Level** 3 with **Damage Dice** `8d6`, then 4 with `9d6`, 5 with `10d6`, 6 with `11d6`, 7 with `12d6`, 8 with `13d6`, 9 with `14d6`.
7. **P1:** Add a second path: **Outcome Path** On Save Success, with the same Group, Selection Model and Starts From. Add an outcome with the same Effect Kind, Damage Type, Value Kind, Scaling Kind and Scaling Source, and set **Amount Modifier** to Half.
8. **P1:** In the second outcome's **Levels** table enter the same seven rows again (levels 3 to 9, `8d6` to `14d6`).
9. **P1:** Choose **Save Draft**, reload, then **Activate**. Stop the timer.
10. **P1:** Open the published copy in the reader view beside the SRD **Fireball** and compare casting time, range, area, save, damage on a failed save, damage on a successful save, and the upcast table.
11. **P1:** Record the time taken and the difficulty rating, then delete the Spell.

## Expected

- Step 3-8: each field exists in the Advanced form under the label given.
- Step 7-8 (expected behaviour, not a failure): the second path asks you to restate the full seven-row level table, because half damage on a save is a modifier on a separate path with its own table, not a derived value. The "+1d6 per slot above 3rd" rule is also entered as seven written-out rows, not as one rule. Note how long these two steps took and whether you made a typo in the second table. Deriving both is a known candidate improvement (authoring audit), not part of this scenario.
- Step 9: the copy activates, with the same totals the SRD Fireball has.
- Step 10: the reader view of the copy matches Fireball on every mechanical line: DEX save, 20-foot sphere, 150 feet, 8d6 on a failed save, half on a success, 9d6 at 4th level up to 14d6 at 9th.

## Other users see

- **P2:** Searching Spells for "UAT Fireball" finds nothing.

**Record**: time from step 1 to step 9, difficulty 1 to 5, the time spent on steps 7 and 8 alone, and every typo or mismatch you had to correct between the two tables.

## ACs covered

none of the registered ACs. Authoring-effort check, as [UAT-AUTHORING-13](UAT-AUTHORING-13.md).

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
