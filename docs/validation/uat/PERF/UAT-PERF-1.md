# UAT-PERF-1: Managed three-user live-room journey (needs managed credentials; run only on an approved staging smoke)

Managed three-user live-room journey (needs managed credentials; run only on an approved staging smoke).

Level 5 (Reliability, performance and release) · Feature PERF · Mode: Group (GM, P1, P2) · Path position 187 of 188

## Prerequisites

- The review data provides a staging build (blocked until gap G4 is fixed: see [Known UAT gaps](../OPERATOR.md#known-uat-gaps)).
- The review data provides the account **GM**, owner of the four review Campaigns.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM, P1 and P2:** Each opens the live table of the managed fixture Campaign in a separate browser profile.
2. **GM:** Open or close a door on the presented Scene.
3. **P1 and P2:** Watch their windows until the door changes and note how many seconds it took.
4. **P1:** Drag a token across the Scene.
5. **GM and P2:** Watch the token move, and note whether it follows while dragging and where it ends.
6. **GM:** Make a rule-bound change (for example a visible Encounter action) and watch all three windows.
7. **GM:** Go Offline for a short time, then reconnect; confirm the Scene change that was in flight recovers or is reversed cleanly.
8. **P1 and P2:** Check that the GM-only token never appears in your window.

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
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
