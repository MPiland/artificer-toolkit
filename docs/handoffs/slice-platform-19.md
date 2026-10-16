# PLATFORM-19: generated-file drift on a CI branch fixes itself

Ledger: PLATFORM-19 (AC PLATFORM-19.1, task PLATFORM-19.T1) in [08-phase-ledger.json](../roadmap/08-phase-ledger.json).

## Problem

The live-backend job regenerates the SRD manifest and the Convex `_generated` files and fails when they differ from the commit. A session then downloads the `generated-files` artifact, commits it and pushes again, a full CI cycle per drift. A local pre-push regeneration was rejected: the manifest generator reads built package `dist`, and slice worktrees have no `node_modules`.

## Resume here

- **Done:** PLATFORM-19.T1 on `ci/platform-19` (option b, approved). The SRD manifest is no longer committed: the setup action generates it after the package build (`dev:prepare` and `dev:convex` locally). `_generated` stays committed; the `auto-fix` job in `live-backend.yml` commits it back to the same `ci/**` branch when drift is the only failure, then dispatches Tests and Live. `scripts/watchCi.ps1` prints `AUTO-FIX <sha>` and follows it. A dispatched Live queues instead of cancelling its parent run.
- **Proof:**
  - Base `e371ed77c`: Tests 38977513942 and Live 38977513914 green, no committed manifest.
  - Drift (new Convex function, stale `api.d.ts`) `bf90de31b`: Live 38977521997 failed on drift, `auto-fix` job succeeded and pushed `0a22547dd`; dispatched Tests 38978637618 and Live 38978639676 both green on it.
  - Drift plus a real failure (broken Convex function, `db68d46a8`): Live 38975004456 failed at codegen, `auto-fix` job skipped, no commit.
- **Throwaway branches** `ci/platform-19-drift` and `ci/platform-19-drift-fail` are deleted.
- **Next:** merge `ci/platform-19`. The ledger AC text is the orchestrator's to update.
