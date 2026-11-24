# Phase 8 UAT: start here

User acceptance tests for the 21 Phase 8 features in the [phase ledger](../../roadmap/08-phase-ledger.json). Testers run each scenario by hand on **staging** and record what they saw. The automated tests prove each acceptance criterion (AC) in isolation; these scenarios prove the pieces work together in real play. Passing them moves a feature from UAT_READY to accepted.

UAT is not tracked work: there are no PBIs or tasks for it. The ledger holds one `uat` item per scenario, and an item becomes PASSED only after the owner accepts it with the evidence described in [Recording results](TESTERS.md#recording-results).

## Start

- **Staging address:** `<STAGING_URL>`. Every scenario writes the address this way; the owner tells you the real one. Read the [alpha play guide](../../guides/alpha-play-guide.md) first: it explains every live-table control the scenarios use, and its [known gaps](../../guides/alpha-play-guide.md#known-gaps) are not failures.
- **Starting point.** The accounts GM and P1 to P5 exist and are verified, and nothing else does: no Campaigns, no Characters, no Scenes. The scenarios build everything else through the product, in order. Scenarios name roles only.
- **Testers.** Follow the [tester guide](TESTERS.md): what the owner sends you, signing in, creating your own account, real email checks, the run order and recording results.
- **Your own account.** The account-security scenarios (sign-up, forgotten password, password and email change, deletion) run on an account you create yourself with your own email address (OWN), so they never touch the GM and P1 to P5 accounts.
- **The tracker.** Open [TRACKER.md](TRACKER.md): it lists every scenario in run order.

## Solo and Group

- **Solo** scenarios need one role. Other roles that only observe are checked afterwards by the owner (the scenario's Cross-role check). You run them signed in to one account in your normal browser. Some Solo scenarios and all exploratory tasks also need a **facilitator**, the owner acting as the GM or another player, who follows a numbered script with trigger points ("when the tester says their Character is ready, add it to the Encounter"). You never act as two roles.
- **Group** scenarios need two or more roles to act at the same live table (146 of 191). Each role needs its own signed-in browser, whether one person drives them all or one person plays each role.

| Level | Name                                 | Solo | Group | First scenario                                        |
| ----- | ------------------------------------ | ---- | ----- | ----------------------------------------------------- |
| 0     | Orientation                          | 1    | 0     | [UAT-ORIENTATION-1](ORIENTATION/UAT-ORIENTATION-1.md) |
| 1     | Single-user basics                   | 36   | 9     | [UAT-ACCOUNTS-1](ACCOUNTS/UAT-ACCOUNTS-1.md)          |
| 2     | GM setup                             | 4    | 21    | [UAT-CAMPAIGN-1](CAMPAIGN/UAT-CAMPAIGN-1.md)          |
| 3     | Core play                            | 4    | 66    | [UAT-CAMPAIGN-8](CAMPAIGN/UAT-CAMPAIGN-8.md)          |
| 4     | Advanced play                        | 0    | 40    | [UAT-ENCOUNTER-6](ENCOUNTER/UAT-ENCOUNTER-6.md)       |
| 5     | Reliability, performance and release | 0    | 10    | [UAT-RELIABILITY-5](RELIABILITY/UAT-RELIABILITY-5.md) |

- **Level 0, Orientation:** Sign in with your account and look around.
- **Level 1, Single-user basics:** One account at a time: your own account (sign-up, password reset, username), uploads, authoring, the Character Builder and the Sheet.
- **Level 2, GM setup:** The GM builds The Campaign, seats the party, makes Scenes, Encounters and Blueprints.
- **Level 3, Core play:** The live table with several people: rooms, attacks, movement, privacy, reactions and reliability, plus the open-ended exploratory tasks that test whether the product explains itself (read no scenario file first for those).
- **Level 4, Advanced play:** Encounter lifecycle and optional rules, then the long spell and rules journeys that replace the party's Characters.
- **Level 5, Reliability, performance and release:** Plan limits, the release checklist and performance, ending with deleting your own account.

## Roles and accounts

| Role                   | Used for                                                                             | Plan tier  |
| ---------------------- | ------------------------------------------------------------------------------------ | ---------- |
| **GM**                 | Hosts The Campaign                                                                   | Free       |
| **P1** to **P4**       | Players seated in The Campaign (P1 Aria, P2 Bryn, P3 Cade); P3 and P4 host their own | Free       |
| **P5**                 | Starts in no Campaign; joins, hosts and is deleted late in the pass                  | Free       |
| **SUPERADMIN**         | Owner-only moderation scenarios                                                      | Superadmin |
| **OWN**                | The account you create yourself with your own email address                          | Free       |

All accounts are on the FREE plan unless listed otherwise: 1 active hosted Campaign per account, 5 player seats per Campaign, 5 Scenes per Campaign and 6 personal Characters per account. Every scenario keeps within those limits and says what it deletes to stay there.

Every account has **Roll my dice automatically** switched **off** unless a scenario says otherwise (Settings, Preferences, or the **Auto-roll** switch in the tabletop header), so rolls raise a prompt where you can choose **Roll dice** or type physical dice. Public sign-up is closed: a new account needs an invitation from the owner.

## One pass

Run the scenarios once, in tracker order. Every scenario lists its **Prerequisites**: which earlier scenario you must have finished, or which file in [assets](assets/) to use. A scenario that changes shared state ends with restore steps (R1, R2 ...) that put it back through the normal controls, and a scenario that destroys or consumes data says what it consumes. If a scenario fails halfway, put the shared state back by hand; if that is impossible, mark the scenarios that depend on it BLOCKED. There is no reset inside a pass.

Owner testing tip: each account needs its own cookies, so use one browser profile (or one named container) per account and keep each signed in for the whole pass. Steps switch roles by switching windows, never by signing out.
## Coverage

[COVERAGE.md](COVERAGE.md) lists, for every AC in the ledger, the scenarios that check it.
