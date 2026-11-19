# Release candidate 2026-11-18: CI evidence record

**Status:** this is the D213 pre-staging correctness gate for the release candidate cut once Phase 8 development work was complete (MOVE-1 closed at m889). It supersedes [release-candidate-2026-11-17](release-candidate-2026-11-17.md) as the source to promote. Latency is not gated here (D210). It gates on staging (PERF-2), so this record carries no timing tables. The 2026-11-17 record's V15 figures remain the latest recorded baseline.

## Source identity

- RC branch: `ci/rc-2026-11-18`, sha `45e78786b7df7b1eb0656e57a4cb9303da723ba2`. This is the phase branch tip after the m889 ledger commit ("Ledger: m889 MOVE-1.T1c done; MOVE-1 closed; fixture hygiene parked").
- No product code changed to produce this record.

## Runs on the RC sha

| Workflow                       | Run                                                                                  | Result             |
| ------------------------------ | ------------------------------------------------------------------------------------ | ------------------ |
| Tests (`full=true`)            | [44464641725](https://github.com/MPiland/artificer-toolkit/actions/runs/44464641725) | green on attempt 1 |
| Live backend                   | [44464665112](https://github.com/MPiland/artificer-toolkit/actions/runs/44464665112) | green on attempt 1 |
| Browser journeys (every proof) | [44464647842](https://github.com/MPiland/artificer-toolkit/actions/runs/44464647842) | green on attempt 1 |

The push to the RC branch also started the affected-only Tests (44464635659) and Browser journeys (44464635616) runs. The dispatched runs above are the gate.

## Not run here

- `v15-workload` is record-only and outside the CI proof list. Staging measures it (PERF-2).
