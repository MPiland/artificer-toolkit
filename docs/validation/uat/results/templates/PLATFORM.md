# PLATFORM UAT run <YYYY-MM-DD>

Copy to `docs/validation/uat/results/<YYYY-MM-DD>-PLATFORM.md` (add `-<tester>` when several testers run it) and fill in. Result is PASS, FAIL, BLOCKED or SKIPPED; see [Recording results](../../README.md#recording-results). Scenarios: [PLATFORM.md](../../PLATFORM.md).

- Commit: <git rev-parse HEAD from setup step 3, or the staging build name>
- Review data: <the --name used in setup step 4, or staging>
- Testers: <who drove which accounts>

| Scenario       | Result | Notes | Evidence                                           |
| -------------- | ------ | ----- | -------------------------------------------------- |
| UAT-PLATFORM-1 |        |       | local-validation/uat/<YYYY-MM-DD>/PLATFORM-1-*.png |
| UAT-PLATFORM-2 |        |       | local-validation/uat/<YYYY-MM-DD>/PLATFORM-2-*.png |
| UAT-PLATFORM-3 |        |       | local-validation/uat/<YYYY-MM-DD>/PLATFORM-3-*.png |
| UAT-PLATFORM-4 |        |       | local-validation/uat/<YYYY-MM-DD>/PLATFORM-4-*.png |
| UAT-PLATFORM-5 |        |       | local-validation/uat/<YYYY-MM-DD>/PLATFORM-5-*.png |
