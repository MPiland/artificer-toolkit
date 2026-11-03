# UAT-RELIABILITY-7: Authored speed and sense bonuses use the right length unit

Authored speed and sense bonuses use the right length unit.

Level 3 (Core play) · Feature RELIABILITY · Mode: Group (GM, P1) · Path position 138 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): the Sandbox Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** Open P1's Character's Sheet. Note the walking speed and the darkvision range if any.
2. **GM:** Create a Feature "Reliability Boots" that adds +30 to walking speed with the unit set to feet. Publish it.
3. **GM:** Copy it as "Reliability Yards" with the bonus set to +30 and the unit set to yards. Publish it.
4. **GM:** Create a Feature "Reliability Eyes" that adds +30 feet to a sense range, and grant it to a Character with a sense that is 20 yards (60 ft) if available.
5. **P1:** Have the GM give P1's Character "Reliability Boots" and read the Sheet speed. Then swap to "Reliability Yards" and read it again.
6. **P1:** Read the sense range with "Reliability Eyes" granted.
7. **P1:** Start a move on a Scene and read the movement budget shown.

## Expected

- Step 5: Boots add 30 ft to the speed; Yards add 90 ft (30 yards). Neither changes it by a different amount or by zero.
- Step 6: the sense range grows by exactly 30 ft, even when the base sense was authored in yards.
- Step 7: the movement budget shown matches the Sheet speed.

## Other users see

- **GM:** Sees the same speed and senses on the Character's token.

## ACs covered

RELIABILITY-5.1

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
