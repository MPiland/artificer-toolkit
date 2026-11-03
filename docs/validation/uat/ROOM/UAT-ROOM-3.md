# UAT-ROOM-3: Reconnect after a dropped connection

Reconnect after a dropped connection.

Level 3 (Core play) · Feature ROOM · Run order 125 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1 and P2 are seated in the Sandbox Campaign.

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1:** In the browser developer tools open the Network panel and choose **Offline**.
2. **GM:** Move a token (or post a chat line) while P1 is offline.
3. **P1:** Wait one minute, then switch the throttle back to No throttling.
4. **P1:** Watch the tabletop window without reloading.
5. **P1:** Reload the page.
6. **GM:** If an Encounter decision is waiting for P1, check it is still pending.
7. **GM:** In the sandbox Campaign, use **Remove player** on P1 while P1's tabletop window is open.
8. **P1:** Try to use the open window (post a chat line), then reload it.
9. **GM and P2:** Post a chat line and move a token.
10. **GM:** Read the presence list.
    R1. **GM:** Re-seat the player you removed in steps 7 to 10 as in [CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md).

## Expected

- After the connection is back, P1's window reconnects on its own and shows the token move and the chat line made while offline. A waiting decision is still there; a temporary aim or preview may need redoing.
- A reload yields the same state.
- Steps 7-8: P1 is refused and the window closes or shows an access message; the chat line is not posted.
- Step 9-10: GM and P2 keep working without a reload; P1 is gone from the presence list and P2 and the GM are still present.

## Other users see

- **GM:** sees P1 leave and rejoin the presence list in steps 1-5, and leave for good in step 7.
- **P2:** never sees P1's rejected chat line.

## ACs covered

ROOM-2.2, ROOM-1.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
