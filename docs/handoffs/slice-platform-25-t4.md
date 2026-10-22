# Workbook: PLATFORM-25.T4 / T5 (merge-slice run ids, batching)

## T4 — closes PLATFORM-25.4

- `scripts/mergeSlice.mjs` now takes `tools` (`run`, `sleep`, `now`, `log`) so tests fake only gh, the clock and sleep.
- A dispatched Tests/Live run is polled by id (`gh run view <id>`); the id comes from the URL `gh workflow run` prints (gh 2.96 documents "the created workflow run URL will be returned if available"), else from `gh run list --workflow <file> --branch <b> --event workflow_dispatch` filtered to runs created after the dispatch. The APPEAR_MS refusal is gone; one 90-minute overall timeout remains. Runs the script did not dispatch still use `gh run list --commit`.
- Tests: `describe('mergeSlice waiting on dispatched runs')` in `scripts/mergeSlice.test.mjs` (real git in temp repos, faked gh whose commit listing is always empty). Run with `npx vitest run scripts/mergeSlice.test.mjs` (the file is Vitest, not `node --test`).
- Red proof: against the pre-change script the four new tests fail (it has no injectable tools, so it uses the real remote and refuses "the tip moved"); the lagging-listing behavior itself needs real GitHub and can't run in a unit test.
