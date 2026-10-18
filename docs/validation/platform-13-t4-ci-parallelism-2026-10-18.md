# PLATFORM-13.T4: CI test parallelism and Convex shard balance (2026-10-18)

**Status:** kept. Convex runs 2 file workers per shard, the Worker suite runs 4, and Convex shards are balanced by recorded file duration. Tests wall time dropped from 18–20 min to 10.5–12 min, with the same job count. How it works: [ci-validation.md › Parallelism and shard balance](../architecture/ci-validation.md#parallelism-and-shard-balance).

## Setup

- GitHub `ubuntu-latest` runners, workflow `tests.yml`, `-f full=true` dispatches on `ci/platform-13-t4` (base `codex/phase-08-2-convex-cutover` at `ffdfa9677`).
- Jobs per run are unchanged: build, 4 Convex shards, packages, Worker, web, 2 typechecks, lint, and red when it applies.
- Times are job wall times from the GitHub API (start to completion, including checkout and install). Run wall time is from run creation to its last job.

## Runs

| Run                                                                                                           | Setting                             | Convex shards 1/2/3/4 (min) | Worker (min) | Web (min) | Run wall | Result                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------- | ------------ | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [39162606645](https://github.com/MPiland/artificer-toolkit/actions/runs/39162606645) (baseline, a slice push) | Convex 1, Worker 1, hash shards     | 11.2 / 16.4 / 14.9 / 14.9   | 13.4         | 7.2       | 18.4     | green                                                                                                                                              |
| [39162983674](https://github.com/MPiland/artificer-toolkit/actions/runs/39162983674) (baseline, a slice push) | Convex 1, Worker 1, hash shards     | 13.7 / 17.4 / 16.0 / 14.6   | 13.7         | 5.9       | 19.8     | green                                                                                                                                              |
| [39166376927](https://github.com/MPiland/artificer-toolkit/actions/runs/39166376927)                          | Convex 2, Worker 2, hash shards     | 8.9 / 10.9 / 6.5 / 8.9      | 8.3          | 6.5       | 14.6     | tests green; Lint failed on the phase branch's unformatted ledger (auto-fix commit `fa3f5f0bb`), so this run doesn't count toward the clean streak |
| [39167678282](https://github.com/MPiland/artificer-toolkit/actions/runs/39167678282)                          | Convex 4, Worker 4, hash shards     | 9.1 / 6.6 / 8.0 / 8.6       | 5.7          | 8.9       | 11.3     | **Convex 4 rejected:** 3 timeouts in `campaigns/developmentCustody.test.ts` (shard 3). The Worker suite was clean                                  |
| [39168884911](https://github.com/MPiland/artificer-toolkit/actions/runs/39168884911)                          | Convex 2, Worker 4, duration shards | 9.3 / 6.5 / 9.1 / 10.4      | 6.9          | 10.2      | 11.9     | clean 1/3                                                                                                                                          |
| [39169874564](https://github.com/MPiland/artificer-toolkit/actions/runs/39169874564)                          | Convex 2, Worker 4, duration shards | 9.8 / 9.4 / 9.4 / 9.8       | 6.9          | 10.2      | 12.2     | clean 2/3                                                                                                                                          |
| [39170817276](https://github.com/MPiland/artificer-toolkit/actions/runs/39170817276)                          | Convex 2, Worker 4, duration shards | 7.1 / 7.8 / 7.1 / 7.6       | 5.6          | 8.8       | 10.5     | clean 3/3                                                                                                                                          |
| [39171847103](https://github.com/MPiland/artificer-toolkit/actions/runs/39171847103) (push, new defaults)     | Convex 2, Worker 4, duration shards | 6.7 / 9.3 / 9.0 / 9.9       | 5.8          | 10.2      | 11.9     | green; the push path picks up the defaults                                                                                                         |

The 4-worker failures were `executes the actual currency lifecycle…` at 152 s (120 s timeout), plus `recognizes actual public authored deletion receipts…` and `runs the public mixed Character custody driver…`, each over their 30 s timeouts. 8 workers was not tried: 4 already timed out, and the runner has 4 vCPUs.

No run swapped, ran out of memory or was cancelled by the runner. Peak memory was not measured, because the runners don't report it without an added sampling step.

## Margins at the kept setting

These are the slowest tests across the three clean runs, as a share of their own timeouts. The JSON reports are the `convex-report-*` artifacts of each run.

| Test                                                                                       | Timeout | Clean runs (s)        | Worst share |
| ------------------------------------------------------------------------------------------ | ------- | --------------------- | ----------- |
| `content/equipmentLimits.test.ts` › full-SRD 500-visible-option capacity journey           | 240 s   | 144.0 / 167.5 / 116.0 | 70%         |
| `characters/commitReferencedContext.test.ts` › complete-pool validation over the S5 corpus | 600 s   | 68.4 / 117.7 / 91.4   | 20%         |
| `content/seed.test.ts` › seeds the complete canonical corpus and replays                   | 240 s   | 99.0 / 88.6 / 72.3    | 41%         |
| `campaigns/developmentCustody.test.ts` › currency lifecycle                                | 120 s   | 88.4 / 76.0 / 56.5    | 74%         |
| `campaigns/developmentCustody.test.ts` › mixed Character custody driver                    | 30 s    | 24.5 / 21.1 / 16.8    | 82%         |
| `campaigns/developmentCustody.test.ts` › public authored deletion receipts                 | 30 s    | 23.4 / 19.4 / 12.8    | 78%         |

The two 30 s custody tests have the least headroom. They were 104 s for the whole file in the hash-shard run, and up to 180 s when they ran beside `seed.test.ts`. If they ever time out under this setting, the setting is wrong, not the timeout. Shrink those tests' work, as PLATFORM-13.T5 did.

## Shard balance

Vitest's `--shard` splits files by path hash. At 2 workers that left summed Convex test time of 692 / 929 / 556 / 770 s per shard (run 39166376927). `DurationSequencer` assigns files longest first to the least-loaded shard, using durations recorded from that run (`apps/apis/tests/convexFileDurations.json`, 402 files). The planned split is 737 s per shard.

Per-file time still moves with whatever file runs beside it. The heaviest journeys vary up to ±70 s between runs. Actual shard times ranged 537–915 s in clean run 1, then 9.4–9.8 min and 7.1–7.8 min of job time in clean runs 2 and 3.

## Worker suite isolation

The suite keeps `--no-isolate`, so files that share a worker share a workerd runtime. All 4 parallel runs (2 or 4 workers, 1,229 tests each) passed, with no unhandled errors. The room-alarm and retry lines in the logs are expected test output. The serial baseline prints more of them (1,056 vs 97).

## Remaining critical path

At the kept setting, Convex shards (7–10 min) and Web tests (6–10 min, unchanged) finish at about the same time. Web time varies with runner speed: the same 297 files took 340 s in one run and 553 s in another.

## PLATFORM-13.T15: web workers and isolation

Full dispatches on `ci/platform-13-t15` at the T4 settings (Convex 2, Worker 4). Before: the web Vitest step took 340–553 s and the Web job 8.8–10.2 min (T4 runs 39169874564, 39170817276, 39171847103), at 2 workers (`maxWorkers: '50%'`), isolated.

| Run                                                                                  | Web setting                | Vitest step | Web job (min) | Run wall (min) | Result                                    |
| ------------------------------------------------------------------------------------ | -------------------------- | ----------- | ------------- | -------------- | ----------------------------------------- |
| [39173494325](https://github.com/MPiland/artificer-toolkit/actions/runs/39173494325) | 2 workers, `isolate:false` | 232 s       | –             | cancelled      | **rejected:** 42 files, 182 tests failed  |
| [39174223509](https://github.com/MPiland/artificer-toolkit/actions/runs/39174223509) | 3 workers, isolated        | 426 s       | 8.2           | 11.9           | clean 1/3                                 |
| [39175129001](https://github.com/MPiland/artificer-toolkit/actions/runs/39175129001) | 3 workers, isolated        | 547 s       | 10.1          | 12.3           | clean 2/3                                 |
| [39176036156](https://github.com/MPiland/artificer-toolkit/actions/runs/39176036156) | 3 workers, isolated        | 574 s       | 10.7          | 12.7           | clean 3/3                                 |

- **`isolate:false` rejected.** Reusing one jsdom environment and module cache per worker halves the step, but `vi.mock` registrations and module state leak between files: missing Convex and QueryClient providers, mocks called 0 times, duplicate alerts. Making the suite isolation-safe is a test-hygiene migration across about 42 files, deferred to future enhancements.
- **3 workers not kept.** All three runs were clean, but the step (426–574 s) and job (8.2–10.7 min) times sit in or above the 2-worker range: on 4 vCPUs (2 physical cores) the third worker shares a core, as the config comment predicts. The config stays at `50%`. The `web_workers` dispatch input stays for future trials.
- **Convex 3 workers** waits on PLATFORM-13.T17. The two 30 s `developmentCustody` tests spend their time in the shared public drivers, not in test code, and 56% of that CPU is Zod parsing of the same few retained-rules and published Equipment documents on every query.
