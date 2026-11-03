# UAT-RELIABILITY-10: Builder and party inventory values are right

Builder and party inventory values are right.

Level 5 (Reliability, performance and release) · Feature RELIABILITY · Mode: Group (GM, P1) · Path position 180 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Open the party inventory and read the currencies listed.
2. **GM:** Add coins to one currency, reload and read the entry again.
3. **P1:** Start a new Character in the Builder. Choose a class and pick the level-1 hit points option.
4. **P1:** Read the hit points shown, and the hit die value and proficiency bonus.
5. **P1:** Raise the level to 2 and read the hit points and proficiency bonus again.
6. **P1:** Look for a field named "HP gained (legacy)" or a hit-point override.
7. **P1:** Leave a required choice empty, then try to finish. Read the list of issues and select one.
8. **P1:** In the Builder set the network to Slow 3G (browser developer tools), then save a step. Watch the save control.
   R1. **P1:** Delete the Builder draft you started.

## Expected

- Steps 1-2: each currency shows its proper name (for example gold) and not an id; no currency is mislabelled and added coins stay on the same currency after a reload.
- Steps 4-5: hit points at level 1 equal the hit die maximum plus the Constitution modifier; the hit die average and proficiency bonus (+2 at levels 1 to 4) match the class and level.
- Step 6: no "HP gained (legacy)" input or hit-point override exists.
- Step 7: selecting an issue takes you to the Builder step that owns it, never to Review as a fallback.
- Step 8: the save control shows a saving state until it finishes, never idle while the save is pending.

## Other users see

- **GM:** Sees the same currency names and amounts as the party inventory the players see.

## ACs covered

RELIABILITY-6.5, RELIABILITY-6.13, RELIABILITY-6.17, RELIABILITY-7.2, RELIABILITY-10.3

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
