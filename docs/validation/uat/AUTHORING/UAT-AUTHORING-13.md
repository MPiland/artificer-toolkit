# UAT-AUTHORING-13: Author a Fire Bolt-like cantrip from scratch

Author a Fire Bolt-like cantrip from scratch.

Level 1 (Single-user basics) · Feature AUTHORING · Run order 32 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Accounts:** P1
- **Windows:** One browser window signed in as the account above.
- **Settings:** **Authoring experience** is **Advanced**. Keep the SRD Fire Bolt page open in a second tab as the reference. Start a stopwatch before step 1.

## Steps

1. **P1:** Start the timer. Open http://localhost:3000/spells/new.
2. **P1:** Under Basics, enter the **Name** "UAT Fire Bolt Copy" and a **Description** (paste the SRD text or write your own). Set **Level** to Cantrip, **Magic School** to Evocation, and add Sorcerer and Wizard to **Classes**. Under Casting, set **Casting Time** to 1 action and tick the Verbal and Somatic **Components**.
3. **P1:** Under Effects, add one effect (the **Add effect** button). In **How It Starts** set **Kind** to Action, **Trigger** to Ranged Spell Attack, and **Activation** to Action with **Amount** 1.
4. **P1:** Under **Range** set **Range Kind** to Distance, **Amount** 120, **Unit** Feet. Under **Targeting** set **Target Selection** to Single Target and **Target Eligibility** to Any valid target.
5. **P1:** Under **Outcome Paths** add one path. Set **Outcome Path** to On Hit, **Outcome Group** to Single, **Selection Model** to Direct and **Starts From** to Source.
6. **P1:** In the path's **Result**, set **Outcome Type** to Single, then add one outcome. Set **Effect Kind** to Damage, **Damage Type** to Fire, **Value Kind** to Dice, **Scaling Kind** to Per Level and **Scaling Source** to Character Level.
7. **P1:** In the outcome's **Levels** table add four rows: **Level** 1 with **Damage Dice** `1d10`, level 5 with `2d10`, level 11 with `3d10`, level 17 with `4d10`.
8. **P1:** Choose **Save Draft**, reload, and confirm every value is still set.
9. **P1:** Choose **Activate**. Stop the timer.
10. **P1:** Open the published "UAT Fire Bolt Copy" in the reader view (its detail page) in one tab and the SRD **Fire Bolt** in another. Compare them side by side: casting time, range, attack, damage, scaling levels and Classes.
11. **P1:** Record the time taken and the 1-5 difficulty rating (below), then **Discard draft** or delete the Spell to leave no clutter.

## Expected

- Step 2-7: every field above exists in the Advanced form under the label given. Fields that do not apply to the chosen Trigger or Effect Kind stay hidden rather than erroring.
- Step 8: the draft survives the reload with all four scaling rows.
- Step 9: **Activate** succeeds without a validation message; if one appears, record its exact wording as a confusion point.
- Step 10: the reader view of the copy matches the SRD Fire Bolt on every mechanical line (ranged spell attack, 120 feet, 1d10 fire, 2d10 at level 5, 3d10 at 11, 4d10 at 17, Sorcerer and Wizard). Wording of the description may differ.

## Other users see

- **P2:** Searching Spells for "UAT Fire Bolt" finds nothing (private homebrew).

**Record** (in [Run notes](#result), whatever the result): time from step 1 to step 9 (minutes), difficulty 1 (trivial) to 5 (could not finish without help), the step where you hesitated longest, and any value you could not find.

## ACs covered

none of the registered ACs. This is an authoring-effort check: it measures how hard a real effect is to build, and it complements AUTHORING-9.1 to 9.3.

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
