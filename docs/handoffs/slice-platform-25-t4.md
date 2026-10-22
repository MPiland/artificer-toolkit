# Workbook: PLATFORM-25.T4 / T5 (merge-slice run ids, batching)

## T4 — closes PLATFORM-25.4

- `scripts/mergeSlice.mjs` now takes `tools` (`run`, `sleep`, `now`, `log`) so tests fake only gh, the clock and sleep.
- A dispatched Tests/Live run is polled by id (`gh run view <id>`); the id comes from the URL `gh workflow run` prints (gh 2.96 documents "the created workflow run URL will be returned if available"), else from `gh run list --workflow <file> --branch <b> --event workflow_dispatch` filtered to runs created after the dispatch. The APPEAR_MS refusal is gone; one 90-minute overall timeout remains. Runs the script did not dispatch still use `gh run list --commit`.
- Tests: `describe('mergeSlice waiting on dispatched runs')` in `scripts/mergeSlice.test.mjs` (real git in temp repos, faked gh whose commit listing is always empty). Run with `npx vitest run scripts/mergeSlice.test.mjs` (the file is Vitest, not `node --test`).
- Red proof: against the pre-change script the four new tests fail (it has no injectable tools, so it uses the real remote and refuses "the tip moved"); the lagging-listing behavior itself needs real GitHub and can't run in a unit test.

## T5 — closes PLATFORM-25.3 (branch platform-25-t5, on top of T4)

- `mergeSlice` takes `slices: [{ branch, sha }]` (CLI `--slices "ci/a@sha ci/b@sha"`, workflow input `slices`); `branch`/`sha` still work and a single pair runs the unchanged path. `parseSlices` builds the list.
- Two or more slices always take the batch path: merged in order onto the phase tip, one `ci/merge-m<N>` push, one Tests+Live wait, one phase push (`landBatch`, shared with the single-slice batch path).
- Refusals name the slice (`ci/<slice>: …`) for a moved tip, a red/missing slice run and a conflict; a red batch commit names the run only (cannot be attributed). Nothing reaches the phase branch on any refusal.
- Tests (`batching several slices`, `parseSlices` in `scripts/mergeSlice.test.mjs`): three-slice batch, conflict, moved tip, red slice, red batch, duplicate slice; the unchanged single-slice path is the T4 describe. Red proof: against T4's `mergeSlice.mjs` the 11 new tests fail.
- Changes `.github/workflows/merge-slice.yml`, so the orchestrator merges it by hand.
