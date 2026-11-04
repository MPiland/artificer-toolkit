# Phase 8 UAT: start here

User acceptance tests for the 21 Phase 8 features in the [phase ledger](../../roadmap/08-phase-ledger.json). Testers run each scenario by hand on **staging** and record what they saw. The automated tests prove each acceptance criterion (AC) in isolation; these scenarios prove the pieces work together in real play. Passing them moves a feature from UAT_READY to accepted.

UAT is not tracked work: there are no PBIs or tasks for it. The ledger holds one `uat` item per scenario, and an item becomes PASSED only after the owner accepts it with the evidence described in [Recording results](TESTERS.md#recording-results).

## Start

- **Staging address:** `<STAGING_URL>`. Every scenario writes the address this way; the owner tells you the real one. Read the [alpha play guide](../../guides/alpha-play-guide.md) first: it explains every live-table control the scenarios use, and its [known gaps](../../guides/alpha-play-guide.md#known-gaps) are not failures.
- **Testers.** Follow the [tester guide](TESTERS.md): what the owner sends you, signing in to your set, creating your own account, real email checks, the Solo run order and recording results.
- **Your set.** The owner gives each tester a numbered set: five prebuilt accounts (GM, P1, P2, P3, SPARE) and your own copy of the four review Campaigns. Scenarios name roles only.
- **Your own account.** The account-security scenarios (sign-up, forgotten password, password and email change, deletion) run on an account you create yourself with your own email address, so they never touch the prebuilt accounts.
- **The tracker.** Open [TRACKER.md](TRACKER.md): it lists what you were assigned. The owner prepares everything else ([OPERATOR.md](OPERATOR.md)).

## Solo and Group

- **Solo** scenarios need one role. Other roles that only observe are checked afterwards by the owner (the scenario's Cross-role check, listed as an owner follow-up in the tracker). You run them signed in to one account in your normal browser: one prebuilt account from your set, or your own account for the account-security scenarios. Some Solo scenarios and all exploratory tasks also need a **facilitator**, the owner acting as the GM or another player, who follows a numbered script with trigger points ("when the tester says their Character is ready, add it to the Encounter"). You never act as two roles.
- **Group** scenarios need two or more roles to act at the same live table (137 of 190). The owner runs them alone, one browser profile per role ([Role setup](#role-setup-for-the-owner)), in the session agendas at the end of the tracker.

| Level | Name                                 | Solo | Group | First scenario                                        |
| ----- | ------------------------------------ | ---- | ----- | ----------------------------------------------------- |
| 0     | Orientation and exploratory tasks    | 8    | 0     | [UAT-ORIENTATION-1](ORIENTATION/UAT-ORIENTATION-1.md) |
| 1     | Single-user basics                   | 37   | 8     | [UAT-ACCOUNTS-1](ACCOUNTS/UAT-ACCOUNTS-1.md)          |
| 2     | GM setup                             | 4    | 20    | [UAT-CAMPAIGN-1](CAMPAIGN/UAT-CAMPAIGN-1.md)          |
| 3     | Core play                            | 3    | 60    | [UAT-CAMPAIGN-8](CAMPAIGN/UAT-CAMPAIGN-8.md)          |
| 4     | Advanced play                        | 0    | 40    | [UAT-ENCOUNTER-6](ENCOUNTER/UAT-ENCOUNTER-6.md)       |
| 5     | Reliability, performance and release | 1    | 9     | [UAT-RELIABILITY-5](RELIABILITY/UAT-RELIABILITY-5.md) |

- **Level 0, Orientation and exploratory tasks:** Sign in with your account and find your Campaigns, then open-ended tasks that test whether the product explains itself (read no scenario file first for those).
- **Level 1, Single-user basics:** One account at a time: your own account (sign-up, password reset, username), uploads, authoring, the Character Builder and the Sheet.
- **Level 2, GM setup:** The GM builds a Campaign, seats the party, makes Scenes, Encounters and Blueprints. This creates the Sandbox Campaign that later levels reuse.
- **Level 3, Core play:** The live table with several people: rooms, attacks, movement, privacy, reactions and reliability on the review Campaigns.
- **Level 4, Advanced play:** Encounter lifecycle and optional rules, then the long spell and rules journeys that replace the Party's Characters.
- **Level 5, Reliability, performance and release:** Plan limits, the release checklist and performance, ending with deleting your own account.

## Roles and accounts

| Role                   | Used for                                                        | Plan tier  |
| ---------------------- | --------------------------------------------------------------- | ---------- |
| **GM**                 | Owns the four review Campaigns                                  | GM         |
| **P1**, **P2**, **P3** | Players in those Campaigns                                      | Free       |
| **SPARE**              | A player in no Campaign, for invitation and join scenarios      | Free       |
| **SUPERADMIN**         | Owner-only moderation scenarios                                 | Superadmin |
| **OWN**                | The account you create yourself with your own email address     | Free       |
| **DISPOSABLE**         | A throwaway account the owner creates for one deletion scenario | Free       |

### Roles and what each sees

| Role      | Campaigns                                                                                              | Characters        |
| --------- | ------------------------------------------------------------------------------------------------------ | ----------------- |
| **GM**    | Review: Party in the Field, Review: Shield and Hold, Review: Fire and Thunder, Review: Sandbox (as GM) | none of its own   |
| **P1**    | Party in the Field, Shield and Hold, Sandbox                                                           | Aria, Ember, Iris |
| **P2**    | Party in the Field, Fire and Thunder, Sandbox                                                          | Bryn, Pyra, Juno  |
| **P3**    | Party in the Field, Sandbox                                                                            | Cade, Kit         |
| **SPARE** | none                                                                                                   | none              |

After the review data is built every account has **Roll my dice automatically** switched **off** (Settings, Preferences, or the **Auto-roll** switch in the tabletop header), so rolls raise a prompt where you can choose **Roll dice** or type physical dice. A scenario that needs auto-roll on says so. Public sign-up is closed: a new account needs an invitation from the owner.

## One pass

Run the scenarios once, in tracker order. Every scenario lists its **Prerequisites**: what your set provides, which earlier scenario you must have finished, or which file in [assets](assets/) to use. A scenario that changes shared state ends with restore steps (R1, R2 …) that put it back through the normal controls, and a scenario that destroys or consumes data says what it consumes. If a scenario fails halfway, put the shared state back by hand; if that is impossible, mark the scenarios that depend on it BLOCKED. The owner can rebuild your set between rounds. There is no reset inside a pass.

## Role setup for the owner

Only the owner (and a facilitator) needs this; a Solo tester uses one normal browser.

Use either setup. Each role needs its own cookies and storage, kept for the whole pass.

- **Firefox containers (one window):** install the Multi-Account Containers extension and create one named container per role (GM, P1, P2, P3, SPARE) plus one for the tester's own account. Open each role's tab in its container, sign in once and keep it signed in. Colour the containers so the tab strip shows who is who.
- **Browser profiles:** create one Chrome or Edge profile per role, plus one for the tester's own account, and sign each in once.
- Temporary Containers (a Firefox extension) suit only a one-off new-user step, such as redeeming an invitation as a fresh visitor: a temporary container deletes its sign-in when its last tab closes, so never use one for a role.
- A private window gives only one extra sign-in per browser, so it is not enough on its own.
- Each scenario's **Roles used** line lists which profiles to open. Steps switch roles by switching windows, never by signing out.
- On a facilitated scenario, do only what the numbered script says, when its trigger happens, and do not explain controls.

## Coverage

[COVERAGE.md](COVERAGE.md) lists, for every AC in the ledger, the scenarios that check it.
