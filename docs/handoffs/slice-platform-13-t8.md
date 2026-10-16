# Slice workbook: PLATFORM-13.T8 (quiet scheduled jobs in Convex tests)

**Status:** READY (written 2026-10-15)
**Base:** `codex/phase-08-2-convex-cutover`.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief (AC PLATFORM-13.10)

Every Convex shard log carries "Error when running scheduled function … must be configured" lines (for example runs 38792840212 and 38789989223). They fail nothing but bury the real failure.

- **Sources:**
  - `apps/apis/convex/media/storage.ts`
  - `apps/apis/convex/emailTransport.ts`
  - the live-session Worker URL read (`LIVE_SESSION_WORKER_URL`)
  - any other `must be configured` throw reached from a scheduled job
- **Fix:** Configure the convex-test environment with the test or disabled modes the product already supports (`MEDIA_STORAGE_MODE`, `MAIL_DELIVERY_MODE`, `LIVE_SESSION_WORKER_URL`), in the shared test setup rather than per test.
- **Don't:**
  - Silence logging, catch and drop errors, or add a test-only branch to product code.
  - If a job has no supported test mode, report it instead of inventing one.
- **Keep:** Tests that assert the "must be configured" throw (for example `media/storage.test.ts`) must still prove it, by clearing the variable locally.
- **Proof:** A CI run on `ci/<slice>` whose Convex shard logs contain no "must be configured" scheduled-function errors. Record the run id here.
- **Validation:**
  - Iterate in the light lane on a few affected test files.
  - The checkpoint is CI via `git push origin HEAD:ci/platform-13-t8`.

## Status log
