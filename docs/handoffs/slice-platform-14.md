# Slice workbook: PLATFORM-14.1 (web tests reliable)

AC 14.1: web tests reliable. Test workers are capped to physical cores, and three full runs finish with 0 failures.

## Decisions (main session, 2026-10-16)

- Keep `maxWorkers: '50%'` in `apps/web/vitest.config.ts` (unit project). Node has no physical-core API, and half the logical CPUs equals the physical cores on every machine that runs these tests (GitHub runners; this machine is 8 cores / 16 logical). Platform-specific detection is not worth the code. The config comment says why.
- Proof comes from existing runs, not from a push by this session: the "Web tests" job of three consecutive green merge batches on the phase tip (run ids go in the table below).

## Flake survey (2026-10-16)

Scope: every failed `tests.yml` run in the last 600 runs (since 2026-09-26; all web failures fall in 2026-10-15 16:34 to 2026-10-16 04:51), `Web tests` job only. 14 failed Web jobs, none a flake:

| Runs | Branch | Cause | Resolved by |
| --- | --- | --- | --- |
| 38770160981, 38770162149, 38771064999, 38771263318, 38771983271 | ci/attack-10-t1, ci/reaction-4-t1 | The build step of the job failed (no test ran) | the slices' own fixes |
| 38772362391, 38774583548 | ci/reaction-4-t1 | `authoringNodeDefaultInventory.test.ts` found an add-enabled child map without a factory (real parity gap) | slice fix |
| 38818550459 | ci/attack-9-t7 | `AuthoredDomainFieldParity.test.tsx`, Rage fields dropped by normalization (real) | slice fix |
| 38829133617 | ci/accounts-7-t2 | `useCharacterPreparationCatalogue.test.tsx`: masking replaced "Fireball"-style whole words (`****ing Fire`) | 2ee8446a4 and d0f2d6b80, the masking granularity commits |
| 38840007044 | ci/reaction-4-t3 | `AuthoredDomainFieldParity.test.tsx` Absorb Elements clears a fixed damage type (real) | slice fix |
| 38843859703, 38846929473 | ci/attack-17-t2 | `CampaignTabletopEncounterDrawer.test.tsx` "Found multiple elements" for the reveal option (test queried the wrong list) | 3c20a8a0d "read the reveal option from the clicked actor's own list" |
| 38848770722, 38852788552 | ci/attack-9-t4 | `authoringNodeDefaultInventory` / Divine Smite parity (real) | slice fix |

Each failure is explained by a change in its own slice and went green after a related commit. The `Error: Unavailable` lines in the logs are expected console output of tests that assert the unavailable state, not failures. No flake was found, so no test or config fix is needed beyond the comment.

## Proof of three clean runs

| Merge batch | Run id | Web tests |
| --- | --- | --- |
| ci/merge-batch-c (1dfa8a6d8) | pending | pending |
| ci/merge-batch-d (8c3671f53) | pending | pending |
| third consecutive batch | pending | pending |
