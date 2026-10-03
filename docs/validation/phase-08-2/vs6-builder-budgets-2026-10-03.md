# VS-6 Builder budgets over content snapshots (2026-10-03)

Closes P02.3 (ADR 0036, budgets amended by D84). Local Docker Convex `phase82-local-linux`, reset and reseeded (1119 SRD rows, `content/seed:audit` passed) after the compilation moved to `authoredVersionCompilations`; snapshots rebuilt into the local R2 fixture (port 8026); session Worker with `LOCAL_CONTENT_SNAPSHOT_ORIGIN`; web app on localhost:3000.

## Native journey

`scripts/runLocalConvexProof.ps1 -Name phase82-vs6-builder-budgets-20261003b -Proof builder-browser` passed (13:50:55–13:53:17 UTC): Fighter/Rogue, Life Cleric and Dragonborn Champion journeys, exact fixture cleanup and stale JWT denial.

`node scripts/builderBudgets.mjs phase82-vs6-builder-budgets-20261003b` passed. Database I/O is read plus write bytes from the native execution log:

| Journey             | Classes | Autosaves | Max autosave | Commit (budget)      | Full build | Edit-phase Convex calls |
| ------------------- | ------- | --------- | ------------ | -------------------- | ---------- | ----------------------- |
| Human Fighter Rogue | 2       | 9         | 14,506 B     | 545,757 B (665,600)  | 854,401 B  | autosave only           |
| Human Life Cleric   | 1       | 7         | 12,866 B     | 400,443 B (460,800)  | 627,969 B  | autosave only           |
| Dragonborn Champion | 1       | 7         | 13,074 B     | 435,712 B (460,800)  | 664,755 B  | autosave only           |

Failures outside the journeys are the three expected authentication negatives (`authInvitations:redeem`, `authInvitationActions:redeem`, `account:identity`).

Before D84 the same journeys committed 782 KB (Fighter/Rogue) and 955 KB (Life Cleric): Class compilations rode on every version read, and `requireClassParent` re-read the parent Class.

## Focused checks

- `commitReadBudget.test.ts` (450 KB single-Class budget) and `playStateBudget.test.ts` (re-baselined after the counter began counting binary fields) pass.
- `builderEvaluationWorker.size.test.ts` passes (≤300 KB gzipped).
- `CharacterBuilderAuthoringRuntime.test.tsx` and `draftAutosave.test.ts`: 21 tests pass (A36-F1: replaced-draft stop, recommended opening step).
- Compile gates gate72 and gate74 passed.

Ignored evidence: `local-validation/local-convex-proofs/phase82-vs6-builder-budgets-20261003b.*`, `local-validation/vs6-proof2/`.
