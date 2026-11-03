# Phase 8 UAT: start here

User acceptance tests for the 21 Phase 8 features in the [phase ledger](../../roadmap/08-phase-ledger.json). A non-engineer runs each scenario by hand on the local build, as a GM and up to three players at the same live table. The automated tests prove each acceptance criterion (AC) in isolation; these scenarios prove the pieces work together in real play. Passing them moves a feature from UAT_READY to accepted.

UAT is not tracked work: there are no PBIs or tasks for it. The ledger holds one `uat` item per scenario, and an item becomes PASSED only after the owner accepts it with the evidence described in [Recording results](#recording-results).

**Run the path in [TRACKER.md](TRACKER.md).** Read the [alpha play guide](../../guides/alpha-play-guide.md) first: it explains every live-table control the scenarios use, and its [known gaps](../../guides/alpha-play-guide.md#known-gaps) are not failures. The operator prepares the build ([OPERATOR.md](OPERATOR.md)); you start at the first scenario.

## The path in levels

One scenario per file, in folders named after their feature. Run them in tracker order; no scenario depends on a later one.

| Level | Name                                 | Scenarios | First scenario                                        |
| ----- | ------------------------------------ | --------- | ----------------------------------------------------- |
| 0     | Orientation and exploratory tasks    | 8         | [UAT-ORIENTATION-1](ORIENTATION/UAT-ORIENTATION-1.md) |
| 1     | Single-user basics                   | 41        | [UAT-ACCOUNTS-1](ACCOUNTS/UAT-ACCOUNTS-1.md)          |
| 2     | GM setup                             | 24        | [UAT-CAMPAIGN-1](CAMPAIGN/UAT-CAMPAIGN-1.md)          |
| 3     | Core play                            | 63        | [UAT-CAMPAIGN-8](CAMPAIGN/UAT-CAMPAIGN-8.md)          |
| 4     | Advanced play                        | 40        | [UAT-ENCOUNTER-6](ENCOUNTER/UAT-ENCOUNTER-6.md)       |
| 5     | Reliability, performance and release | 12        | [UAT-RELIABILITY-5](RELIABILITY/UAT-RELIABILITY-5.md) |

- **Level 0, Orientation and exploratory tasks:** Sign in to every review account and find the Campaigns, then open-ended tasks that test whether the product explains itself. Read no scenario file first for the exploratory tasks.
- **Level 1, Single-user basics:** One account at a time: accounts, uploads, authoring, the Character Builder and the Sheet. Nobody else needs to be present.
- **Level 2, GM setup:** The GM builds a Campaign, seats the party, makes Scenes, Encounters and Blueprints. This creates the Sandbox Campaign that later levels reuse.
- **Level 3, Core play:** The live table with several people: rooms, attacks, movement, privacy, reactions and reliability on the review Campaigns.
- **Level 4, Advanced play:** Encounter lifecycle and optional rules, then the long spell and rules journeys that replace the Party's Characters.
- **Level 5, Reliability, performance and release:** Account recovery and deletion, plan limits, the release checklist, and staging-only performance last.

## One pass

Run the scenarios once, in order. Every scenario lists its **Prerequisites**: what the review data provides, which earlier scenario you must have finished, or which file in [assets](assets/) to use. A scenario that changes shared state ends with restore steps (R1, R2 …) that put it back through the normal controls, so the next scenario finds what it expects. If a scenario fails halfway, the GM puts the shared state back by hand (re-seat players, remove added tokens and zones, set settings back) before you continue; if that is impossible, mark the scenarios that depend on it BLOCKED. Resetting the review data is an operator action for the start of a new pass, never a step in a scenario.

## Recording results

- Fill in the **Result** block at the end of the scenario's file: **Status** (NOT RUN, PASSED, FAILED, BLOCKED or SKIPPED), **Date**, **Build** (the git commit for a local run, or the staging build name the owner gave), **Tester**, **Failed step**, and **Notes**.
- Then tick the scenario in the [tracker](TRACKER.md) and set the same status there.
- **PASSED** means every Expected line and every "Other users see" line held. Take at least one screenshot per scenario of its final state, and one per player window in multi-user scenarios; screenshots stay in the ignored `local-validation/uat/<YYYY-MM-DD>/` folder.
- A behaviour listed in the play guide's known gaps is not a failure; note it only if it hurt the session.
- When the owner accepts a feature, the orchestrator sets each of its ledger `uat` items to PASSED with the tracker as evidence.

### When a scenario fails

The Result block names the date, the build (commit or staging build name), the tester and the step number, and gives the details the [play guide's feedback list](../../guides/alpha-play-guide.md#sending-feedback) asks for: Campaign, Scene, round and turn, mode and auto-roll, expected, actual with the exact wording of any message, and whether it repeats. Every failure is fixed or registered in the ledger before the feature is accepted.

## Accounts

The review data creates seven local-only accounts. Sign in at http://localhost:3000/sign-in with **Email or username** and the shared review password, which is the `REVIEW_PASSWORD` constant in [developmentReviewDataScenarios.ts](../../../apps/apis/tests/developmentReviewDataScenarios.ts). It exists only on the local Docker backend and guards nothing.

| Name in scenarios | Username           | Email                              | Role in the review data                                                    |
| ----------------- | ------------------ | ---------------------------------- | -------------------------------------------------------------------------- |
| **GM**            | `Review_Gm_Rowan`  | `review_gm_rowan@example.invalid`  | GM of all four review Campaigns; GM plan tier                              |
| **P1**            | `Review_Pl_Aria`   | `review_pl_aria@example.invalid`   | Player: Aria (Party in the Field), Ember (Shield and Hold), Iris (Sandbox) |
| **P2**            | `Review_Pl_Bryn`   | `review_pl_bryn@example.invalid`   | Player: Bryn (Party in the Field), Pyra (Fire and Thunder), Juno (Sandbox) |
| **P3**            | `Review_Pl_Cade`   | `review_pl_cade@example.invalid`   | Player: Cade (Party in the Field), Kit (Sandbox)                           |
| **SUPERADMIN**    | `Review_Admin_Sol` | `review_admin_sol@example.invalid` | Superadmin (promoted with `authAdmin:setRole`); member of no Campaign      |
| **SPARE1**        | `Review_Pl_Dara`   | `review_pl_dara@example.invalid`   | Player outside every Campaign; free plan tier                              |
| **SPARE2**        | `Review_Pl_Eli`    | `review_pl_eli@example.invalid`    | Player outside every Campaign; free plan tier                              |

The GM and P1 to P3 each need a browser profile for most scenarios; sign the SUPERADMIN or a spare in to a fifth profile, or sign out of one of the four, when a scenario names them. Never delete the GM, P1 to P3 or the SUPERADMIN: account-deletion scenarios delete a spare.

After the review-data run every account has **Roll my dice automatically** switched **off** (Settings, Preferences, or the **Auto-roll** switch in the tabletop header), so rolls raise a prompt where you can choose **Roll dice** or type physical dice. A scenario that needs auto-roll on says so.

Public sign-up is closed. A spare joins a Campaign without email: the GM invites it by username from a listing and the spare accepts in the app. Steps that read an email (an invitation link, a confirmation link, a reset code) use [local email](README.md#reading-local-email).

The spare accounts are consumed in order: SPARE2 joins one Campaign for [EXPLORATORY-4](EXPLORATORY/EXPLORATORY-4.md) and is removed again; SPARE1 stays outside every Campaign until [ACCOUNTS-12](ACCOUNTS/UAT-ACCOUNTS-12.md) deletes it, and SPARE2 is deleted last, by [RELIABILITY-13](RELIABILITY/UAT-RELIABILITY-13.md).

## Running several users side by side

Each account needs its own browser session, because sign-in is a cookie on `localhost:3000`.

- Use **separate browser profiles**, not tabs: for example Chrome profiles named "UAT GM", "UAT P1" and "UAT P2", and Edge or Firefox for P3. Private or incognito windows of one browser share one session, so they count as one profile at most.
- Tile the windows so the GM window and at least one player window are visible at once. Scenarios list what every other window must show, and what it must **not** show (hidden tokens, GM private rolls, other players' private data).
- One person can drive all four windows. Helpers can join only on this machine: the local build is not reachable from other devices, including phones.
- **Mobile width**: open the browser's developer tools, turn on the device toolbar and pick a 375-pixel-wide phone. Real phones cannot reach the local build.
- **Dropped connection**: in developer tools, open the Network panel and set throttling to **Offline**, then back to **No throttling**; or close the tab and reopen the page.
- Each step names who acts, for example "3. **P1:** ...". When a step says "at the same time", have two windows ready and click within a second or two of each other.

## Reading local email

The local build sends no real email. Password-reset codes, email-change and verification links, invitations and notification emails go to the local email sink, which keeps the newest 50 messages. To read them:

1. Run `pwsh -NoProfile -File scripts/localConvexFixtures.ps1 -Action mail`. It replaces the ignored `local-validation/local-email/` folder with the sink's current messages and prints how many it copied.
2. Open the newest file for the recipient in a browser. Each file is named `<received time>-<sequence>-<recipient>.html` and starts with the **To** and **Subject** lines, then the email as sent, then its plain-text version (which also shows any code).

Run the command again after each step that sends an email. The sink keeps messages until the local container is recreated; older ones are dropped once there are more than 50. The first `localConvexFixtures.ps1 -Action start` after updating to this sink restarts the local fixtures, which also clears map uploads held by the local R2 substitute.

An account invitation has no app screen: it is issued by the internal `authInvitations:issue` function. To send one to a new address, run `node apps/apis/scripts/convexRunLocal.mjs authInvitations:issue '{"email":"<new address>@example.invalid","token":"<64 hex characters>"}'` (make a token with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`), then read the invitation email as above.

## External testers (staging)

A few outside testers run the same scenario files on staging, each with their own account.

- **Accounts:** public sign-up is closed, so each tester gets an invited account (an invitation issued by the owner). Accounts are never shared between testers, and the local review accounts and the `REVIEW_PASSWORD` constant do not exist on staging.
- **Staging URL:** provided by the owner. Do not guess or reuse a URL from another document.
- **Approval:** a staging run needs the owner's approval each time (the same rule as every other staging check; see G4 in [Known UAT gaps](OPERATOR.md#known-uat-gaps) and the [release sequence](../../runbooks/phase-8-2-release.md)). Do not start one without it.
- **Setup:** an external tester skips the operator steps (reset, seed, review data) and starts at step 6 of [Setup](OPERATOR.md#setup). The steps that need several signed-in users still need several browser profiles per [Running several users side by side](#running-several-users-side-by-side); a scenario that names accounts the tester does not have (GM, P1 to P3) is run with the testers' own invited accounts in those roles, as the owner assigns them.
- **Recording:** as in [Recording results](#recording-results), with the staging build name the owner gives in place of the git commit, and the tester's name in each run note.

## Coverage

[COVERAGE.md](COVERAGE.md) lists, for every AC in the ledger, the scenarios that check it.
