# P15.3 Clock recovery limits: local Docker backend run (2026-10-02)

Target: local Docker Convex backend `phase82-local-linux` at http://127.0.0.1:3210 (ADR 0035). This is the real Convex runtime, NOT a cloud deployment.

## Run

- Command: `pwsh -File scripts/runLocalConvexProof.ps1 -Name p15-recovery-20261002 -Proof session-control` (drives `yarn tsx apps/apis/tests/developmentDrafts.ts --session-control` -> `verifySessionControl`). Exit code 0; collector completed, 257 native log entries.
- Source: HEAD `3d0c8a358e4832b740216e61d6403b30a2d3f0fe`. `git status --short apps/apis/convex packages` showed no `apps/apis/convex` changes; two uncommitted `packages/rules-runtime/src/character/` edits (`sheetAdjustmentCommands.ts`, `sheetResourceUsage.ts`).
- Source parity reported `matches: false`: `apps/apis/tests/fixtures/liveSessionWorker.ts` (since deleted; the real room fixture is `localRoomWorker.ts`) and `apps/session-worker/test/characterSheetInputsFixture.ts` changed and `apps/session-worker/src/testing/encounterRunFixture.ts` was added during the run (concurrent work by another agent). None are on the Clock path (apps/apis/convex/campaigns/clock*.ts).

## Clock executions (native function log, 16 completions)

| Function                                            | Docs read | Bytes read  | Docs written | Bytes written | Time (s)  | Note                                                         |
| --------------------------------------------------- | --------- | ----------- | ------------ | ------------- | --------- | ------------------------------------------------------------ |
| campaigns/clock:advance (DAILY recovery commit)     | 89        | 126,926     | 8            | 7,182         | 0.680     | succeeded                                                    |
| campaigns/clock:advance (first attempt)             | 89        | 126,926     | 0            | 0             | 0.680     | OCC conflict on `characterPlayStates`, retryCount 0, retried |
| campaigns/clock:reconcile                           | 10        | 3,634       | 4            | 2,341         | 0.050     |                                                              |
| campaigns/clock:pause                               | 10        | 3,634       | 3            | 1,746         | 0.030     |                                                              |
| campaigns/clock:configure, start, rewind, reset     | 8         | 3,006       | 2-3          | 1,151-1,738   | 0.03-0.09 |                                                              |
| campaigns/clock:initialize                          | 6         | 2,319       | 2            | 1,152         | 0.230     |                                                              |
| campaigns/clock:advance, replay/contention (9 rows) | 6-7       | 2,320-3,083 | 0            | 0             | 0.03-0.07 | 5 rejected "Campaign clock changed", 4 exact replays         |

Maximum Clock execution: 89 documents read, 126,926 bytes read, 8 documents written, 7,182 bytes written, 0.680 s. Only one OCC event was recorded (the advance above); the run's overall maxima were `campaigns/assignments:assign` (467 docs, 934,010 B, 0.637 s) and `content/publication:publishDraft` (407 docs, 766,194 B, 0.502 s).

## Limits

Source: https://docs.convex.dev/production/state/limits (fetched 2026-10-02; the page is not pinned to a version, and the installed `convex` is 1.45.0 per `apps/apis/package.json`; `node_modules/convex` does not state the limits). Per mutation: 32,000 documents scanned, 16,000 documents written, 16 MiB read, 16 MiB written, 1 s user-code execution, 4,096 index range reads.

## Verdict

Within limits. Maximum 89 documents (0.3% of 32,000), 127 KB (0.8% of 16 MiB), 8 written (0.05% of 16,000), 0.680 s total execution time. The 1 s limit applies to user code only; `userExecutionTime` was not extracted, so 0.680 s is a conservative upper bound.

Caveat: this fixture has one Character with one DAILY resource, so it exercises the real runtime path but not the earlier 813-document / 0.733 s scale (that historical figure is not reproduced here; 0.680 s is comparable in time but 89 documents is far smaller). Contention, exact replay, once-only DAILY recovery and the watermark hold all passed in the run log.

## Evidence

`local-validation/local-convex-proofs/p15-recovery-20261002.{log,command.txt,exit.txt,metadata.json,native-executions.jsonl,native-capture.json,native-capture-status.json,source-before.json,source-parity.json,guard.json}`
