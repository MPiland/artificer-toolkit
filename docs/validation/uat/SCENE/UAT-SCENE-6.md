# UAT-SCENE-6: Offline edits recover

Offline edits recover.

Level 2 (GM setup) · Feature SCENE · Mode: Group (GM, P1) · Path position 64 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- Done in [UAT-SCENE-3](UAT-SCENE-3.md): "UAT Cavern" is presented in The Campaign with a wall on it.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open the browser developer tools Network panel and choose **Offline**.
2. [ ] **GM:** Move a token and add a wall while offline.
3. [ ] **GM:** Switch back to No throttling, wait for reconnect, and watch the map.
4. [ ] **GM:** Reload.
5. [ ] **P1:** Check the map.
6. [ ] **GM:** Close the tab entirely while offline, reopen the tabletop window online, and check the map.
7. [ ] **GM:** Open the tabletop window in a second browser tab (tab B) beside the first (tab A). In tab A move the wall a little; in tab B, without reloading, move the same wall somewhere else.
8. [ ] **GM:** Reload both tabs and compare the wall.
9. [ ] **GM:** Add a spare token, then in tab A double-click its remove control (two clicks in under a second) and check the token list.

## Expected

- After reconnect or reload the Scene shows the final positions. A change that could not be sent is either replayed or clearly flagged; nothing silently disappears or duplicates.
- P1 sees the same final map.
- Steps 7 to 8: the second move is either applied after the first or refused with a message that the Scene changed; after reload both tabs show the wall in the same single place, and P1 sees that same place. Nothing is half-applied or duplicated.
- Step 9: the token is removed once; no error, and no second token disappears.

## Other users see

- **P1:** sees changes only once they succeed, never a half-state, and never the hidden token.

## ACs covered

SCENE-1.3, SCENE-2.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
