# RULES UAT run <YYYY-MM-DD>

Copy to `docs/validation/uat/results/<YYYY-MM-DD>-RULES.md` (add `-<tester>` when several testers run it) and fill in. Result is PASS, FAIL, BLOCKED or SKIPPED; see [Recording results](../../README.md#recording-results). Scenarios: [RULES.md](../../RULES.md).

- Commit: <git rev-parse HEAD from setup step 3, or the staging build name>
- Review data: <the --name used in setup step 4, or staging>
- Testers: <who drove which accounts>

| Scenario    | Result | Notes | Evidence                                        |
| ----------- | ------ | ----- | ----------------------------------------------- |
| UAT-RULES-1 |        |       | local-validation/uat/<YYYY-MM-DD>/RULES-1-*.png |
| UAT-RULES-2 |        |       | local-validation/uat/<YYYY-MM-DD>/RULES-2-*.png |
| UAT-RULES-3 |        |       | local-validation/uat/<YYYY-MM-DD>/RULES-3-*.png |
| UAT-RULES-4 |        |       | local-validation/uat/<YYYY-MM-DD>/RULES-4-*.png |
| UAT-RULES-5 |        |       | local-validation/uat/<YYYY-MM-DD>/RULES-5-*.png |
