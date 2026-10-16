# Slice RELIABILITY-16: snapshot drift regenerated in CI

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T1 closes AC RELIABILITY-16.1. After a slice merges the newest `ci/merge-batch-*`, Vitest snapshot conflicts (for example `encounterStoreConformance`) need a light-lane `-u` run, and the light lane starts only with 1 GB of memory free. With the full fleet running, the machine had about 490 MB available on 2026-10-16, so snapshot regeneration stalled.
- Mirror the live-backend `generated-files` artifact: when a `ci/**` Tests run fails on snapshot mismatches, rerun the failing test files with snapshot update in the same job and upload the changed `__snapshots__` files as an `updated-snapshots` artifact. The job still fails, so drift never goes green silently.
- Teach `scripts/watchCi.ps1` to print the `gh run download <id> -n updated-snapshots -D local-validation/snapshots-<id>` command, and update [slice-workbook-rules.md](slice-workbook-rules.md) and the AGENTS.md Validation section to use it.
- Prove it with a deliberately stale snapshot on a throwaway `ci/` branch: the run fails and uploads the corrected snapshot (red), and committing the artifact turns it green.

## Log
