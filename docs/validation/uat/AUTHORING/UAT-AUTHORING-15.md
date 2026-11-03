# UAT-AUTHORING-15: Author an Empowered Spell-like feature that spends a resource pool

BLOCKED until AUTHORING-21 merges: the link between the modifier and its pool is changing from a typed Charge ID to a picker, and this scenario is written against the picker. Mark it BLOCKED in the Result block until then.

Level 1 (Single-user basics) · Feature AUTHORING · Mode: Solo (P1) · Path position 38 of 190

## Prerequisites

- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser window, signed in as P1 with the account from your set. Your normal browser is fine.
- **Settings:** **Authoring experience** is **Advanced**. Keep the SRD Sorcerer's **Empowered Spell** feature (Classes, Sorcerer, Metamagic) open as the reference. Start a stopwatch before step 1.

## Steps

1. **P1:** Start the timer. Open `<STAGING_URL>/feats/new` and enter the **Name** "UAT Empowered Copy" and a **Description** (paste the SRD Empowered Spell text or write your own).
2. **P1:** Under **Charges** define the pool the feature spends, a stand-in for sorcery points: choose a **Limit Kind** (for example Fixed amount, with a number of points) and a **Reset Kind** of Long Rest.
3. **P1:** Under Effects, add one effect. In **How It Starts** set **Kind** to Passive and **Trigger** to Activated.
4. **P1:** In **Cast Modifier**, choose the pool from the **Resource pool** list (the pool from step 2, listed under the Feat's name). Set **Cost** to 1. In **Rerolls damage dice after the roll** set **Damage dice rerolled** to 0, **Plus the modifier of** to Charisma, and **At least** to 1.
5. **P1:** Under **Outcome Paths** add one path: **Outcome Path** On Use, **Outcome Group** Single, **Selection Model** Direct. In its **Result**, add an outcome with **Effect Kind** Manual Adjudication, a **Reason** of your choice, and **Instructions** such as "The chosen damage dice are rolled again, and the new rolls stand."
6. **P1:** Choose **Save Draft**, reload, confirm the pool is still selected in **Cast Modifier**, then **Activate**. Stop the timer.
7. **P1:** Open the published copy in the reader view beside the SRD Empowered Spell and compare: the cost (1 point), the Charisma-based reroll count with a minimum of one, and the pool it spends.
8. **P1:** Rename the Feat (a pool is listed under its owner's name), **Activate** again, and reopen the Cast Modifier.
9. **P1:** Record the time taken and the difficulty rating, then delete the Feat.

## Expected

- Step 4: the pool is chosen from a list, not typed as an ID; a feature with no pool defined offers an empty list rather than a free-text box. If the picker does not list the Feat's own pool (the SRD defines the pool on the Class, under Resource, Charges), record that; building a homebrew Class to hold the pool is the fallback and counts toward the time.
- Step 6: the chosen pool survives the reload and the feature activates.
- Step 7: the copy and the SRD Empowered Spell agree on cost, reroll count and minimum, and both name the pool they spend.
- Step 8: the Cast Modifier still points at the same pool, now shown under the Feat's new name.

## Cross-role check

Owner follow-up, run after the tester finishes, from the same set's P2 profile (not part of the tester's run):

- **P2:** Searching Feats for "UAT Empowered" finds nothing.

**Record**: time from step 1 to step 6, difficulty 1 to 5, and whether you found the pool link without help.

## ACs covered

AUTHORING-21.1, AUTHORING-21.2 (once AUTHORING-21 merges); also an authoring-effort check.

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
