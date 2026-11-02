# Performance and cost — UAT scenarios

Feature `PERF` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

These scenarios give testers a human feel for responsiveness at a table of four. The numeric budgets are measured by harnesses elsewhere; nothing here replaces them, and nothing here is evidence of normal play. The managed run needs staging credentials and is not a local test.

## UAT-PERF-1: Managed three-user live-room journey (needs managed credentials; run only on an approved staging smoke)

- **Covers:** PERF-2.1
- **Accounts:** GM, P1, P2
- **Preconditions:** Blocked until gap G4 is fixed (the owner approves a staging smoke and managed credentials exist). Run at staging, not locally; do not point this scenario at the local build. The automated reference is `apps/web/tests/managed-vtt/managedRemoteVtt.spec.ts`, which runs the same journey and thresholds on the managed stack. Record the result as "run at staging" in [recording results](README.md#recording-results).

**Steps**

1. **GM, P1 and P2:** Each opens the live table of the managed fixture Campaign in a separate browser profile.
2. **GM:** Open or close a door on the presented Scene.
3. **P1 and P2:** Watch their windows until the door changes and note how many seconds it took.
4. **P1:** Drag a token across the Scene.
5. **GM and P2:** Watch the token move, and note whether it follows while dragging and where it ends.
6. **GM:** Make a rule-bound change (for example a visible Encounter action) and watch all three windows.
7. **GM:** Go Offline for a short time, then reconnect; confirm the Scene change that was in flight recovers or is reversed cleanly.
8. **P1 and P2:** Check that the GM-only token never appears in your window.

**Expected**

- The door change appears in P1's and P2's windows within a second or two.
- The dragged token is seen moving in the other windows while dragging and settles at the same spot for all three.
- The rule-bound change reaches all three windows together.
- After the reconnect the Scene is consistent for all three users.
- The GM-only token never appears for P1 or P2.
- The automated spec's thresholds (ephemeral p95 150 ms, durable p95 250 ms and p99 500 ms, command p95 one second) hold at staging; the tester only confirms nothing feels slower than described above.

**Other users see**

- **P1:** Door change, P2's token drags and the rule change; never the GM-only token.
- **P2:** The same as P1.

## UAT-PERF-2: Four people at a local table feel responsive

- **Covers:** PERF-1.3, PERF-3.2, PERF-3.3, PERF-3.7
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Review data loaded ([review data](README.md#review-data)). Use **Review: Party in the Field**. GM, P1, P2 and P3 each in their own browser profile with the live table open, plus a stopwatch. Write these assumptions next to the result: one computer running all four windows (or four computers on one network), local Convex backend, an Assisted Encounter with two creatures and three Characters, a handful of actions. This is a small session, not a claim about real play at scale.

**Steps**

1. **GM:** Note the current turn. Press **Next turn** and start the stopwatch.
2. **P1, P2, P3:** Each stop your stopwatch when the turn marker changes in your own window. Record the three times.
3. **GM:** Use **Next turn** until it is Aria's turn.
4. **P1:** Open the action drawer and attack the Wolf. Roll when asked.
5. **GM, P2, P3:** Note how long until the attack result appears in your own window.
6. **P2 and P3, together:** P2 drags Bryn's token while P3 drags Cade's token. Note whether either feels stuck. If the Encounter refuses a move out of turn, record that and do this step on a Scene outside an Encounter (the Sandbox Campaign, as in UAT-MOVE-5).
7. **P1:** Open Aria's Sheet in another tab, apply 1 point of damage or healing and save. Switch back to the table.
8. **P3:** Go to the Campaign page outside the table and watch the displayed hit points while the GM changes the Wolf's or Aria's hit points at the table.
9. **P1:** On Aria's turn, drag Aria's token away from the Wolf so a **Pending decision** opens.
10. **GM, P1, P2, P3:** Each confirm the turn and the chat in your own window match the GM's, and read what you see for the pending decision. Then the decision's owner resolves it (**Decline reaction** is enough).

**Expected**

- Step 2: all three turn markers change within about a second of the GM's click. Record any time over three seconds with the time.
- Step 5: the attack result shows in all four windows at about the same time, with no window waiting for a page refresh.
- Step 6: both token moves show smoothly in the other windows, and neither move is lost.
- Step 7: the Sheet change appears at the table at once (no refresh).
- Step 8: P3's Campaign page updates without a refresh for the values P3 may see.
- Step 10: turn and chat are the same in all four windows; the decision's owner sees the prompt and the other windows show "Waiting on a movement decision." (or the same pending state), then everyone sees it cleared once resolved.

**Other users see**

- **P2:** The result of P1's attack and the turn change at about the same moment as the GM.
- **P3:** Same as P2; on the Campaign page sees updated hit points only for Characters that P3 is allowed to see.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC | Why not a UAT step |
| -- | ------------------ |
| PERF-1.1 | Frozen workload run by a harness |
| PERF-1.2 | Latency and I/O budgets measured by harness (ADR 0035) |
| PERF-3.1 | Record sizes and read volumes measured |
| PERF-3.4 | Budgets, harness deletion and docs rewrite; engineering work |
| PERF-3.5 | Checkpoint I/O sizes; measured |
| PERF-3.6 | Absence of forced flushes is an I/O measurement; the visible half (a window stays alive past its sign-in) is UAT-ROOM-2 step 7. |
| PERF-3.8 | Save point design; I/O measured |
| PERF-3.9 | Where movement evidence is stored; internal |
| PERF-3.10 | Which store live readers use; internal |
| PERF-3.11 | Storage layout; internal |
| PERF-3.12 | Checkpoint folding; internal |
| PERF-3.14 | Budgets in gates and the V15 load run; measured |
| PERF-4.1 | Encounter creation read volume at 100 actors; measured |
| PERF-4.2 | Module load cost; measured |
| PERF-4.3 | SHA-256 digest equality; unit test |
| PERF-4.4 | Projection read volume with computed AC; measured |
