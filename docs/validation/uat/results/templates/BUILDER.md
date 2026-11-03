# BUILDER UAT run <YYYY-MM-DD>

Copy to `docs/validation/uat/results/<YYYY-MM-DD>-BUILDER.md` (add `-<tester>` when several testers run it) and fill in. Result is PASS, FAIL, BLOCKED or SKIPPED; see [Recording results](../../README.md#recording-results). Scenarios: [BUILDER.md](../../BUILDER.md).

- Commit: <git rev-parse HEAD from setup step 3, or the staging build name>
- Review data: <the --name used in setup step 4, or staging>
- Testers: <who drove which accounts>

| Scenario      | Result | Notes | Evidence                                          |
| ------------- | ------ | ----- | ------------------------------------------------- |
| UAT-BUILDER-1 |        |       | local-validation/uat/<YYYY-MM-DD>/BUILDER-1-*.png |
| UAT-BUILDER-2 |        |       | local-validation/uat/<YYYY-MM-DD>/BUILDER-2-*.png |
| UAT-BUILDER-3 |        |       | local-validation/uat/<YYYY-MM-DD>/BUILDER-3-*.png |
| UAT-BUILDER-4 |        |       | local-validation/uat/<YYYY-MM-DD>/BUILDER-4-*.png |
| UAT-BUILDER-5 |        |       | local-validation/uat/<YYYY-MM-DD>/BUILDER-5-*.png |
| UAT-BUILDER-6 |        |       | local-validation/uat/<YYYY-MM-DD>/BUILDER-6-*.png |
