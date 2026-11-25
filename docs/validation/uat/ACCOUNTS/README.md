# Accounts — UAT scenarios

Feature `ACCOUNTS` in the [phase ledger](../../../roadmap/08-phase-ledger.json).

Proves a GM and players can sign in and out safely, that signing out ends every tab of your own account and nobody else's, that strangers cannot sign up or read private profiles, and that usernames and account deletion follow the rules. Accounts here: see [README](../README.md#roles-and-accounts).

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
