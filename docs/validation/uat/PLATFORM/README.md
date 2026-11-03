# Platform foundation — UAT scenarios

Feature `PLATFORM` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

PLATFORM is mostly infrastructure. What a tester can see is: the SRD content is present and browsable, images can be uploaded, viewed and removed with the right privacy, and account emails are requested from the app. Everything else is proved by its ledger tests and is listed under Covered elsewhere.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                            | Title                                                  |
| ------------- | ----- | ----------------------------------- | ------------------------------------------------------ |
| 22            | 1     | [UAT-PLATFORM-1](UAT-PLATFORM-1.md) | SRD content is present and browsable                   |
| 23            | 1     | [UAT-PLATFORM-2](UAT-PLATFORM-2.md) | Upload, replace and remove an avatar                   |
| 24            | 1     | [UAT-PLATFORM-3](UAT-PLATFORM-3.md) | Artwork is private to its owner until shared           |
| 25            | 1     | [UAT-PLATFORM-4](UAT-PLATFORM-4.md) | Password reset email is requested from the app         |
| 160           | 4     | [UAT-PLATFORM-5](UAT-PLATFORM-5.md) | A Concentration save shows its result on the roll card |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC             | Why not a UAT step                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLATFORM-2.1   | Schema, validator and index contract review.                                                                                                                                       |
| PLATFORM-2.2   | Static API type generation; a build property.                                                                                                                                      |
| PLATFORM-5.1   | Preservation of the 1,083 source files and 1,057 root UUIDs is a corpus check run by the seed audit.                                                                               |
| PLATFORM-5.3   | Import rollback and rejection of corrupt input; needs a deliberately broken corpus.                                                                                                |
| PLATFORM-5.4   | Internal HTTP endpoints denied; a network-level check run by tests.                                                                                                                |
| PLATFORM-5.5   | Cloud-dev CPU limit; measured by the harness.                                                                                                                                      |
| PLATFORM-5.6   | Manifest freshness check in the import audit.                                                                                                                                      |
| PLATFORM-5.7   | Per-mutation durations recorded by a loaded seed run.                                                                                                                              |
| PLATFORM-6.1   | Removal of the legacy local runtime (INTERNAL).                                                                                                                                    |
| PLATFORM-7.1   | Removal of Supabase (INTERNAL).                                                                                                                                                    |
| PLATFORM-8.1   | Removal of SQL, Kysely and migrations (INTERNAL).                                                                                                                                  |
| PLATFORM-9.1   | Removal of GoRules (INTERNAL).                                                                                                                                                     |
| PLATFORM-10.1  | Removal of tRPC and Netlify functions (INTERNAL).                                                                                                                                  |
| PLATFORM-11.1  | Backend test-suite realism (test doubles replaced by the real Worker); a property of the tests themselves.                                                                         |
| PLATFORM-12.1  | Web test-suite realism (fixtures parse through the real schemas); a property of the tests themselves.                                                                              |
| PLATFORM-13.2  | Native boundary audit script in CI.                                                                                                                                                |
| PLATFORM-13.4  | Test-suite reorganisation.                                                                                                                                                         |
| PLATFORM-13.5  | Dependency refresh.                                                                                                                                                                |
| PLATFORM-13.6  | Test timeout reliability under load.                                                                                                                                               |
| PLATFORM-13.7  | Test speed record.                                                                                                                                                                 |
| PLATFORM-13.8  | Test determinism under load.                                                                                                                                                       |
| PLATFORM-13.9  | Generated test usernames; a test-harness property.                                                                                                                                 |
| PLATFORM-13.10 | Test log noise.                                                                                                                                                                    |
| PLATFORM-13.11 | Live-backend validation on GitHub Actions.                                                                                                                                         |
| PLATFORM-13.12 | Local Convex runner environment handling.                                                                                                                                          |
| PLATFORM-13.13 | Developer workflow for running tests.                                                                                                                                              |
| PLATFORM-13.14 | Validation lock reclaim.                                                                                                                                                           |
| PLATFORM-13.15 | CI journey log upload.                                                                                                                                                             |
| PLATFORM-14.1  | Web test reliability.                                                                                                                                                              |
| PLATFORM-14.2  | Test folder rename.                                                                                                                                                                |
| PLATFORM-14.3  | TanStack Start and Storybook upgrade; the app working at all is shown by every other file.                                                                                         |
| PLATFORM-16.1  | Removal of a Convex table.                                                                                                                                                         |
| PLATFORM-16.2  | Documentation of the removal.                                                                                                                                                      |
| PLATFORM-17.1  | Test fixture typing.                                                                                                                                                               |
| PLATFORM-17.2  | Shared test-fixture builder.                                                                                                                                                       |
| PLATFORM-17.3  | Test-double audit.                                                                                                                                                                 |
| PLATFORM-18.1  | Seeding a changed corpus N+1 over N needs two different corpus builds on a live backend; a live-backend CI run, not reproducible from the review data.                             |
| PLATFORM-18.2  | Same, for definitions, Systems and catalogues.                                                                                                                                     |
| PLATFORM-19.1  | CI auto-fix of generated-file drift.                                                                                                                                               |
| PLATFORM-20.1  | Dead compiler code deleted.                                                                                                                                                        |
| PLATFORM-20.2  | Copy-only compilers deleted.                                                                                                                                                       |
| PLATFORM-20.3  | Flat modifier grant compile shape; a type and contract change.                                                                                                                     |
| PLATFORM-20.4  | Documentation.                                                                                                                                                                     |
| PLATFORM-21.2  | Stale compiled projection migration; development data is migrated in the change, so nothing stale exists in the review data to observe.                                            |
| PLATFORM-22.1  | CI timing for type errors.                                                                                                                                                         |
| PLATFORM-22.2  | Worker test-harness error reporting.                                                                                                                                               |
| PLATFORM-22.3  | Merge fast path, proved by tree identity.                                                                                                                                          |
| PLATFORM-22.4  | CI red/green proof job.                                                                                                                                                            |
| PLATFORM-23.1  | CI test selection.                                                                                                                                                                 |
| PLATFORM-23.2  | Parity tests fixed; CI result.                                                                                                                                                     |
| PLATFORM-23.3  | Local typecheck lane (since retired in AGENTS.md).                                                                                                                                 |
| PLATFORM-23.4  | Local scoped-test build lane.                                                                                                                                                      |
| PLATFORM-24.1  | Rejection of a tampered frozen graph on resume needs forged stored data; a tester sees only the honest pause-and-resume path, exercised in [UAT-RULES-3](../RULES/UAT-RULES-3.md). |
| PLATFORM-24.2  | Removal of the continuation signing key from code, env and docs.                                                                                                                   |
| PLATFORM-25.1  | CI formatting and lint auto-fix.                                                                                                                                                   |
| PLATFORM-25.2  | CI merge-slice workflow.                                                                                                                                                           |
| PLATFORM-25.3  | CI batch merge.                                                                                                                                                                    |
| PLATFORM-25.4  | CI run-id handling.                                                                                                                                                                |
