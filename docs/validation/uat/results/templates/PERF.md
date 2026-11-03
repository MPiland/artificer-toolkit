# PERF UAT run <YYYY-MM-DD>

Copy to `docs/validation/uat/results/<YYYY-MM-DD>-PERF.md` (add `-<tester>` when several testers run it) and fill in. Result is PASS, FAIL, BLOCKED or SKIPPED; see [Recording results](../../README.md#recording-results). Scenarios: [PERF.md](../../PERF.md).

- Commit: <git rev-parse HEAD from setup step 3, or the staging build name>
- Review data: staging (these scenarios run only on an approved staging smoke, gap G4)
- Testers: <who drove which accounts>

| Scenario   | Result | Notes | Evidence                                       |
| ---------- | ------ | ----- | ---------------------------------------------- |
| UAT-PERF-1 |        |       | local-validation/uat/<YYYY-MM-DD>/PERF-1-*.png |
| UAT-PERF-2 |        |       | local-validation/uat/<YYYY-MM-DD>/PERF-2-*.png |
