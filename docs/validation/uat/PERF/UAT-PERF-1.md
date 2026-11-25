# UAT-PERF-1: Managed three-user live-room journey (needs managed credentials; run only on an approved staging smoke)

Managed three-user live-room journey (needs managed credentials; run only on an approved staging smoke).

Level 5 (Reliability, performance and release) · Feature PERF · Mode: Group (GM, P1, P2) · Path position 194 of 195

## Prerequisites

- A staging build is available (managed staging credentials are needed; run only on an approved staging smoke).
- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- The Campaign has a presented Scene with a door and a token hidden from players (a GM-only token), built as in the [SCENE](../SCENE/README.md) scenarios.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM, P1 and P2:** Each opens the live table of The Campaign in their own browser.
2. [ ] **GM:** Open or close a door on the presented Scene.
3. [ ] **P1 and P2:** Watch their windows until the door changes and note how many seconds it took.
4. [ ] **P1:** Drag a token across the Scene.
5. [ ] **GM and P2:** Watch the token move, and note whether it follows while dragging and where it ends.
6. [ ] **GM:** Make a rule-bound change (for example a visible Encounter action) and watch all three windows.
7. [ ] **GM:** Go Offline for a short time, then reconnect; confirm the Scene change that was in flight recovers or is reversed cleanly.
8. [ ] **P1 and P2:** Check that the GM-only token never appears in your window.

## Expected

- The door change appears in P1's and P2's windows within a second or two.
- The dragged token is seen moving in the other windows while dragging and settles at the same spot for all three.
- The rule-bound change reaches all three windows together.
- After the reconnect the Scene is consistent for all three users.
- The GM-only token never appears for P1 or P2.
- The automated spec's thresholds (ephemeral p95 150 ms, durable p95 250 ms and p99 500 ms, command p95 one second) hold at staging; the tester only confirms nothing feels slower than described above.

## Other users see

- **P1:** Door change, P2's token drags and the rule change; never the GM-only token.
- **P2:** The same as P1.

## ACs covered

PERF-2.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
