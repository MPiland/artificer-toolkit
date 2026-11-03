# UAT-SHEET-11: Sheet during live play and after reconnect

Sheet during live play and after reconnect.

Level 3 (Core play) · Feature SHEET · Run order 87 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1:** Open Aria's Sheet in a second tab.
2. **P1:** Note Aria's hit points on the Sheet.
3. **GM:** In the tabletop window apply 2 damage to Aria through the Encounter actor controls.
4. **P1:** Watch the Sheet without reloading.
5. **P1:** In the browser developer tools Network panel choose "Offline" (this cuts the page's connection).
6. **GM:** While P1 is offline, apply 1 more damage to Aria.
7. **P1:** After about a minute switch the Network panel back to No throttling and wait for the page to reconnect without reloading.

## Expected

- Step 4: the Sheet's hit points drop by 2 without a reload.
- After reconnect (step 7) the Sheet shows the further 1 point of damage; nothing is lost or applied twice.

## Other users see

- **GM:** sees Aria's hit points change on the tabletop and no error from P1's reconnect.

## ACs covered

SHEET-5.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
