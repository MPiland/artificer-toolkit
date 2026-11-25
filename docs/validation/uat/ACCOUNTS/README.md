# Accounts — UAT scenarios

Feature `ACCOUNTS` in the [phase ledger](../../../roadmap/08-phase-ledger.json).

Proves a GM and players can sign in and out safely, that signing out ends every tab of your own account and nobody else's, that strangers cannot sign up or read private profiles, and that usernames and account deletion follow the rules. Accounts here: see [README](../README.md#roles-and-accounts).

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in. Set the Status column to the same result (PASSED, FAILED, BLOCKED or SKIPPED) so you can see where you left off.

| Path position | Level | Scenario                              | Title                                                                  | Status  |
| ------------- | ----- | ------------------------------------- | ---------------------------------------------------------------------- | ------- |
| 2             | 1     | [UAT-ACCOUNTS-1](UAT-ACCOUNTS-1.md)   | Sign in, reload, sign out, sign back in by username                    | PASSED  |
| 3             | 1     | [UAT-ACCOUNTS-2](UAT-ACCOUNTS-2.md)   | Wrong password and unknown account are refused                         | PASSED  |
| 4             | 1     | [UAT-ACCOUNTS-4](UAT-ACCOUNTS-4.md)   | Public sign-up is closed                                               | PASSED  |
| 5             | 1     | [UAT-ACCOUNTS-6](UAT-ACCOUNTS-6.md)   | Create an account from an invitation                                   | NOT RUN |
| 6             | 1     | [UAT-ACCOUNTS-5](UAT-ACCOUNTS-5.md)   | Reset a forgotten password (wrong code, mismatch, then success)        | NOT RUN |
| 7             | 1     | [UAT-ACCOUNTS-14](UAT-ACCOUNTS-14.md) | Change your password in Account Settings                               | NOT RUN |
| 8             | 1     | [UAT-ACCOUNTS-15](UAT-ACCOUNTS-15.md) | Change your email in Account Settings                                  | NOT RUN |
| 9             | 1     | [UAT-ACCOUNTS-7](UAT-ACCOUNTS-7.md)   | Choose, change and protect a username                                  | NOT RUN |
| 10            | 1     | [UAT-ACCOUNTS-13](UAT-ACCOUNTS-13.md) | Campaign text follows the same language rules as usernames             | NOT RUN |
| 11            | 1     | [UAT-ACCOUNTS-8](UAT-ACCOUNTS-8.md)   | Private profiles stay private; Public profiles show only public fields | NOT RUN |
| 12            | 1     | [UAT-ACCOUNTS-3](UAT-ACCOUNTS-3.md)   | Sign-out ends every tab of your account and nobody else's              | NOT RUN |
| 13            | 1     | [UAT-ACCOUNTS-9](UAT-ACCOUNTS-9.md)   | Ordinary users cannot use superadmin tools                             | NOT RUN |
| 14            | 1     | [UAT-ACCOUNTS-10](UAT-ACCOUNTS-10.md) | Superadmin moderation                                                  | NOT RUN |
| 190           | 5     | [UAT-ACCOUNTS-11](UAT-ACCOUNTS-11.md) | Refused account deletions                                              | NOT RUN |
| 195           | 5     | [UAT-ACCOUNTS-12](UAT-ACCOUNTS-12.md) | Delete my account, shared history survives                             | NOT RUN |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC           | Why not a UAT step                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACCOUNTS-1.3 | Absence of legacy tRPC/Supabase requests and exact test-account cleanup; needs request inspection, run by the browser journey.                           |
| ACCOUNTS-1.4 | Typing before hydration completes; needs a blocked-hydration test hook, run by the browser journey. A tester cannot pause hydration.                     |
| ACCOUNTS-4.1 | Invitations are issued only by the internal CLI with hashed tokens; there is no UI to see. Redemption is covered by [UAT-ACCOUNTS-6](UAT-ACCOUNTS-6.md). |
| ACCOUNTS-4.3 | Deployed HTTP origin and foreign-origin denial; a network-level test against a deployment.                                                               |
| ACCOUNTS-4.4 | Concurrent invitation redemption on personal dev; a harness run.                                                                                         |
| ACCOUNTS-8.1 | Native-client request authorization and spoofed user IDs; contract test (the browser-visible part is [UAT-ACCOUNTS-8](UAT-ACCOUNTS-8.md)).               |
| ACCOUNTS-9.1 | Role provisioning is the internal CLI only; there is no UI.                                                                                              |
| ACCOUNTS-9.3 | Provider-admin endpoints answer 404 to POST requests; a browser address bar sends GET, so a tester cannot exercise them.                                 |
