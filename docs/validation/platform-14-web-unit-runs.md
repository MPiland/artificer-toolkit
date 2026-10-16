# PLATFORM-14.1: three clean full web unit runs

Status: not yet run. Lane 1 runs this in the main checkout on the merged source (ATTACK-18 slice C and lane 2's commits). Claude worktrees can't produce a clean run: see "Known worktree limitation" in [lane-2-platform-closeout.md](../handoffs/lane-2-platform-closeout.md).

## Command

```powershell
pwsh -NoProfile -File scripts/runWebUnitRuns.ps1 -Runs 3
```

The script:

- refuses a dirty tree;
- holds `local-validation/.validation.lock` for all runs;
- runs the full `unit` project (`yarn workspace @artificer-toolkit/web test`) once per run, with no file filter, retries or skips;
- writes `run-<n>.log` and `summary.json` under `local-validation/platform-14/<stamp>/`;
- exits non-zero if any run exits non-zero or reports a failure.

## Result

| Field    | Value                                             |
| -------- | ------------------------------------------------- |
| Commit   | _sha from summary.json_                           |
| Date     | _yyyy-mm-dd_                                      |
| Evidence | `local-validation/platform-14/<stamp>/` (ignored) |

| Run | Exit | Test files | Tests | Seconds |
| --- | ---- | ---------- | ----- | ------- |
| 1   |      |            |       |         |
| 2   |      |            |       |         |
| 3   |      |            |       |         |
