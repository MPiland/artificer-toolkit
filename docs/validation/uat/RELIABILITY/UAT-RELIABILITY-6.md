# UAT-RELIABILITY-6: A contested passage holds, then spends once

A contested passage holds, then spends once.

Level 3 (Core play) · Feature RELIABILITY · Mode: Group (GM, P1) · Path position 122 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Done in [UAT-MOVE-7](../MOVE/UAT-MOVE-7.md): the optional movement rules are enabled and the Overrun choice is available.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** On Aria's turn note the movement readout, then start a move and choose **Overrun** to pass through the Wolf's space.
2. **P1:** While the contest is open, read the movement readout again.
3. **P1:** Reload the page. Confirm the contest is still open.
4. **GM:** Answer the contest so that Aria wins. Double-click the answering control (two clicks in under a second).
5. **P1:** Read the movement readout and Aria's position. Reload and read both again.
6. **P1:** On Aria's next turn, start another passage and choose **Decline passage**, or have the GM decline for the Wolf.
7. **P1:** Read the movement readout and Aria's position. Reload.

## Expected

- Steps 2-3: the movement readout is unchanged while the contest is open; nothing is spent before the passage finishes, and a reload shows the same single open contest.
- Steps 4-5: the movement is charged once, for the whole path, and Aria arrives once. The double-click does not charge or move twice.
- Steps 6-7: after the passage is declined Aria's token stays where it paused, and only the distance actually travelled is spent.

## Other users see

- **GM:** Sees the contest open, then one result in history.

## ACs covered

RELIABILITY-1.3

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
