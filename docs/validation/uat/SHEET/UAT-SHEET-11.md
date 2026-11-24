# UAT-SHEET-11: Sheet during live play and after reconnect

Sheet during live play and after reconnect.

Level 3 (Core play) · Feature SHEET · Mode: Group (GM, P1) · Path position 92 of 191

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- **The Campaign** is on a presented Scene in Assisted mode with the Speed Factor initiative, with a Wolf token and a Goblin token, and its Encounter started and in round 2 (built in the SCENE and ENCOUNTER scenarios). P1 has Aria in it: a Level 1 Fighter that P1 built in the Character Builder.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open Aria's Sheet in a second tab.
2. [ ] **P1:** Note Aria's hit points on the Sheet.
3. [ ] **GM:** In the tabletop window apply 2 damage to Aria through the Encounter actor controls.
4. [ ] **P1:** Watch the Sheet without reloading.
5. [ ] **P1:** In the browser developer tools Network panel choose "Offline" (this cuts the page's connection).
6. [ ] **GM:** While P1 is offline, apply 1 more damage to Aria.
7. [ ] **P1:** After about a minute switch the Network panel back to No throttling and wait for the page to reconnect without reloading.

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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
