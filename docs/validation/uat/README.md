# Phase 8 UAT scenarios

User acceptance tests for the 21 Phase 8 features in the [phase ledger](../../roadmap/08-phase-ledger.json). Each feature has one file of scenarios that a non-engineer runs by hand on the local build, as a GM and up to three players at the same live table. Passing them is what moves a feature from UAT_READY to accepted: the automated tests prove each acceptance criterion (AC) in isolation, and these scenarios prove the pieces work together in real play.

UAT is not tracked work: there are no PBIs or tasks for it. The ledger holds one `uat` item per scenario, and an item becomes PASSED only after the owner accepts it with the evidence described in [Recording results](#recording-results).

Read the [alpha play guide](../../guides/alpha-play-guide.md) before the first run: it explains every live-table control these scenarios use, and its [known gaps](../../guides/alpha-play-guide.md#known-gaps) are not failures.

## Contents

- [Setup](#setup)
- [Accounts](#accounts)
- [Review data](#review-data)
- [Running several users side by side](#running-several-users-side-by-side)
- [Recording results](#recording-results)
- [Known UAT gaps](#known-uat-gaps)
- [Scenario files and coverage](#scenario-files-and-coverage)

## Setup

The operator (an agent or engineer) prepares the build once per UAT run. The tester starts at step 6.

1. Docker Desktop is running and the local Convex container answers: `http://127.0.0.1:3210/version` returns a version. The [release runbook](../../runbooks/phase-8-2-release.md#final-local-source) covers starting it.
2. Reset the local backend in the heavy validation lane: `pwsh -NoProfile -File scripts/resetLocalConvex.ps1 -Name uat-<date>`. This empties every app table, accounts included.
3. Deploy the source under test to the local container and seed the SRD corpus (`yarn workspace @artificer-toolkit/apis seed:srd:convex:local`), as the release runbook's final-local-source steps describe. Record the git commit (`git rev-parse HEAD`): every result names it.
4. Build the review data: `node scripts/seedReviewData.mjs --name=uat-<date>`. Its log ends with `Review data: 3 Campaign(s) created, 0 already finished.` (a re-run without a reset says `0 created, 3 already finished`, which is also fine). The script starts and stops its own Session Worker; see the [review data section](../../runbooks/phase-8-2-release.md#review-data) of the runbook.
5. Start the Session Worker (`yarn dev:session-worker`, port 8787) and the web app (`yarn dev`, http://localhost:3000) from the main checkout, which holds the Worker's local `.dev.vars`. Start them after step 4, which needs port 8787 free.
6. Open the four browser profiles described [below](#running-several-users-side-by-side) and sign in to each with its [account](#accounts).
7. Run the feature files in the order of the [coverage table](#scenario-files-and-coverage), or only the files under review. Inside a file, run the scenarios in order: later ones may build on what earlier ones created.

A scenario changes the data. To repeat a scenario from a clean state, repeat steps 2 to 5. Scenarios that only read can be repeated without a reset.

## Accounts

The review data creates four local-only accounts. Sign in at http://localhost:3000/sign-in with **Email or username** and the shared review password, which is the `REVIEW_PASSWORD` constant in [developmentReviewDataScenarios.ts](../../../apps/apis/tests/developmentReviewDataScenarios.ts). It exists only on the local Docker backend and guards nothing.

| Name in scenarios | Username          | Email                             | Role in the review data                                         |
| ----------------- | ----------------- | --------------------------------- | --------------------------------------------------------------- |
| **GM**            | `Review_Gm_Rowan` | `review_gm_rowan@example.invalid` | GM of all three review Campaigns; GM plan tier                  |
| **P1**            | `Review_Pl_Aria`  | `review_pl_aria@example.invalid`  | Player: Aria (Party in the Field), Ember (Shield and Hold)      |
| **P2**            | `Review_Pl_Bryn`  | `review_pl_bryn@example.invalid`  | Player: Bryn (Party in the Field), Pyra (Fire and Thunder)      |
| **P3**            | `Review_Pl_Cade`  | `review_pl_cade@example.invalid`  | Player: Cade (Party in the Field)                               |

After the review-data run every account has **Roll my dice automatically** switched **off** (Settings, Preferences, or the **Auto-roll** switch in the tabletop header), so rolls raise a prompt where you can choose **Roll dice** or type physical dice. A scenario that needs auto-roll on says so.

Public sign-up is closed and local email is discarded, so testers cannot make further accounts. Scenarios that need a superadmin (`SUPERADMIN`) or an account outside every Campaign (`OUTSIDER`) are written in full but marked "Blocked until gap G2/G3 is fixed"; see [Known UAT gaps](#known-uat-gaps).

## Review data

`scripts/seedReviewData.mjs` builds three Campaigns through the product's own commands. All three use **Assisted** mode and the **Speed Factor** initiative variant, a square 5-foot grid on an 800 by 600 map, fog off, and no walls, doors, terrain or hidden tokens. Each has a Session for play, a last Session titled "Review data ready", a presented Scene with every combatant's token, and an Encounter that is started and partly played.

| Campaign                        | Members        | Characters                                                                      | Creatures                                  | Already played                                                                                       |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Review: Party in the Field**  | GM, P1, P2, P3 | Aria (P1), Bryn (P2), Cade (P3)                                                 | Wolf (next to Aria), Goblin (next to Bryn) | Round 1: Aria attacks the Wolf, Bryn the Goblin, Wolf attacks Aria, Goblin attacks Bryn; round 2 open |
| **Review: Shield and Hold**     | GM, P1         | Ember (P1): Shield, Hold Person; four 1st-level and two 2nd-level slots         | Wolf (adjacent), Goblin (two squares away) | Hold Person paralyzes the Goblin (Ember concentrates); the Wolf bites Ember, who casts Shield         |
| **Review: Fire and Thunder**    | GM, P2         | Pyra (P2): Fireball, Thunderwave; two 1st-level and two 3rd-level slots         | Wolf (adjacent), three Goblins grouped     | Fireball on the Goblins (all fail); round 2 Thunderwave catches the Wolf                              |

Hit points and slot counts on screen depend on those rolls: scenarios compare against what you see before a step, not against fixed numbers.

Anything else a scenario needs (a Manual-mode Campaign, standard initiative, walls, doors, fog, hidden tokens, a new Character, homebrew content, an uploaded map) is created by the tester in that file's setup steps, through the product.

## Running several users side by side

Each account needs its own browser session, because sign-in is a cookie on `localhost:3000`.

- Use **separate browser profiles**, not tabs: for example Chrome profiles named "UAT GM", "UAT P1" and "UAT P2", and Edge or Firefox for P3. Private or incognito windows of one browser share one session, so they count as one profile at most.
- Tile the windows so the GM window and at least one player window are visible at once. Scenarios list what every other window must show, and what it must **not** show (hidden tokens, GM private rolls, other players' private data).
- One person can drive all four windows. Helpers can join only on this machine: the local build is not reachable from other devices, including phones.
- **Mobile width**: open the browser's developer tools, turn on the device toolbar and pick a 375-pixel-wide phone. Real phones cannot reach the local build.
- **Dropped connection**: in developer tools, open the Network panel and set throttling to **Offline**, then back to **No throttling**; or close the tab and reopen the page.
- Each step names who acts, for example "3. **P1:** ...". When a step says "at the same time", have two windows ready and click within a second or two of each other.

## Recording results

Record every run in `docs/validation/uat/results/<YYYY-MM-DD>-<FEATURE>.md` (create the `results` folder on the first run), with this header and one row per scenario:

```markdown
# <FEATURE> UAT run <YYYY-MM-DD>

- Commit: <git rev-parse HEAD from setup step 3>
- Review data: <the --name used in setup step 4>
- Testers: <who drove which accounts>

| Scenario | Result | Notes | Evidence |
| -------- | ------ | ----- | -------- |
| UAT-<FEATURE>-1 | PASS | | local-validation/uat/<YYYY-MM-DD>/<FEATURE>-1-*.png |
```

- **Result** is one of `PASS`, `FAIL`, `BLOCKED` (a gap or an earlier failure stopped it) or `SKIPPED` (with the reason).
- **PASS** means every Expected line and every "Other users see" line held. Take at least one screenshot per scenario of its final state, and one per player window in multi-user scenarios. Screenshots stay in the ignored `local-validation/uat/<YYYY-MM-DD>/` folder; the results file is the durable record.
- **FAIL**: note the step number, and give the details the [play guide's feedback list](../../guides/alpha-play-guide.md#sending-feedback) asks for (Campaign, Scene, round and turn, mode and auto-roll, expected, actual with the exact wording of any message, whether it repeats). Every failure is fixed or registered in the ledger before the feature is accepted.
- A behaviour listed in the play guide's known gaps is not a failure; note it only if it hurt the session.
- When the owner accepts a feature's run, the orchestrator sets each of its ledger `uat` items to PASSED with the results file as evidence.

## Known UAT gaps

These stop some scenarios on the local build. Each scenario that depends on one says "Blocked until gap Gn is fixed".

| Gap    | What is missing                                                                                                                                                                          | Effect                                                                                                                       | Smallest fix                                                                                                                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **G1** | Local email is accept-and-discard: the sink in `scripts/localConvexFixtures.ps1` keeps no message, so no tester can read a password-reset, invitation, verification or notification email. | Email steps cannot be run locally; the in-app part of those flows still can.                                                  | Have the local sink keep the most recent messages and serve them on a host loopback page (or write each one to an ignored `local-validation/local-email/` file), local mode only.                                                                                 |
| **G2** | No superadmin account. Roles are set only by the deployment-admin CLI (`authAdmin:setRole`).                                                                                             | Superadmin and moderation scenarios, and editing master records as their owner, cannot be run.                               | Have the review-data driver provision a fifth account (for example `Review_Admin_Sol`) the same way it provisions the others and promote it with `authAdmin:setRole`, as it already lifts the GM's tier with `accountEntitlements:setTier`.                         |
| **G3** | No account outside every Campaign, and no spare account to delete. Public sign-up is closed and invitations need email (G1).                                                                | Sign-up, invitation redemption, listing applications from a stranger, free-tier plan limits on a fresh account and account deletion cannot be run. | Have the review-data driver provision one or two spare player accounts that join no Campaign (for example `Review_Pl_Dara` and `Review_Pl_Eli`) through the same invitation-redeem path.                                                                              |
| **G4** | Managed staging credentials.                                                                                                                                                             | Staging and production scenarios (PERF and RELEASE) run only on an approved staging smoke, never locally.                    | None locally: they run at the staging step of the release sequence.                                                                                                                                                                                                |
| **G5** | No sandbox review data: the review Campaigns have no walls, doors, terrain, fog, lights, hidden tokens or Large creature, and none uses Manual mode or standard initiative.               | Not blocking. Scenarios that need these say "Heavy setup: G5" and the tester builds them by hand first.                       | Add review scenarios to `REVIEW_SCENARIOS` in `apps/apis/tests/developmentReviewDataScenarios.ts`: a sandbox Campaign whose Scene has those features, and a Manual-mode Campaign with standard initiative.                                                         |

## Scenario files and coverage

The coverage below is generated from the scenario files and the ledger: every AC of every feature is either covered by at least one scenario, listed in its file as **Covered elsewhere** (no tester-visible behaviour; the ledger proof is the evidence), or listed as **Not coverable** with its gap. "Internal PBI" marks ACs of PBIs the ledger records as having no user flow.

<!-- coverage:start -->

| Feature | File | Scenarios | ACs | Covered by a scenario | of which blocked | Covered elsewhere | Not coverable |
| ------- | ---- | --------- | --- | --------------------- | ---------------- | ----------------- | ------------- |
| PLATFORM | [PLATFORM.md](PLATFORM.md) | 5 | 68 | 10 | 0 | 58 | 0 |
| ACCOUNTS | [ACCOUNTS.md](ACCOUNTS.md) | 13 | 37 | 29 | 12 | 8 | 0 |
| AUTHORING | [AUTHORING.md](AUTHORING.md) | 12 | 57 | 50 | 0 | 7 | 0 |
| RULES | [RULES.md](RULES.md) | 5 | 14 | 5 | 0 | 9 | 0 |
| BUILDER | [BUILDER.md](BUILDER.md) | 6 | 14 | 12 | 0 | 2 | 0 |
| SHEET | [SHEET.md](SHEET.md) | 11 | 25 | 22 | 0 | 3 | 0 |
| CAMPAIGN | [CAMPAIGN.md](CAMPAIGN.md) | 8 | 24 | 19 | 0 | 5 | 0 |
| SOCIAL | [SOCIAL.md](SOCIAL.md) | 6 | 11 | 8 | 0 | 3 | 0 |
| ROOM | [ROOM.md](ROOM.md) | 10 | 38 | 20 | 0 | 18 | 0 |
| SCENE | [SCENE.md](SCENE.md) | 9 | 16 | 15 | 0 | 1 | 0 |
| MOVE | [MOVE.md](MOVE.md) | 9 | 22 | 18 | 0 | 4 | 0 |
| ENCOUNTER | [ENCOUNTER.md](ENCOUNTER.md) | 7 | 30 | 29 | 0 | 1 | 0 |
| ATTACK | [ATTACK.md](ATTACK.md) | 11 | 88 | 84 | 0 | 4 | 0 |
| SPELLS | [SPELLS.md](SPELLS.md) | 27 | 102 | 98 | 0 | 4 | 0 |
| REACTION | [REACTION.md](REACTION.md) | 7 | 14 | 14 | 0 | 0 | 0 |
| PRIVACY | [PRIVACY.md](PRIVACY.md) | 9 | 11 | 10 | 0 | 1 | 0 |
| RELIABILITY | [RELIABILITY.md](RELIABILITY.md) | 13 | 92 | 36 | 1 | 56 | 0 |
| VTT_UI | [VTT_UI.md](VTT_UI.md) | 4 | 13 | 12 | 0 | 1 | 0 |
| PERF | [PERF.md](PERF.md) | 2 | 21 | 5 | 1 | 16 | 0 |
| QUALITY | [QUALITY.md](QUALITY.md) | 0 | 2 | 0 | 0 | 2 | 0 |
| RELEASE | [RELEASE.md](RELEASE.md) | 1 | 17 | 5 | 0 | 8 | 4 |
| **Total** | | **175** | **716** | **501** | **14** | **211** | **4** |

### AC map

Every acceptance criterion in the ledger and where it is checked. "(blocked)" means every scenario that covers it waits on a [known UAT gap](#known-uat-gaps).

<details>
<summary>PLATFORM: 10 of 68 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| PLATFORM-2.1 | Covered elsewhere |
| PLATFORM-2.2 | Covered elsewhere |
| PLATFORM-2.3 | [UAT-PLATFORM-1](PLATFORM.md#uat-platform-1-srd-content-is-present-and-browsable) |
| PLATFORM-3.1 | [UAT-PLATFORM-4](PLATFORM.md#uat-platform-4-password-reset-email-is-requested-from-the-app) |
| PLATFORM-3.2 | [UAT-PLATFORM-4](PLATFORM.md#uat-platform-4-password-reset-email-is-requested-from-the-app) |
| PLATFORM-4.1 | [UAT-PLATFORM-2](PLATFORM.md#uat-platform-2-upload-replace-and-remove-an-avatar), [UAT-PLATFORM-3](PLATFORM.md#uat-platform-3-artwork-is-private-to-its-owner-until-shared) |
| PLATFORM-4.2 | [UAT-PLATFORM-2](PLATFORM.md#uat-platform-2-upload-replace-and-remove-an-avatar) |
| PLATFORM-4.3 | [UAT-PLATFORM-3](PLATFORM.md#uat-platform-3-artwork-is-private-to-its-owner-until-shared) |
| PLATFORM-4.4 | [UAT-PLATFORM-2](PLATFORM.md#uat-platform-2-upload-replace-and-remove-an-avatar), [UAT-PLATFORM-3](PLATFORM.md#uat-platform-3-artwork-is-private-to-its-owner-until-shared) |
| PLATFORM-5.1 | Covered elsewhere |
| PLATFORM-5.2 | [UAT-PLATFORM-1](PLATFORM.md#uat-platform-1-srd-content-is-present-and-browsable) |
| PLATFORM-5.3 | Covered elsewhere |
| PLATFORM-5.4 | Covered elsewhere |
| PLATFORM-5.5 | Covered elsewhere |
| PLATFORM-5.6 | Covered elsewhere |
| PLATFORM-5.7 | Covered elsewhere |
| PLATFORM-6.1 (internal PBI) | Covered elsewhere |
| PLATFORM-7.1 (internal PBI) | Covered elsewhere |
| PLATFORM-8.1 (internal PBI) | Covered elsewhere |
| PLATFORM-9.1 (internal PBI) | Covered elsewhere |
| PLATFORM-10.1 (internal PBI) | Covered elsewhere |
| PLATFORM-11.1 | Covered elsewhere |
| PLATFORM-12.1 | Covered elsewhere |
| PLATFORM-13.2 (internal PBI) | Covered elsewhere |
| PLATFORM-13.4 (internal PBI) | Covered elsewhere |
| PLATFORM-13.5 (internal PBI) | Covered elsewhere |
| PLATFORM-13.6 (internal PBI) | Covered elsewhere |
| PLATFORM-13.7 (internal PBI) | Covered elsewhere |
| PLATFORM-13.8 (internal PBI) | Covered elsewhere |
| PLATFORM-13.9 (internal PBI) | Covered elsewhere |
| PLATFORM-13.10 (internal PBI) | Covered elsewhere |
| PLATFORM-13.11 (internal PBI) | Covered elsewhere |
| PLATFORM-13.12 (internal PBI) | Covered elsewhere |
| PLATFORM-13.13 (internal PBI) | Covered elsewhere |
| PLATFORM-13.14 (internal PBI) | Covered elsewhere |
| PLATFORM-13.15 (internal PBI) | Covered elsewhere |
| PLATFORM-14.1 | Covered elsewhere |
| PLATFORM-14.2 | Covered elsewhere |
| PLATFORM-14.3 | Covered elsewhere |
| PLATFORM-15.1 | [UAT-PLATFORM-5](PLATFORM.md#uat-platform-5-a-concentration-save-shows-its-result-on-the-roll-card) |
| PLATFORM-16.1 | Covered elsewhere |
| PLATFORM-16.2 | Covered elsewhere |
| PLATFORM-17.1 | Covered elsewhere |
| PLATFORM-17.2 | Covered elsewhere |
| PLATFORM-17.3 | Covered elsewhere |
| PLATFORM-18.1 | Covered elsewhere |
| PLATFORM-18.2 | Covered elsewhere |
| PLATFORM-19.1 | Covered elsewhere |
| PLATFORM-20.1 | Covered elsewhere |
| PLATFORM-20.2 | Covered elsewhere |
| PLATFORM-20.3 | Covered elsewhere |
| PLATFORM-20.4 | Covered elsewhere |
| PLATFORM-21.1 | [UAT-AUTHORING-3](AUTHORING.md#uat-authoring-3-background-lifecycle--create-save-publish-replace-export-delete) |
| PLATFORM-21.2 | Covered elsewhere |
| PLATFORM-22.1 | Covered elsewhere |
| PLATFORM-22.2 | Covered elsewhere |
| PLATFORM-22.3 | Covered elsewhere |
| PLATFORM-22.4 | Covered elsewhere |
| PLATFORM-23.1 | Covered elsewhere |
| PLATFORM-23.2 | Covered elsewhere |
| PLATFORM-23.3 | Covered elsewhere |
| PLATFORM-23.4 | Covered elsewhere |
| PLATFORM-24.1 | Covered elsewhere |
| PLATFORM-24.2 | Covered elsewhere |
| PLATFORM-25.1 | Covered elsewhere |
| PLATFORM-25.2 | Covered elsewhere |
| PLATFORM-25.4 | Covered elsewhere |
| PLATFORM-25.3 | Covered elsewhere |

</details>

<details>
<summary>ACCOUNTS: 29 of 37 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| ACCOUNTS-1.1 | [UAT-ACCOUNTS-1](ACCOUNTS.md#uat-accounts-1-sign-in-reload-sign-out-sign-back-in-by-username), [UAT-ACCOUNTS-3](ACCOUNTS.md#uat-accounts-3-two-accounts-at-once-stay-isolated-and-sign-out-ends-every-tab) |
| ACCOUNTS-1.2 | [UAT-ACCOUNTS-1](ACCOUNTS.md#uat-accounts-1-sign-in-reload-sign-out-sign-back-in-by-username), [UAT-ACCOUNTS-3](ACCOUNTS.md#uat-accounts-3-two-accounts-at-once-stay-isolated-and-sign-out-ends-every-tab) |
| ACCOUNTS-1.3 | Covered elsewhere |
| ACCOUNTS-1.4 | Covered elsewhere |
| ACCOUNTS-2.1 | [UAT-ACCOUNTS-4](ACCOUNTS.md#uat-accounts-4-public-sign-up-is-closed) |
| ACCOUNTS-2.2 | [UAT-ACCOUNTS-4](ACCOUNTS.md#uat-accounts-4-public-sign-up-is-closed) |
| ACCOUNTS-3.1 | [UAT-ACCOUNTS-6](ACCOUNTS.md#uat-accounts-6-create-an-account-from-an-invitation) (blocked) |
| ACCOUNTS-3.2 | [UAT-ACCOUNTS-6](ACCOUNTS.md#uat-accounts-6-create-an-account-from-an-invitation) (blocked) |
| ACCOUNTS-3.3 | [UAT-ACCOUNTS-6](ACCOUNTS.md#uat-accounts-6-create-an-account-from-an-invitation) (blocked) |
| ACCOUNTS-4.1 | Covered elsewhere |
| ACCOUNTS-4.2 | [UAT-ACCOUNTS-6](ACCOUNTS.md#uat-accounts-6-create-an-account-from-an-invitation) (blocked) |
| ACCOUNTS-4.3 | Covered elsewhere |
| ACCOUNTS-4.4 | Covered elsewhere |
| ACCOUNTS-5.1 | [UAT-ACCOUNTS-1](ACCOUNTS.md#uat-accounts-1-sign-in-reload-sign-out-sign-back-in-by-username), [UAT-ACCOUNTS-2](ACCOUNTS.md#uat-accounts-2-wrong-password-and-unknown-account-are-refused) |
| ACCOUNTS-5.2 | [UAT-ACCOUNTS-3](ACCOUNTS.md#uat-accounts-3-two-accounts-at-once-stay-isolated-and-sign-out-ends-every-tab) |
| ACCOUNTS-5.3 | [UAT-ACCOUNTS-3](ACCOUNTS.md#uat-accounts-3-two-accounts-at-once-stay-isolated-and-sign-out-ends-every-tab) |
| ACCOUNTS-6.1 | [UAT-ACCOUNTS-5](ACCOUNTS.md#uat-accounts-5-reset-a-forgotten-password-wrong-code-mismatch-then-success) (blocked) |
| ACCOUNTS-6.2 | [UAT-ACCOUNTS-5](ACCOUNTS.md#uat-accounts-5-reset-a-forgotten-password-wrong-code-mismatch-then-success) (blocked) |
| ACCOUNTS-6.3 | [UAT-ACCOUNTS-5](ACCOUNTS.md#uat-accounts-5-reset-a-forgotten-password-wrong-code-mismatch-then-success) (blocked) |
| ACCOUNTS-7.1 | [UAT-ACCOUNTS-7](ACCOUNTS.md#uat-accounts-7-choose-change-and-protect-a-username) |
| ACCOUNTS-7.2 | [UAT-ACCOUNTS-7](ACCOUNTS.md#uat-accounts-7-choose-change-and-protect-a-username) |
| ACCOUNTS-7.3 | [UAT-ACCOUNTS-3](ACCOUNTS.md#uat-accounts-3-two-accounts-at-once-stay-isolated-and-sign-out-ends-every-tab) |
| ACCOUNTS-7.4 | [UAT-ACCOUNTS-7](ACCOUNTS.md#uat-accounts-7-choose-change-and-protect-a-username) |
| ACCOUNTS-7.5 | [UAT-ACCOUNTS-13](ACCOUNTS.md#uat-accounts-13-campaign-text-follows-the-same-language-rules-as-usernames) |
| ACCOUNTS-8.1 | Covered elsewhere |
| ACCOUNTS-8.2 | [UAT-ACCOUNTS-8](ACCOUNTS.md#uat-accounts-8-private-profiles-stay-private-public-profiles-show-only-public-fields) |
| ACCOUNTS-8.3 | [UAT-ACCOUNTS-8](ACCOUNTS.md#uat-accounts-8-private-profiles-stay-private-public-profiles-show-only-public-fields) |
| ACCOUNTS-8.4 | [UAT-ACCOUNTS-8](ACCOUNTS.md#uat-accounts-8-private-profiles-stay-private-public-profiles-show-only-public-fields) |
| ACCOUNTS-9.1 | Covered elsewhere |
| ACCOUNTS-9.2 | [UAT-ACCOUNTS-9](ACCOUNTS.md#uat-accounts-9-ordinary-users-cannot-use-superadmin-tools), [UAT-ACCOUNTS-10](ACCOUNTS.md#uat-accounts-10-superadmin-moderation-blocked) |
| ACCOUNTS-9.3 | Covered elsewhere |
| ACCOUNTS-9.4 | [UAT-ACCOUNTS-9](ACCOUNTS.md#uat-accounts-9-ordinary-users-cannot-use-superadmin-tools), [UAT-ACCOUNTS-10](ACCOUNTS.md#uat-accounts-10-superadmin-moderation-blocked) |
| ACCOUNTS-10.1 | [UAT-ACCOUNTS-11](ACCOUNTS.md#uat-accounts-11-refused-account-deletions) (blocked) |
| ACCOUNTS-10.2 | [UAT-ACCOUNTS-12](ACCOUNTS.md#uat-accounts-12-delete-my-account-shared-history-survives-blocked) (blocked) |
| ACCOUNTS-10.3 | [UAT-ACCOUNTS-12](ACCOUNTS.md#uat-accounts-12-delete-my-account-shared-history-survives-blocked) (blocked) |
| ACCOUNTS-10.4 | [UAT-ACCOUNTS-12](ACCOUNTS.md#uat-accounts-12-delete-my-account-shared-history-survives-blocked) (blocked) |
| ACCOUNTS-10.5 | [UAT-ACCOUNTS-12](ACCOUNTS.md#uat-accounts-12-delete-my-account-shared-history-survives-blocked) (blocked) |

</details>

<details>
<summary>AUTHORING: 50 of 57 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| AUTHORING-1.1 | [UAT-AUTHORING-1](AUTHORING.md#uat-authoring-1-browse-game-systems-and-rules-catalogues) |
| AUTHORING-1.2 | Covered elsewhere |
| AUTHORING-1.3 | [UAT-AUTHORING-1](AUTHORING.md#uat-authoring-1-browse-game-systems-and-rules-catalogues) |
| AUTHORING-1.4 | [UAT-AUTHORING-1](AUTHORING.md#uat-authoring-1-browse-game-systems-and-rules-catalogues) |
| AUTHORING-1.5 | Covered elsewhere |
| AUTHORING-2.1 | [UAT-AUTHORING-1](AUTHORING.md#uat-authoring-1-browse-game-systems-and-rules-catalogues) |
| AUTHORING-2.2 | [UAT-AUTHORING-2](AUTHORING.md#uat-authoring-2-srd-records-are-locked-but-can-be-copied-into-an-owned-draft), [UAT-AUTHORING-11](AUTHORING.md#uat-authoring-11-share-homebrew-with-a-campaign-then-withdraw-it) |
| AUTHORING-2.3 | [UAT-AUTHORING-3](AUTHORING.md#uat-authoring-3-background-lifecycle--create-save-publish-replace-export-delete) |
| AUTHORING-3.1 | [UAT-AUTHORING-3](AUTHORING.md#uat-authoring-3-background-lifecycle--create-save-publish-replace-export-delete) |
| AUTHORING-3.2 | [UAT-AUTHORING-3](AUTHORING.md#uat-authoring-3-background-lifecycle--create-save-publish-replace-export-delete) |
| AUTHORING-3.3 | [UAT-BUILDER-4](BUILDER.md#uat-builder-4-removing-content-a-character-uses-repairs-the-character) |
| AUTHORING-4.1 | [UAT-AUTHORING-4](AUTHORING.md#uat-authoring-4-author-publish-and-filter-a-homebrew-spell-with-artwork), [UAT-AUTHORING-5](AUTHORING.md#uat-authoring-5-author-a-class-and-see-the-spell-guard) |
| AUTHORING-4.2 | Covered elsewhere |
| AUTHORING-4.3 | [UAT-AUTHORING-5](AUTHORING.md#uat-authoring-5-author-a-class-and-see-the-spell-guard) |
| AUTHORING-4.4 | [UAT-AUTHORING-5](AUTHORING.md#uat-authoring-5-author-a-class-and-see-the-spell-guard) |
| AUTHORING-5.1 | [UAT-AUTHORING-6](AUTHORING.md#uat-authoring-6-creature-copy-computed-ac-and-the-item-loadout), [UAT-AUTHORING-8](AUTHORING.md#uat-authoring-8-author-a-feat-a-race-and-a-vehicle) |
| AUTHORING-5.2 | Covered elsewhere |
| AUTHORING-6.1 | [UAT-AUTHORING-7](AUTHORING.md#uat-authoring-7-equipment-variants-inheritance-and-item-names) |
| AUTHORING-6.2 | [UAT-AUTHORING-7](AUTHORING.md#uat-authoring-7-equipment-variants-inheritance-and-item-names) |
| AUTHORING-6.3 | Covered elsewhere |
| AUTHORING-6.4 | [UAT-BUILDER-4](BUILDER.md#uat-builder-4-removing-content-a-character-uses-repairs-the-character) |
| AUTHORING-7.1 | [UAT-AUTHORING-8](AUTHORING.md#uat-authoring-8-author-a-feat-a-race-and-a-vehicle) |
| AUTHORING-7.2 | [UAT-BUILDER-4](BUILDER.md#uat-builder-4-removing-content-a-character-uses-repairs-the-character) |
| AUTHORING-8.1 | [UAT-AUTHORING-8](AUTHORING.md#uat-authoring-8-author-a-feat-a-race-and-a-vehicle) |
| AUTHORING-8.2 | [UAT-AUTHORING-1](AUTHORING.md#uat-authoring-1-browse-game-systems-and-rules-catalogues) |
| AUTHORING-8.3 | [UAT-AUTHORING-1](AUTHORING.md#uat-authoring-1-browse-game-systems-and-rules-catalogues) |
| AUTHORING-9.1 | [UAT-AUTHORING-4](AUTHORING.md#uat-authoring-4-author-publish-and-filter-a-homebrew-spell-with-artwork) |
| AUTHORING-9.2 | [UAT-AUTHORING-4](AUTHORING.md#uat-authoring-4-author-publish-and-filter-a-homebrew-spell-with-artwork) |
| AUTHORING-9.3 | [UAT-AUTHORING-4](AUTHORING.md#uat-authoring-4-author-publish-and-filter-a-homebrew-spell-with-artwork) |
| AUTHORING-9.4 | [UAT-AUTHORING-1](AUTHORING.md#uat-authoring-1-browse-game-systems-and-rules-catalogues) |
| AUTHORING-10.1 | [UAT-AUTHORING-8](AUTHORING.md#uat-authoring-8-author-a-feat-a-race-and-a-vehicle) |
| AUTHORING-10.2 | Covered elsewhere |
| AUTHORING-11.1 | [UAT-AUTHORING-9](AUTHORING.md#uat-authoring-9-reusable-effects-grants-and-modifiers-on-a-system) |
| AUTHORING-11.2 | [UAT-AUTHORING-9](AUTHORING.md#uat-authoring-9-reusable-effects-grants-and-modifiers-on-a-system) |
| AUTHORING-11.3 | [UAT-AUTHORING-9](AUTHORING.md#uat-authoring-9-reusable-effects-grants-and-modifiers-on-a-system) |
| AUTHORING-11.4 | [UAT-AUTHORING-9](AUTHORING.md#uat-authoring-9-reusable-effects-grants-and-modifiers-on-a-system) |
| AUTHORING-12.1 | [UAT-AUTHORING-2](AUTHORING.md#uat-authoring-2-srd-records-are-locked-but-can-be-copied-into-an-owned-draft), [UAT-AUTHORING-10](AUTHORING.md#uat-authoring-10-another-account-cannot-see-or-edit-your-drafts) |
| AUTHORING-12.2 | [UAT-AUTHORING-3](AUTHORING.md#uat-authoring-3-background-lifecycle--create-save-publish-replace-export-delete) |
| AUTHORING-12.3 | [UAT-AUTHORING-4](AUTHORING.md#uat-authoring-4-author-publish-and-filter-a-homebrew-spell-with-artwork) |
| AUTHORING-12.4 | [UAT-AUTHORING-2](AUTHORING.md#uat-authoring-2-srd-records-are-locked-but-can-be-copied-into-an-owned-draft) |
| AUTHORING-13.1 | [UAT-AUTHORING-3](AUTHORING.md#uat-authoring-3-background-lifecycle--create-save-publish-replace-export-delete) |
| AUTHORING-13.2 | [UAT-AUTHORING-3](AUTHORING.md#uat-authoring-3-background-lifecycle--create-save-publish-replace-export-delete) |
| AUTHORING-13.3 | [UAT-AUTHORING-7](AUTHORING.md#uat-authoring-7-equipment-variants-inheritance-and-item-names) |
| AUTHORING-14.1 | Covered elsewhere |
| AUTHORING-14.2 | [UAT-AUTHORING-2](AUTHORING.md#uat-authoring-2-srd-records-are-locked-but-can-be-copied-into-an-owned-draft) |
| AUTHORING-14.3 | [UAT-AUTHORING-2](AUTHORING.md#uat-authoring-2-srd-records-are-locked-but-can-be-copied-into-an-owned-draft) |
| AUTHORING-15.1 | [UAT-AUTHORING-2](AUTHORING.md#uat-authoring-2-srd-records-are-locked-but-can-be-copied-into-an-owned-draft), [UAT-AUTHORING-10](AUTHORING.md#uat-authoring-10-another-account-cannot-see-or-edit-your-drafts) |
| AUTHORING-15.2 | [UAT-AUTHORING-11](AUTHORING.md#uat-authoring-11-share-homebrew-with-a-campaign-then-withdraw-it) |
| AUTHORING-15.3 | [UAT-AUTHORING-11](AUTHORING.md#uat-authoring-11-share-homebrew-with-a-campaign-then-withdraw-it) |
| AUTHORING-16.1 | [UAT-AUTHORING-7](AUTHORING.md#uat-authoring-7-equipment-variants-inheritance-and-item-names) |
| AUTHORING-16.2 | [UAT-AUTHORING-7](AUTHORING.md#uat-authoring-7-equipment-variants-inheritance-and-item-names) |
| AUTHORING-17.1 | [UAT-AUTHORING-6](AUTHORING.md#uat-authoring-6-creature-copy-computed-ac-and-the-item-loadout) |
| AUTHORING-17.2 | [UAT-AUTHORING-6](AUTHORING.md#uat-authoring-6-creature-copy-computed-ac-and-the-item-loadout) |
| AUTHORING-17.3 | [UAT-AUTHORING-6](AUTHORING.md#uat-authoring-6-creature-copy-computed-ac-and-the-item-loadout) |
| AUTHORING-18.1 | [UAT-AUTHORING-12](AUTHORING.md#uat-authoring-12-option-descriptions-and-adding-a-check-and-a-dc) |
| AUTHORING-19.1 | [UAT-AUTHORING-12](AUTHORING.md#uat-authoring-12-option-descriptions-and-adding-a-check-and-a-dc) |
| AUTHORING-20.1 | [UAT-AUTHORING-12](AUTHORING.md#uat-authoring-12-option-descriptions-and-adding-a-check-and-a-dc) |

</details>

<details>
<summary>RULES: 5 of 14 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| RULES-1.1 | [UAT-RULES-1](RULES.md#uat-rules-1-authoring-forms-show-hide-and-require-fields-as-choices-change) |
| RULES-1.2 | [UAT-RULES-2](RULES.md#uat-rules-2-a-started-encounter-pauses-for-answers-and-resumes-with-nothing-half-applied), [UAT-RULES-3](RULES.md#uat-rules-3-a-reaction-pauses-a-hit-answering-resumes-it-privacy-of-the-pause) |
| RULES-1.3 | Covered elsewhere |
| RULES-1.4 | [UAT-RULES-2](RULES.md#uat-rules-2-a-started-encounter-pauses-for-answers-and-resumes-with-nothing-half-applied), [UAT-RULES-3](RULES.md#uat-rules-3-a-reaction-pauses-a-hit-answering-resumes-it-privacy-of-the-pause) |
| RULES-1.5 | [UAT-RULES-4](RULES.md#uat-rules-4-healing-keeps-its-dice-and-modifier-visible-in-the-roll-card) |
| RULES-1.6 | [UAT-RULES-5](RULES.md#uat-rules-5-an-attack-with-two-damage-parts-keeps-each-part-visible) |
| RULES-2.1 (internal PBI) | Covered elsewhere |
| RULES-2.2 (internal PBI) | Covered elsewhere |
| RULES-2.3 (internal PBI) | Covered elsewhere |
| RULES-2.4 (internal PBI) | Covered elsewhere |
| RULES-2.5 (internal PBI) | Covered elsewhere |
| RULES-2.6 (internal PBI) | Covered elsewhere |
| RULES-2.7 (internal PBI) | Covered elsewhere |
| RULES-2.8 (internal PBI) | Covered elsewhere |

</details>

<details>
<summary>BUILDER: 12 of 14 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| BUILDER-1.1 | [UAT-BUILDER-1](BUILDER.md#uat-builder-1-build-a-character-for-a-review-player-save-resume-and-commit) |
| BUILDER-1.2 | [UAT-BUILDER-2](BUILDER.md#uat-builder-2-two-windows-on-one-draft-cannot-overwrite-each-other) |
| BUILDER-1.3 | [UAT-BUILDER-1](BUILDER.md#uat-builder-1-build-a-character-for-a-review-player-save-resume-and-commit) |
| BUILDER-2.1 | [UAT-BUILDER-3](BUILDER.md#uat-builder-3-choice-heavy-builds--multiclass-and-spellcaster) |
| BUILDER-2.2 | [UAT-BUILDER-1](BUILDER.md#uat-builder-1-build-a-character-for-a-review-player-save-resume-and-commit), [UAT-BUILDER-2](BUILDER.md#uat-builder-2-two-windows-on-one-draft-cannot-overwrite-each-other) |
| BUILDER-2.3 | Covered elsewhere |
| BUILDER-2.4 | Covered elsewhere |
| BUILDER-3.1 | [UAT-BUILDER-4](BUILDER.md#uat-builder-4-removing-content-a-character-uses-repairs-the-character) |
| BUILDER-3.2 | [UAT-BUILDER-4](BUILDER.md#uat-builder-4-removing-content-a-character-uses-repairs-the-character) |
| BUILDER-3.3 | [UAT-BUILDER-4](BUILDER.md#uat-builder-4-removing-content-a-character-uses-repairs-the-character) |
| BUILDER-3.4 | [UAT-BUILDER-5](BUILDER.md#uat-builder-5-withdrawing-shared-content-reconciles-assigned-characters) |
| BUILDER-4.1 | [UAT-BUILDER-6](BUILDER.md#uat-builder-6-imported-custom-items-keep-their-kind-properties-and-damage) |
| BUILDER-4.2 | [UAT-BUILDER-6](BUILDER.md#uat-builder-6-imported-custom-items-keep-their-kind-properties-and-damage) |
| BUILDER-4.3 | [UAT-BUILDER-6](BUILDER.md#uat-builder-6-imported-custom-items-keep-their-kind-properties-and-damage) |

</details>

<details>
<summary>SHEET: 22 of 25 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| SHEET-1.1 | [UAT-SHEET-1](SHEET.md#uat-sheet-1-edit-a-personal-sheet-and-reload), [UAT-SHEET-10](SHEET.md#uat-sheet-10-sheet-at-phone-width) |
| SHEET-1.2 | [UAT-SHEET-3](SHEET.md#uat-sheet-3-learn-prepare-and-cast-spells-from-the-sheet) |
| SHEET-1.3 | [UAT-SHEET-1](SHEET.md#uat-sheet-1-edit-a-personal-sheet-and-reload) |
| SHEET-1.4 | [UAT-SHEET-1](SHEET.md#uat-sheet-1-edit-a-personal-sheet-and-reload) |
| SHEET-2.1 | [UAT-SHEET-2](SHEET.md#uat-sheet-2-short-and-long-rest) |
| SHEET-2.2 | [UAT-SHEET-2](SHEET.md#uat-sheet-2-short-and-long-rest) |
| SHEET-2.3 | [UAT-SHEET-2](SHEET.md#uat-sheet-2-short-and-long-rest) |
| SHEET-3.1 | [UAT-SHEET-4](SHEET.md#uat-sheet-4-roll-from-the-sheet-and-choose-who-sees-it) |
| SHEET-3.2 | [UAT-SHEET-4](SHEET.md#uat-sheet-4-roll-from-the-sheet-and-choose-who-sees-it) |
| SHEET-3.3 | [UAT-SHEET-4](SHEET.md#uat-sheet-4-roll-from-the-sheet-and-choose-who-sees-it) |
| SHEET-3.4 | [UAT-SHEET-4](SHEET.md#uat-sheet-4-roll-from-the-sheet-and-choose-who-sees-it) |
| SHEET-3.5 | [UAT-SHEET-5](SHEET.md#uat-sheet-5-gm-public-and-private-rolls-with-reveals) |
| SHEET-4.1 | [UAT-SHEET-7](SHEET.md#uat-sheet-7-starting-equipment-on-a-new-character) |
| SHEET-4.2 | [UAT-SHEET-6](SHEET.md#uat-sheet-6-equipment-inventory-attunement-and-deleting-an-item) |
| SHEET-4.3 | [UAT-SHEET-6](SHEET.md#uat-sheet-6-equipment-inventory-attunement-and-deleting-an-item) |
| SHEET-4.4 | [UAT-SHEET-6](SHEET.md#uat-sheet-6-equipment-inventory-attunement-and-deleting-an-item) |
| SHEET-5.1 | Covered elsewhere |
| SHEET-5.2 | [UAT-SHEET-1](SHEET.md#uat-sheet-1-edit-a-personal-sheet-and-reload) |
| SHEET-5.3 | [UAT-SHEET-11](SHEET.md#uat-sheet-11-sheet-during-live-play-and-after-reconnect) |
| SHEET-5.4 | Covered elsewhere |
| SHEET-6.1 | [UAT-SHEET-9](SHEET.md#uat-sheet-9-speed-on-the-overview-and-the-movement-panel) |
| SHEET-7.1 | Covered elsewhere |
| SHEET-8.1 | [UAT-SHEET-8](SHEET.md#uat-sheet-8-hands-two-handed-weapons-and-shields) |
| SHEET-8.2 | [UAT-SHEET-8](SHEET.md#uat-sheet-8-hands-two-handed-weapons-and-shields) |
| SHEET-8.3 | [UAT-SHEET-8](SHEET.md#uat-sheet-8-hands-two-handed-weapons-and-shields) |

</details>

<details>
<summary>CAMPAIGN: 19 of 24 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| CAMPAIGN-1.1 | [UAT-CAMPAIGN-1](CAMPAIGN.md#uat-campaign-1-create-edit-copy-archive-and-delete-a-campaign) |
| CAMPAIGN-1.2 | [UAT-CAMPAIGN-1](CAMPAIGN.md#uat-campaign-1-create-edit-copy-archive-and-delete-a-campaign) |
| CAMPAIGN-1.3 | Covered elsewhere |
| CAMPAIGN-2.1 | [UAT-CAMPAIGN-3](CAMPAIGN.md#uat-campaign-3-players-see-only-what-the-gm-made-visible) |
| CAMPAIGN-2.2 | [UAT-CAMPAIGN-3](CAMPAIGN.md#uat-campaign-3-players-see-only-what-the-gm-made-visible) |
| CAMPAIGN-2.3 | [UAT-CAMPAIGN-2](CAMPAIGN.md#uat-campaign-2-invite-accept-leave-remove-rejoin-and-transfer) |
| CAMPAIGN-2.4 | [UAT-CAMPAIGN-2](CAMPAIGN.md#uat-campaign-2-invite-accept-leave-remove-rejoin-and-transfer) |
| CAMPAIGN-2.5 | [UAT-CAMPAIGN-2](CAMPAIGN.md#uat-campaign-2-invite-accept-leave-remove-rejoin-and-transfer) |
| CAMPAIGN-3.1 | [UAT-CAMPAIGN-4](CAMPAIGN.md#uat-campaign-4-campaign-content-sources-and-removals) |
| CAMPAIGN-3.2 | [UAT-CAMPAIGN-4](CAMPAIGN.md#uat-campaign-4-campaign-content-sources-and-removals) |
| CAMPAIGN-3.3 | [UAT-CAMPAIGN-4](CAMPAIGN.md#uat-campaign-4-campaign-content-sources-and-removals) |
| CAMPAIGN-3.4 | [UAT-CAMPAIGN-4](CAMPAIGN.md#uat-campaign-4-campaign-content-sources-and-removals) |
| CAMPAIGN-3.5 | [UAT-CAMPAIGN-4](CAMPAIGN.md#uat-campaign-4-campaign-content-sources-and-removals) |
| CAMPAIGN-4.1 | [UAT-CAMPAIGN-5](CAMPAIGN.md#uat-campaign-5-party-inventory-and-vehicles) |
| CAMPAIGN-4.2 | Covered elsewhere |
| CAMPAIGN-4.3 | Covered elsewhere |
| CAMPAIGN-5.1 | [UAT-CAMPAIGN-5](CAMPAIGN.md#uat-campaign-5-party-inventory-and-vehicles) |
| CAMPAIGN-5.2 | Covered elsewhere |
| CAMPAIGN-6.1 | [UAT-CAMPAIGN-6](CAMPAIGN.md#uat-campaign-6-announcements) |
| CAMPAIGN-6.2 | [UAT-CAMPAIGN-6](CAMPAIGN.md#uat-campaign-6-announcements) |
| CAMPAIGN-6.3 | [UAT-CAMPAIGN-6](CAMPAIGN.md#uat-campaign-6-announcements) |
| CAMPAIGN-7.1 | [UAT-CAMPAIGN-7](CAMPAIGN.md#uat-campaign-7-the-gm-plays-a-character) |
| CAMPAIGN-8.1 | [UAT-CAMPAIGN-8](CAMPAIGN.md#uat-campaign-8-not-a-member) |
| CAMPAIGN-8.2 | Covered elsewhere |

</details>

<details>
<summary>SOCIAL: 8 of 11 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| SOCIAL-1.1 | [UAT-SOCIAL-1](SOCIAL.md#uat-social-1-create-a-listing-apply-accept-and-fill-a-table), [UAT-SOCIAL-2](SOCIAL.md#uat-social-2-invitations-and-social-hub-navigation) |
| SOCIAL-1.2 | [UAT-SOCIAL-4](SOCIAL.md#uat-social-4-private-profiles-and-masking) |
| SOCIAL-1.3 | Covered elsewhere |
| SOCIAL-1.4 | Covered elsewhere |
| SOCIAL-1.5 | [UAT-SOCIAL-3](SOCIAL.md#uat-social-3-blocks-and-what-they-do) |
| SOCIAL-2.1 | [UAT-SOCIAL-5](SOCIAL.md#uat-social-5-notification-feed-read-state-and-preferences) |
| SOCIAL-2.2 | [UAT-SOCIAL-5](SOCIAL.md#uat-social-5-notification-feed-read-state-and-preferences) |
| SOCIAL-2.3 | [UAT-SOCIAL-5](SOCIAL.md#uat-social-5-notification-feed-read-state-and-preferences) |
| SOCIAL-3.1 | [UAT-SOCIAL-6](SOCIAL.md#uat-social-6-plan-limits-and-capacity) |
| SOCIAL-3.2 | [UAT-SOCIAL-6](SOCIAL.md#uat-social-6-plan-limits-and-capacity) |
| SOCIAL-3.3 | Covered elsewhere |

</details>

<details>
<summary>ROOM: 20 of 38 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| ROOM-1.1 | [UAT-ROOM-1](ROOM.md#uat-room-1-gm-and-three-players-join-at-once) |
| ROOM-1.2 | Covered elsewhere |
| ROOM-1.3 | Covered elsewhere |
| ROOM-1.4 | [UAT-ROOM-3](ROOM.md#uat-room-3-reconnect-after-a-dropped-connection) |
| ROOM-1.5 | [UAT-ROOM-1](ROOM.md#uat-room-1-gm-and-three-players-join-at-once), [UAT-ROOM-10](ROOM.md#uat-room-10-archiving-a-campaign-closes-its-live-room) |
| ROOM-2.1 | [UAT-ROOM-2](ROOM.md#uat-room-2-previews-and-pings) |
| ROOM-2.2 | [UAT-ROOM-3](ROOM.md#uat-room-3-reconnect-after-a-dropped-connection) |
| ROOM-2.3 | [UAT-ROOM-2](ROOM.md#uat-room-2-previews-and-pings) |
| ROOM-3.1 | [UAT-ROOM-4](ROOM.md#uat-room-4-chat--table-party-and-direct) |
| ROOM-3.2 | [UAT-ROOM-6](ROOM.md#uat-room-6-notes--private-and-shared) |
| ROOM-3.3 | [UAT-ROOM-5](ROOM.md#uat-room-5-rolls-private-gm-rolls-and-chat-limits) |
| ROOM-3.4 | [UAT-ROOM-5](ROOM.md#uat-room-5-rolls-private-gm-rolls-and-chat-limits) |
| ROOM-3.5 | [UAT-ROOM-6](ROOM.md#uat-room-6-notes--private-and-shared) |
| ROOM-3.6 | [UAT-ROOM-7](ROOM.md#uat-room-7-show-a-map-to-players-without-presenting) |
| ROOM-4.1 | [UAT-ROOM-8](ROOM.md#uat-room-8-plan-and-log-sessions) |
| ROOM-4.2 | [UAT-ROOM-8](ROOM.md#uat-room-8-plan-and-log-sessions) |
| ROOM-4.3 | Covered elsewhere |
| ROOM-4.4 | Covered elsewhere |
| ROOM-4.5 | [UAT-ROOM-8](ROOM.md#uat-room-8-plan-and-log-sessions) |
| ROOM-5.1 | [UAT-ROOM-9](ROOM.md#uat-room-9-live-play-commands-go-through-the-room) |
| ROOM-5.2 | Covered elsewhere |
| ROOM-5.3 | [UAT-ROOM-9](ROOM.md#uat-room-9-live-play-commands-go-through-the-room) |
| ROOM-5.4 | [UAT-ROOM-9](ROOM.md#uat-room-9-live-play-commands-go-through-the-room) |
| ROOM-6.1 | Covered elsewhere |
| ROOM-6.2 | Covered elsewhere |
| ROOM-6.3 | Covered elsewhere |
| ROOM-6.4 | Covered elsewhere |
| ROOM-6.5 | Covered elsewhere |
| ROOM-6.6 | Covered elsewhere |
| ROOM-6.7 | Covered elsewhere |
| ROOM-6.8 | Covered elsewhere |
| ROOM-6.9 | Covered elsewhere |
| ROOM-6.10 | Covered elsewhere |
| ROOM-6.11 | Covered elsewhere |
| ROOM-6.12 | Covered elsewhere |
| ROOM-6.13 | Covered elsewhere |
| ROOM-6.14 | [UAT-ROOM-9](ROOM.md#uat-room-9-live-play-commands-go-through-the-room) |
| ROOM-7.1 | [UAT-ROOM-4](ROOM.md#uat-room-4-chat--table-party-and-direct) |

</details>

<details>
<summary>SCENE: 15 of 16 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| SCENE-1.1 | [UAT-SCENE-1](SCENE.md#uat-scene-1-upload-a-map-calibrate-and-create-a-scene) |
| SCENE-1.2 | [UAT-SCENE-3](SCENE.md#uat-scene-3-present-a-scene-and-build-it-live) |
| SCENE-1.3 | [UAT-SCENE-6](SCENE.md#uat-scene-6-offline-edits-recover) |
| SCENE-2.1 | [UAT-SCENE-3](SCENE.md#uat-scene-3-present-a-scene-and-build-it-live) |
| SCENE-2.2 | [UAT-SCENE-6](SCENE.md#uat-scene-6-offline-edits-recover) |
| SCENE-2.3 | Covered elsewhere |
| SCENE-2.4 | [UAT-SCENE-5](SCENE.md#uat-scene-5-doors) |
| SCENE-2.5 | [UAT-SCENE-4](SCENE.md#uat-scene-4-fog-of-war-off-shared-and-per-player) |
| SCENE-3.1 | [UAT-SCENE-1](SCENE.md#uat-scene-1-upload-a-map-calibrate-and-create-a-scene), [UAT-SCENE-2](SCENE.md#uat-scene-2-map-upload-refusals) |
| SCENE-3.2 | [UAT-SCENE-7](SCENE.md#uat-scene-7-map-ownership-and-deletion) |
| SCENE-3.3 | [UAT-SCENE-7](SCENE.md#uat-scene-7-map-ownership-and-deletion) |
| SCENE-4.1 | [UAT-SCENE-8](SCENE.md#uat-scene-8-gm-loot-tables) |
| SCENE-4.2 | [UAT-SCENE-8](SCENE.md#uat-scene-8-gm-loot-tables) |
| SCENE-5.1 | [UAT-SCENE-9](SCENE.md#uat-scene-9-one-shared-table-screen-for-several-players) |
| SCENE-5.2 | [UAT-SCENE-9](SCENE.md#uat-scene-9-one-shared-table-screen-for-several-players) |
| SCENE-5.3 | [UAT-SCENE-9](SCENE.md#uat-scene-9-one-shared-table-screen-for-several-players) |

</details>

<details>
<summary>MOVE: 18 of 22 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| MOVE-1.1 | [UAT-MOVE-1](MOVE.md#uat-move-1-a-player-moves-their-own-token), [UAT-MOVE-2](MOVE.md#uat-move-2-refusals-at-walls-hostile-spaces-and-the-map-edge) |
| MOVE-1.2 | [UAT-MOVE-3](MOVE.md#uat-move-3-opportunity-attack-pauses-the-move), [UAT-MOVE-4](MOVE.md#uat-move-4-undo-last-token-move), [UAT-MOVE-7](MOVE.md#uat-move-7-overrun-shove-aside-and-tumble) |
| MOVE-1.3 | [UAT-MOVE-1](MOVE.md#uat-move-1-a-player-moves-their-own-token), [UAT-MOVE-6](MOVE.md#uat-move-6-peers-converge-reload-and-departure) |
| MOVE-1.4 | [UAT-MOVE-5](MOVE.md#uat-move-5-moving-outside-an-encounter-and-in-a-sandbox) |
| MOVE-1.5 | [UAT-MOVE-1](MOVE.md#uat-move-1-a-player-moves-their-own-token) |
| MOVE-2.1 | Covered elsewhere |
| MOVE-2.2 | [UAT-MOVE-7](MOVE.md#uat-move-7-overrun-shove-aside-and-tumble) |
| MOVE-2.3 | Covered elsewhere |
| MOVE-2.4 | [UAT-MOVE-7](MOVE.md#uat-move-7-overrun-shove-aside-and-tumble) |
| MOVE-2.5 | Covered elsewhere |
| MOVE-2.6 | [UAT-MOVE-7](MOVE.md#uat-move-7-overrun-shove-aside-and-tumble) |
| MOVE-3.1 | [UAT-MOVE-8](MOVE.md#uat-move-8-hidden-hazards-traps-and-auras) |
| MOVE-3.2 | [UAT-MOVE-8](MOVE.md#uat-move-8-hidden-hazards-traps-and-auras) |
| MOVE-3.3 | [UAT-MOVE-8](MOVE.md#uat-move-8-hidden-hazards-traps-and-auras) |
| MOVE-3.4 | Covered elsewhere |
| MOVE-3.5 | [UAT-MOVE-8](MOVE.md#uat-move-8-hidden-hazards-traps-and-auras) |
| MOVE-3.6 | [UAT-MOVE-8](MOVE.md#uat-move-8-hidden-hazards-traps-and-auras) |
| MOVE-3.7 | [UAT-MOVE-8](MOVE.md#uat-move-8-hidden-hazards-traps-and-auras) |
| MOVE-4.1 | [UAT-MOVE-9](MOVE.md#uat-move-9-climb-onto-a-larger-creature) |
| MOVE-4.2 | [UAT-MOVE-9](MOVE.md#uat-move-9-climb-onto-a-larger-creature) |
| MOVE-4.3 | [UAT-MOVE-9](MOVE.md#uat-move-9-climb-onto-a-larger-creature) |
| MOVE-4.4 | [UAT-MOVE-9](MOVE.md#uat-move-9-climb-onto-a-larger-creature) |

</details>

<details>
<summary>ENCOUNTER: 29 of 30 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| ENCOUNTER-1.1 | [UAT-ENCOUNTER-3](ENCOUNTER.md#uat-encounter-3-prepare-start-delete-and-persist-a-run) |
| ENCOUNTER-1.2 | [UAT-ENCOUNTER-7](ENCOUNTER.md#uat-encounter-7-blueprint-edits-and-who-can-reach-them) |
| ENCOUNTER-1.3 | [UAT-ENCOUNTER-7](ENCOUNTER.md#uat-encounter-7-blueprint-edits-and-who-can-reach-them) |
| ENCOUNTER-2.1 | [UAT-ENCOUNTER-3](ENCOUNTER.md#uat-encounter-3-prepare-start-delete-and-persist-a-run) |
| ENCOUNTER-2.2 | [UAT-ENCOUNTER-1](ENCOUNTER.md#uat-encounter-1-assisted-and-manual-encounter-journeys-pass), [UAT-ENCOUNTER-3](ENCOUNTER.md#uat-encounter-3-prepare-start-delete-and-persist-a-run) |
| ENCOUNTER-2.3 | [UAT-ENCOUNTER-1](ENCOUNTER.md#uat-encounter-1-assisted-and-manual-encounter-journeys-pass), [UAT-ENCOUNTER-2](ENCOUNTER.md#uat-encounter-2-initiative-and-optional-combat-combinations-pass-end-to-end) |
| ENCOUNTER-2.4 | [UAT-ENCOUNTER-3](ENCOUNTER.md#uat-encounter-3-prepare-start-delete-and-persist-a-run) |
| ENCOUNTER-2.5 | [UAT-ENCOUNTER-3](ENCOUNTER.md#uat-encounter-3-prepare-start-delete-and-persist-a-run) |
| ENCOUNTER-2.6 | Covered elsewhere |
| ENCOUNTER-2.7 | [UAT-ENCOUNTER-1](ENCOUNTER.md#uat-encounter-1-assisted-and-manual-encounter-journeys-pass) |
| ENCOUNTER-3.1 | [UAT-ENCOUNTER-3](ENCOUNTER.md#uat-encounter-3-prepare-start-delete-and-persist-a-run) |
| ENCOUNTER-3.2 | [UAT-ENCOUNTER-2](ENCOUNTER.md#uat-encounter-2-initiative-and-optional-combat-combinations-pass-end-to-end) |
| ENCOUNTER-3.3 | [UAT-ENCOUNTER-1](ENCOUNTER.md#uat-encounter-1-assisted-and-manual-encounter-journeys-pass), [UAT-ENCOUNTER-4](ENCOUNTER.md#uat-encounter-4-controllers-dispositions-and-removing-a-member) |
| ENCOUNTER-3.4 | [UAT-ENCOUNTER-1](ENCOUNTER.md#uat-encounter-1-assisted-and-manual-encounter-journeys-pass), [UAT-ENCOUNTER-4](ENCOUNTER.md#uat-encounter-4-controllers-dispositions-and-removing-a-member) |
| ENCOUNTER-3.5 | [UAT-ENCOUNTER-1](ENCOUNTER.md#uat-encounter-1-assisted-and-manual-encounter-journeys-pass), [UAT-ENCOUNTER-4](ENCOUNTER.md#uat-encounter-4-controllers-dispositions-and-removing-a-member) |
| ENCOUNTER-3.6 | [UAT-ENCOUNTER-1](ENCOUNTER.md#uat-encounter-1-assisted-and-manual-encounter-journeys-pass), [UAT-ENCOUNTER-4](ENCOUNTER.md#uat-encounter-4-controllers-dispositions-and-removing-a-member) |
| ENCOUNTER-3.7 | [UAT-ENCOUNTER-4](ENCOUNTER.md#uat-encounter-4-controllers-dispositions-and-removing-a-member) |
| ENCOUNTER-4.1 | [UAT-ENCOUNTER-2](ENCOUNTER.md#uat-encounter-2-initiative-and-optional-combat-combinations-pass-end-to-end) |
| ENCOUNTER-4.2 | [UAT-ENCOUNTER-2](ENCOUNTER.md#uat-encounter-2-initiative-and-optional-combat-combinations-pass-end-to-end) |
| ENCOUNTER-4.3 | [UAT-ENCOUNTER-2](ENCOUNTER.md#uat-encounter-2-initiative-and-optional-combat-combinations-pass-end-to-end) |
| ENCOUNTER-4.4 | [UAT-ENCOUNTER-2](ENCOUNTER.md#uat-encounter-2-initiative-and-optional-combat-combinations-pass-end-to-end) |
| ENCOUNTER-5.1 | [UAT-ENCOUNTER-1](ENCOUNTER.md#uat-encounter-1-assisted-and-manual-encounter-journeys-pass) |
| ENCOUNTER-6.1 | [UAT-ENCOUNTER-5](ENCOUNTER.md#uat-encounter-5-morale) |
| ENCOUNTER-6.2 | [UAT-ENCOUNTER-5](ENCOUNTER.md#uat-encounter-5-morale) |
| ENCOUNTER-6.3 | [UAT-ENCOUNTER-5](ENCOUNTER.md#uat-encounter-5-morale) |
| ENCOUNTER-7.1 | [UAT-ENCOUNTER-6](ENCOUNTER.md#uat-encounter-6-roll-cards-for-turn-stage-rolls) |
| ENCOUNTER-7.2 | [UAT-ENCOUNTER-6](ENCOUNTER.md#uat-encounter-6-roll-cards-for-turn-stage-rolls) |
| ENCOUNTER-8.1 | [UAT-ENCOUNTER-6](ENCOUNTER.md#uat-encounter-6-roll-cards-for-turn-stage-rolls) |
| ENCOUNTER-9.1 | [UAT-ENCOUNTER-2](ENCOUNTER.md#uat-encounter-2-initiative-and-optional-combat-combinations-pass-end-to-end), [UAT-ENCOUNTER-6](ENCOUNTER.md#uat-encounter-6-roll-cards-for-turn-stage-rolls) |
| ENCOUNTER-10.1 | [UAT-ENCOUNTER-2](ENCOUNTER.md#uat-encounter-2-initiative-and-optional-combat-combinations-pass-end-to-end) |

</details>

<details>
<summary>ATTACK: 84 of 88 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| ATTACK-1.1 | [UAT-ATTACK-1](ATTACK.md#uat-attack-1-effects-movement-reactions-and-the-turn-lifecycle-pass-end-to-end), [UAT-ATTACK-11](ATTACK.md#uat-attack-11-weapons-in-hand-loadouts-and-disarm) |
| ATTACK-1.2 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-1.3 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-2.1 | [UAT-ATTACK-1](ATTACK.md#uat-attack-1-effects-movement-reactions-and-the-turn-lifecycle-pass-end-to-end) |
| ATTACK-2.2 | [UAT-ATTACK-2](ATTACK.md#uat-attack-2-players-control-only-their-own-actors) |
| ATTACK-2.3 | [UAT-ATTACK-2](ATTACK.md#uat-attack-2-players-control-only-their-own-actors) |
| ATTACK-2.4 | [UAT-ATTACK-2](ATTACK.md#uat-attack-2-players-control-only-their-own-actors) |
| ATTACK-2.5 | [UAT-ATTACK-1](ATTACK.md#uat-attack-1-effects-movement-reactions-and-the-turn-lifecycle-pass-end-to-end) |
| ATTACK-3.1 | [UAT-ATTACK-1](ATTACK.md#uat-attack-1-effects-movement-reactions-and-the-turn-lifecycle-pass-end-to-end) |
| ATTACK-3.2 | [UAT-ATTACK-3](ATTACK.md#uat-attack-3-assisted-warnings-and-do-it-anyway) |
| ATTACK-3.3 | [UAT-ATTACK-4](ATTACK.md#uat-attack-4-undo-last-action-and-its-refusals) |
| ATTACK-4.1 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-4.2 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-5.1 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.2 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.3 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.4 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.5 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.6 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.7 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.8 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.9 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.10 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.11 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.12 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.13 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.14 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-5.15 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-6.1 | Covered elsewhere |
| ATTACK-6.2 | Covered elsewhere |
| ATTACK-6.3 | Covered elsewhere |
| ATTACK-6.4 | [UAT-ATTACK-11](ATTACK.md#uat-attack-11-weapons-in-hand-loadouts-and-disarm) |
| ATTACK-6.5 | [UAT-ATTACK-11](ATTACK.md#uat-attack-11-weapons-in-hand-loadouts-and-disarm) |
| ATTACK-6.6 | [UAT-ATTACK-11](ATTACK.md#uat-attack-11-weapons-in-hand-loadouts-and-disarm) |
| ATTACK-7.1 | [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions) |
| ATTACK-7.3 | [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions) |
| ATTACK-7.4 | [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions) |
| ATTACK-7.5 | [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions) |
| ATTACK-7.6 | [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions) |
| ATTACK-7.7 | [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions) |
| ATTACK-7.8 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-7.2 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-7.9 | [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions) |
| ATTACK-8.1 | [UAT-ATTACK-1](ATTACK.md#uat-attack-1-effects-movement-reactions-and-the-turn-lifecycle-pass-end-to-end) |
| ATTACK-8.2 | [UAT-ATTACK-9](ATTACK.md#uat-attack-9-class-features-in-play) |
| ATTACK-8.3 | [UAT-ATTACK-3](ATTACK.md#uat-attack-3-assisted-warnings-and-do-it-anyway) |
| ATTACK-8.4 | [UAT-ATTACK-4](ATTACK.md#uat-attack-4-undo-last-action-and-its-refusals), [UAT-ATTACK-9](ATTACK.md#uat-attack-9-class-features-in-play) |
| ATTACK-9.1 | [UAT-ATTACK-9](ATTACK.md#uat-attack-9-class-features-in-play) |
| ATTACK-9.2 | [UAT-ATTACK-9](ATTACK.md#uat-attack-9-class-features-in-play) |
| ATTACK-9.3 | [UAT-ATTACK-9](ATTACK.md#uat-attack-9-class-features-in-play) |
| ATTACK-9.4 | [UAT-ATTACK-9](ATTACK.md#uat-attack-9-class-features-in-play) |
| ATTACK-9.5 | [UAT-ATTACK-9](ATTACK.md#uat-attack-9-class-features-in-play) |
| ATTACK-9.6 | [UAT-ATTACK-9](ATTACK.md#uat-attack-9-class-features-in-play) |
| ATTACK-10.1 | [UAT-ATTACK-6](ATTACK.md#uat-attack-6-hiding-invisibility-and-unseen-attackers) |
| ATTACK-10.2 | [UAT-ATTACK-6](ATTACK.md#uat-attack-6-hiding-invisibility-and-unseen-attackers) |
| ATTACK-10.3 | [UAT-ATTACK-6](ATTACK.md#uat-attack-6-hiding-invisibility-and-unseen-attackers) |
| ATTACK-10.4 | [UAT-ATTACK-6](ATTACK.md#uat-attack-6-hiding-invisibility-and-unseen-attackers) |
| ATTACK-10.5 | [UAT-ATTACK-5](ATTACK.md#uat-attack-5-targeting-hidden-creatures-and-private-roll-cards) |
| ATTACK-10.6 | [UAT-ATTACK-5](ATTACK.md#uat-attack-5-targeting-hidden-creatures-and-private-roll-cards) |
| ATTACK-11.1 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-11.2 | Covered elsewhere |
| ATTACK-11.3 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-11.4 | [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks) |
| ATTACK-12.1 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-12.2 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-12.3 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-12.4 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-13.1 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-13.2 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-13.3 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-15.1 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-15.2 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-15.3 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-16.1 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-16.2 | [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play) |
| ATTACK-17.1 | [UAT-ATTACK-1](ATTACK.md#uat-attack-1-effects-movement-reactions-and-the-turn-lifecycle-pass-end-to-end) |
| ATTACK-17.2 | [UAT-ATTACK-1](ATTACK.md#uat-attack-1-effects-movement-reactions-and-the-turn-lifecycle-pass-end-to-end) |
| ATTACK-17.3 | [UAT-ATTACK-5](ATTACK.md#uat-attack-5-targeting-hidden-creatures-and-private-roll-cards) |
| ATTACK-17.4 | [UAT-ATTACK-5](ATTACK.md#uat-attack-5-targeting-hidden-creatures-and-private-roll-cards) |
| ATTACK-17.5 | [UAT-ATTACK-5](ATTACK.md#uat-attack-5-targeting-hidden-creatures-and-private-roll-cards) |
| ATTACK-17.6 | [UAT-ATTACK-5](ATTACK.md#uat-attack-5-targeting-hidden-creatures-and-private-roll-cards) |
| ATTACK-18.1 | [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions) |
| ATTACK-18.2 | [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions) |
| ATTACK-18.3 | [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions) |
| ATTACK-19.1 | [UAT-ATTACK-1](ATTACK.md#uat-attack-1-effects-movement-reactions-and-the-turn-lifecycle-pass-end-to-end), [UAT-ATTACK-11](ATTACK.md#uat-attack-11-weapons-in-hand-loadouts-and-disarm) |
| ATTACK-19.2 | [UAT-ATTACK-11](ATTACK.md#uat-attack-11-weapons-in-hand-loadouts-and-disarm) |
| ATTACK-19.3 | [UAT-ATTACK-11](ATTACK.md#uat-attack-11-weapons-in-hand-loadouts-and-disarm) |
| ATTACK-19.4 | [UAT-ATTACK-11](ATTACK.md#uat-attack-11-weapons-in-hand-loadouts-and-disarm) |

</details>

<details>
<summary>SPELLS: 98 of 102 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| SPELLS-1.1 | [UAT-SPELLS-3](SPELLS.md#uat-spells-3-fireball-on-a-group-with-saves-answered-by-different-controllers), [UAT-SPELLS-24](SPELLS.md#uat-spells-24-privacy-and-permissions-refusals) |
| SPELLS-1.2 | [UAT-SPELLS-3](SPELLS.md#uat-spells-3-fireball-on-a-group-with-saves-answered-by-different-controllers), [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end), [UAT-SPELLS-23](SPELLS.md#uat-spells-23-manual-mode-raises-no-rules-prompts), [UAT-SPELLS-24](SPELLS.md#uat-spells-24-privacy-and-permissions-refusals) |
| SPELLS-2.1 | [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end), [UAT-SPELLS-8](SPELLS.md#uat-spells-8-attack-and-check-modifiers-from-conditions) |
| SPELLS-2.2 | [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end), [UAT-SPELLS-8](SPELLS.md#uat-spells-8-attack-and-check-modifiers-from-conditions) |
| SPELLS-2.3 | [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end) |
| SPELLS-2.4 | [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end), [UAT-SPELLS-9](SPELLS.md#uat-spells-9-exhaustion-4-and-6-petrified-resistance-nonmagical-defenses-and-automatic-failures) |
| SPELLS-2.5 | [UAT-SPELLS-8](SPELLS.md#uat-spells-8-attack-and-check-modifiers-from-conditions) |
| SPELLS-2.6 | [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end), [UAT-SPELLS-8](SPELLS.md#uat-spells-8-attack-and-check-modifiers-from-conditions) |
| SPELLS-2.7 | [UAT-SPELLS-8](SPELLS.md#uat-spells-8-attack-and-check-modifiers-from-conditions) |
| SPELLS-3.1 | [UAT-SPELLS-10](SPELLS.md#uat-spells-10-dying-death-saves-healing-and-kills) |
| SPELLS-3.2 | [UAT-SPELLS-10](SPELLS.md#uat-spells-10-dying-death-saves-healing-and-kills) |
| SPELLS-3.3 | [UAT-SPELLS-1](SPELLS.md#uat-spells-1-build-the-casters-and-cast-from-the-sheet-outside-an-encounter), [UAT-SPELLS-10](SPELLS.md#uat-spells-10-dying-death-saves-healing-and-kills) |
| SPELLS-3.4 | [UAT-SPELLS-10](SPELLS.md#uat-spells-10-dying-death-saves-healing-and-kills) |
| SPELLS-3.5 | [UAT-SPELLS-10](SPELLS.md#uat-spells-10-dying-death-saves-healing-and-kills), [UAT-SPELLS-11](SPELLS.md#uat-spells-11-stabilizing-spare-the-dying-healers-kit-and-first-aid) |
| SPELLS-3.6 | [UAT-SPELLS-1](SPELLS.md#uat-spells-1-build-the-casters-and-cast-from-the-sheet-outside-an-encounter), [UAT-SPELLS-25](SPELLS.md#uat-spells-25-phone-width-sheet-death-saves-and-summons) |
| SPELLS-3.7 | [UAT-SPELLS-11](SPELLS.md#uat-spells-11-stabilizing-spare-the-dying-healers-kit-and-first-aid) |
| SPELLS-4.1 | Covered elsewhere |
| SPELLS-4.2 | [UAT-SPELLS-19](SPELLS.md#uat-spells-19-zones-auras-and-lasting-hazards) |
| SPELLS-5.1 | [UAT-SPELLS-12](SPELLS.md#uat-spells-12-single-use-items-and-antitoxin) |
| SPELLS-5.2 | [UAT-SPELLS-12](SPELLS.md#uat-spells-12-single-use-items-and-antitoxin) |
| SPELLS-5.3 | [UAT-SPELLS-15](SPELLS.md#uat-spells-15-grant-spells-and-their-lifetimes) |
| SPELLS-5.4 | [UAT-SPELLS-13](SPELLS.md#uat-spells-13-reaction-spells-shield-and-counterspell-one-roll-grants), [UAT-SPELLS-15](SPELLS.md#uat-spells-15-grant-spells-and-their-lifetimes) |
| SPELLS-5.5 | [UAT-SPELLS-13](SPELLS.md#uat-spells-13-reaction-spells-shield-and-counterspell-one-roll-grants) |
| SPELLS-5.6 | [UAT-SPELLS-15](SPELLS.md#uat-spells-15-grant-spells-and-their-lifetimes) |
| SPELLS-5.7 | [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end), [UAT-SPELLS-15](SPELLS.md#uat-spells-15-grant-spells-and-their-lifetimes) |
| SPELLS-5.8 | [UAT-SPELLS-15](SPELLS.md#uat-spells-15-grant-spells-and-their-lifetimes) |
| SPELLS-5.9 | [UAT-SPELLS-16](SPELLS.md#uat-spells-16-grants-and-concentration-carry-over-after-the-encounter) |
| SPELLS-5.10 | [UAT-SPELLS-13](SPELLS.md#uat-spells-13-reaction-spells-shield-and-counterspell-one-roll-grants), [UAT-SPELLS-15](SPELLS.md#uat-spells-15-grant-spells-and-their-lifetimes) |
| SPELLS-5.11 | [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end), [UAT-SPELLS-16](SPELLS.md#uat-spells-16-grants-and-concentration-carry-over-after-the-encounter) |
| SPELLS-5.12 | [UAT-SPELLS-16](SPELLS.md#uat-spells-16-grants-and-concentration-carry-over-after-the-encounter) |
| SPELLS-5.13 | [UAT-SPELLS-16](SPELLS.md#uat-spells-16-grants-and-concentration-carry-over-after-the-encounter) |
| SPELLS-5.14 | [UAT-SPELLS-16](SPELLS.md#uat-spells-16-grants-and-concentration-carry-over-after-the-encounter) |
| SPELLS-6.1 | Covered elsewhere |
| SPELLS-7.1 | [UAT-SPELLS-3](SPELLS.md#uat-spells-3-fireball-on-a-group-with-saves-answered-by-different-controllers) |
| SPELLS-7.2 | [UAT-SPELLS-3](SPELLS.md#uat-spells-3-fireball-on-a-group-with-saves-answered-by-different-controllers) |
| SPELLS-7.3 | [UAT-SPELLS-4](SPELLS.md#uat-spells-4-area-caster-cannot-see-a-hidden-creature) |
| SPELLS-8.1 | [UAT-SPELLS-2](SPELLS.md#uat-spells-2-set-up-the-spell-arena-encounter-assisted), [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end) |
| SPELLS-8.2 | [UAT-SPELLS-11](SPELLS.md#uat-spells-11-stabilizing-spare-the-dying-healers-kit-and-first-aid) |
| SPELLS-8.3 | [UAT-SPELLS-13](SPELLS.md#uat-spells-13-reaction-spells-shield-and-counterspell-one-roll-grants), [UAT-SPELLS-15](SPELLS.md#uat-spells-15-grant-spells-and-their-lifetimes) |
| SPELLS-8.4 | [UAT-SPELLS-3](SPELLS.md#uat-spells-3-fireball-on-a-group-with-saves-answered-by-different-controllers) |
| SPELLS-8.5 | [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end) |
| SPELLS-8.6 | [UAT-SPELLS-26](SPELLS.md#uat-spells-26-sheet-attack-rows-match-the-room-and-an-always-on-feature-that-rests-restore-tranquility) |
| SPELLS-9.1 | [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end), [UAT-SPELLS-9](SPELLS.md#uat-spells-9-exhaustion-4-and-6-petrified-resistance-nonmagical-defenses-and-automatic-failures) |
| SPELLS-9.2 | [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end), [UAT-SPELLS-9](SPELLS.md#uat-spells-9-exhaustion-4-and-6-petrified-resistance-nonmagical-defenses-and-automatic-failures) |
| SPELLS-10.1 | [UAT-SPELLS-9](SPELLS.md#uat-spells-9-exhaustion-4-and-6-petrified-resistance-nonmagical-defenses-and-automatic-failures) |
| SPELLS-10.2 | [UAT-SPELLS-9](SPELLS.md#uat-spells-9-exhaustion-4-and-6-petrified-resistance-nonmagical-defenses-and-automatic-failures) |
| SPELLS-10.3 | [UAT-SPELLS-9](SPELLS.md#uat-spells-9-exhaustion-4-and-6-petrified-resistance-nonmagical-defenses-and-automatic-failures) |
| SPELLS-10.4 | [UAT-SPELLS-9](SPELLS.md#uat-spells-9-exhaustion-4-and-6-petrified-resistance-nonmagical-defenses-and-automatic-failures) |
| SPELLS-10.5 | [UAT-SPELLS-9](SPELLS.md#uat-spells-9-exhaustion-4-and-6-petrified-resistance-nonmagical-defenses-and-automatic-failures) |
| SPELLS-10.6 | [UAT-SPELLS-9](SPELLS.md#uat-spells-9-exhaustion-4-and-6-petrified-resistance-nonmagical-defenses-and-automatic-failures) |
| SPELLS-11.1 | [UAT-SPELLS-12](SPELLS.md#uat-spells-12-single-use-items-and-antitoxin) |
| SPELLS-11.2 | [UAT-SPELLS-12](SPELLS.md#uat-spells-12-single-use-items-and-antitoxin) |
| SPELLS-11.3 | [UAT-SPELLS-12](SPELLS.md#uat-spells-12-single-use-items-and-antitoxin) |
| SPELLS-12.1 | [UAT-SPELLS-17](SPELLS.md#uat-spells-17-two-concentrations-with-an-authored-ring) |
| SPELLS-12.2 | [UAT-SPELLS-17](SPELLS.md#uat-spells-17-two-concentrations-with-an-authored-ring) |
| SPELLS-12.3 | [UAT-SPELLS-17](SPELLS.md#uat-spells-17-two-concentrations-with-an-authored-ring) |
| SPELLS-13.1 | [UAT-SPELLS-5](SPELLS.md#uat-spells-5-cones-lines-self-cubes-and-aiming-on-the-map) |
| SPELLS-13.2 | [UAT-SPELLS-5](SPELLS.md#uat-spells-5-cones-lines-self-cubes-and-aiming-on-the-map) |
| SPELLS-14.1 | [UAT-SPELLS-6](SPELLS.md#uat-spells-6-cover-from-walls-and-manual-cover) |
| SPELLS-14.2 | [UAT-SPELLS-6](SPELLS.md#uat-spells-6-cover-from-walls-and-manual-cover) |
| SPELLS-15.1 | [UAT-SPELLS-18](SPELLS.md#uat-spells-18-dragons-breath-weapons-and-legendary-resistance) |
| SPELLS-16.1 | [UAT-SPELLS-3](SPELLS.md#uat-spells-3-fireball-on-a-group-with-saves-answered-by-different-controllers) |
| SPELLS-17.1 | [UAT-SPELLS-19](SPELLS.md#uat-spells-19-zones-auras-and-lasting-hazards) |
| SPELLS-17.2 | [UAT-SPELLS-19](SPELLS.md#uat-spells-19-zones-auras-and-lasting-hazards) |
| SPELLS-17.3 | [UAT-SPELLS-19](SPELLS.md#uat-spells-19-zones-auras-and-lasting-hazards) |
| SPELLS-17.4 | [UAT-SPELLS-19](SPELLS.md#uat-spells-19-zones-auras-and-lasting-hazards) |
| SPELLS-17.5 | [UAT-SPELLS-19](SPELLS.md#uat-spells-19-zones-auras-and-lasting-hazards) |
| SPELLS-17.6 | [UAT-SPELLS-27](SPELLS.md#uat-spells-27-racial-traits-creature-traits-and-eldritch-blast) |
| SPELLS-18.1 | [UAT-SPELLS-18](SPELLS.md#uat-spells-18-dragons-breath-weapons-and-legendary-resistance) |
| SPELLS-19.1 | [UAT-SPELLS-18](SPELLS.md#uat-spells-18-dragons-breath-weapons-and-legendary-resistance) |
| SPELLS-19.2 | [UAT-SPELLS-18](SPELLS.md#uat-spells-18-dragons-breath-weapons-and-legendary-resistance) |
| SPELLS-20.1 | [UAT-SPELLS-19](SPELLS.md#uat-spells-19-zones-auras-and-lasting-hazards) |
| SPELLS-21.1 | [UAT-SPELLS-18](SPELLS.md#uat-spells-18-dragons-breath-weapons-and-legendary-resistance) |
| SPELLS-22.1 | [UAT-SPELLS-5](SPELLS.md#uat-spells-5-cones-lines-self-cubes-and-aiming-on-the-map) |
| SPELLS-23.1 | [UAT-SPELLS-5](SPELLS.md#uat-spells-5-cones-lines-self-cubes-and-aiming-on-the-map) |
| SPELLS-23.2 | [UAT-SPELLS-5](SPELLS.md#uat-spells-5-cones-lines-self-cubes-and-aiming-on-the-map) |
| SPELLS-24.1 | [UAT-SPELLS-19](SPELLS.md#uat-spells-19-zones-auras-and-lasting-hazards) |
| SPELLS-25.1 | Covered elsewhere |
| SPELLS-26.1 | [UAT-SPELLS-20](SPELLS.md#uat-spells-20-multi-target-spells-and-teleports), [UAT-SPELLS-27](SPELLS.md#uat-spells-27-racial-traits-creature-traits-and-eldritch-blast) |
| SPELLS-28.1 | [UAT-SPELLS-20](SPELLS.md#uat-spells-20-multi-target-spells-and-teleports) |
| SPELLS-28.2 | [UAT-SPELLS-20](SPELLS.md#uat-spells-20-multi-target-spells-and-teleports) |
| SPELLS-27.1 | [UAT-SPELLS-21](SPELLS.md#uat-spells-21-invisibility-sanctuary-fear-and-blindness) |
| SPELLS-27.2 | [UAT-SPELLS-21](SPELLS.md#uat-spells-21-invisibility-sanctuary-fear-and-blindness) |
| SPELLS-29.1 | [UAT-SPELLS-21](SPELLS.md#uat-spells-21-invisibility-sanctuary-fear-and-blindness) |
| SPELLS-29.2 | [UAT-SPELLS-21](SPELLS.md#uat-spells-21-invisibility-sanctuary-fear-and-blindness) |
| SPELLS-30.1 | [UAT-SPELLS-15](SPELLS.md#uat-spells-15-grant-spells-and-their-lifetimes), [UAT-SPELLS-19](SPELLS.md#uat-spells-19-zones-auras-and-lasting-hazards), [UAT-SPELLS-21](SPELLS.md#uat-spells-21-invisibility-sanctuary-fear-and-blindness) |
| SPELLS-31.1 | Covered elsewhere |
| SPELLS-31.2 | [UAT-SPELLS-26](SPELLS.md#uat-spells-26-sheet-attack-rows-match-the-room-and-an-always-on-feature-that-rests-restore-tranquility) |
| SPELLS-31.3 | [UAT-SPELLS-14](SPELLS.md#uat-spells-14-reaction-countdown-timer) |
| SPELLS-32.1 (internal PBI) | [UAT-SPELLS-27](SPELLS.md#uat-spells-27-racial-traits-creature-traits-and-eldritch-blast) |
| SPELLS-33.1 | [UAT-SPELLS-27](SPELLS.md#uat-spells-27-racial-traits-creature-traits-and-eldritch-blast) |
| SPELLS-34.1 | [UAT-SPELLS-1](SPELLS.md#uat-spells-1-build-the-casters-and-cast-from-the-sheet-outside-an-encounter), [UAT-SPELLS-25](SPELLS.md#uat-spells-25-phone-width-sheet-death-saves-and-summons) |
| SPELLS-34.2 | [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends) |
| SPELLS-34.3 | [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends) |
| SPELLS-34.4 | [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends) |
| SPELLS-34.5 | [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends) |
| SPELLS-35.1 | [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends) |
| SPELLS-35.2 | [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends) |
| SPELLS-35.3 | [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends) |
| SPELLS-35.4 | [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends) |
| SPELLS-35.5 | [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends) |
| SPELLS-35.6 | [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends) |

</details>

<details>
<summary>REACTION: 14 of 14 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| REACTION-1.1 | [UAT-REACTION-1](REACTION.md#uat-reaction-1-shield-prompts-the-right-player-while-the-attacker-waits), [UAT-REACTION-2](REACTION.md#uat-reaction-2-only-the-right-controller-answers-gm-skip-decision), [UAT-REACTION-7](REACTION.md#uat-reaction-7-reconnect-while-a-decision-is-open) |
| REACTION-1.2 | [UAT-REACTION-1](REACTION.md#uat-reaction-1-shield-prompts-the-right-player-while-the-attacker-waits), [UAT-REACTION-2](REACTION.md#uat-reaction-2-only-the-right-controller-answers-gm-skip-decision), [UAT-REACTION-7](REACTION.md#uat-reaction-7-reconnect-while-a-decision-is-open) |
| REACTION-1.3 | [UAT-REACTION-6](REACTION.md#uat-reaction-6-disarm-evidence-from-participants) |
| REACTION-1.4 | [UAT-REACTION-2](REACTION.md#uat-reaction-2-only-the-right-controller-answers-gm-skip-decision) |
| REACTION-2.1 | [UAT-REACTION-3](REACTION.md#uat-reaction-3-roll-prompts-auto-roll-on-versus-off) |
| REACTION-2.2 | [UAT-REACTION-3](REACTION.md#uat-reaction-3-roll-prompts-auto-roll-on-versus-off) |
| REACTION-2.3 | [UAT-REACTION-3](REACTION.md#uat-reaction-3-roll-prompts-auto-roll-on-versus-off) |
| REACTION-2.4 | [UAT-REACTION-3](REACTION.md#uat-reaction-3-roll-prompts-auto-roll-on-versus-off) |
| REACTION-3.1 | [UAT-REACTION-1](REACTION.md#uat-reaction-1-shield-prompts-the-right-player-while-the-attacker-waits), [UAT-REACTION-2](REACTION.md#uat-reaction-2-only-the-right-controller-answers-gm-skip-decision) |
| REACTION-4.1 | [UAT-REACTION-1](REACTION.md#uat-reaction-1-shield-prompts-the-right-player-while-the-attacker-waits), [UAT-REACTION-4](REACTION.md#uat-reaction-4-counterspell-and-chains) |
| REACTION-4.2 | [UAT-REACTION-5](REACTION.md#uat-reaction-5-an-authored-reaction-spell-absorb-elements) |
| REACTION-4.3 | [UAT-REACTION-4](REACTION.md#uat-reaction-4-counterspell-and-chains) |
| REACTION-4.4 | [UAT-REACTION-1](REACTION.md#uat-reaction-1-shield-prompts-the-right-player-while-the-attacker-waits) |
| REACTION-4.5 | [UAT-REACTION-1](REACTION.md#uat-reaction-1-shield-prompts-the-right-player-while-the-attacker-waits) |

</details>

<details>
<summary>PRIVACY: 10 of 11 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| PRIVACY-1.1 | [UAT-PRIVACY-1](PRIVACY.md#uat-privacy-1-what-a-player-sees-of-the-encounter), [UAT-PRIVACY-2](PRIVACY.md#uat-privacy-2-gm-private-rolls-and-monster-rolls) |
| PRIVACY-1.2 | [UAT-PRIVACY-3](PRIVACY.md#uat-privacy-3-non-members-removed-players-and-signed-out-visitors), [UAT-PRIVACY-4](PRIVACY.md#uat-privacy-4-ownership-transfer-changes-who-sees-what) |
| PRIVACY-1.3 | Covered elsewhere |
| PRIVACY-1.4 | [UAT-PRIVACY-1](PRIVACY.md#uat-privacy-1-what-a-player-sees-of-the-encounter), [UAT-PRIVACY-2](PRIVACY.md#uat-privacy-2-gm-private-rolls-and-monster-rolls), [UAT-PRIVACY-5](PRIVACY.md#uat-privacy-5-reloads-and-replays-do-not-leak) |
| PRIVACY-1.5 | [UAT-PRIVACY-5](PRIVACY.md#uat-privacy-5-reloads-and-replays-do-not-leak) |
| PRIVACY-1.6 | [UAT-PRIVACY-1](PRIVACY.md#uat-privacy-1-what-a-player-sees-of-the-encounter) |
| PRIVACY-1.7 | [UAT-PRIVACY-4](PRIVACY.md#uat-privacy-4-ownership-transfer-changes-who-sees-what) |
| PRIVACY-2.1 | [UAT-PRIVACY-6](PRIVACY.md#uat-privacy-6-health-display-settings) |
| PRIVACY-3.1 | [UAT-PRIVACY-7](PRIVACY.md#uat-privacy-7-other-players-sheets-and-campaign-roster) |
| PRIVACY-3.2 | [UAT-PRIVACY-8](PRIVACY.md#uat-privacy-8-campaign-content-stays-hidden-until-revealed) |
| PRIVACY-4.1 | [UAT-PRIVACY-9](PRIVACY.md#uat-privacy-9-a-hidden-concentration-source-stays-hidden) |

</details>

<details>
<summary>RELIABILITY: 36 of 92 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| RELIABILITY-1.1 | [UAT-RELIABILITY-1](RELIABILITY.md#uat-reliability-1-privacy-replay-rollback-concurrency-and-performance-hold-together) |
| RELIABILITY-1.2 | [UAT-RELIABILITY-1](RELIABILITY.md#uat-reliability-1-privacy-replay-rollback-concurrency-and-performance-hold-together) |
| RELIABILITY-1.3 | [UAT-RELIABILITY-6](RELIABILITY.md#uat-reliability-6-a-contested-passage-holds-then-spends-once) |
| RELIABILITY-2.1 | [UAT-RELIABILITY-2](RELIABILITY.md#uat-reliability-2-two-users-act-at-the-same-moment) |
| RELIABILITY-2.2 | [UAT-RELIABILITY-2](RELIABILITY.md#uat-reliability-2-two-users-act-at-the-same-moment) |
| RELIABILITY-2.3 | [UAT-RELIABILITY-2](RELIABILITY.md#uat-reliability-2-two-users-act-at-the-same-moment) |
| RELIABILITY-2.4 | [UAT-RELIABILITY-2](RELIABILITY.md#uat-reliability-2-two-users-act-at-the-same-moment) |
| RELIABILITY-2.5 | [UAT-RELIABILITY-3](RELIABILITY.md#uat-reliability-3-the-room-closes-after-everyone-leaves-and-reopens-with-state-intact) |
| RELIABILITY-2.6 | [UAT-RELIABILITY-3](RELIABILITY.md#uat-reliability-3-the-room-closes-after-everyone-leaves-and-reopens-with-state-intact) |
| RELIABILITY-3.1 | [UAT-RELIABILITY-1](RELIABILITY.md#uat-reliability-1-privacy-replay-rollback-concurrency-and-performance-hold-together) |
| RELIABILITY-4.1 | [UAT-RELIABILITY-4](RELIABILITY.md#uat-reliability-4-a-new-scene-measures-lengths-correctly-in-every-unit) |
| RELIABILITY-4.2 | [UAT-RELIABILITY-4](RELIABILITY.md#uat-reliability-4-a-new-scene-measures-lengths-correctly-in-every-unit) |
| RELIABILITY-5.1 | [UAT-RELIABILITY-7](RELIABILITY.md#uat-reliability-7-authored-speed-and-sense-bonuses-use-the-right-length-unit) |
| RELIABILITY-5.2 | Covered elsewhere |
| RELIABILITY-6.1 | [UAT-RELIABILITY-8](RELIABILITY.md#uat-reliability-8-the-sheet-shows-correct-rests-ability-checks-and-hit-points) |
| RELIABILITY-6.2 | Covered elsewhere |
| RELIABILITY-6.3 | [UAT-RELIABILITY-8](RELIABILITY.md#uat-reliability-8-the-sheet-shows-correct-rests-ability-checks-and-hit-points) |
| RELIABILITY-6.4 | Covered elsewhere |
| RELIABILITY-6.5 | [UAT-RELIABILITY-10](RELIABILITY.md#uat-reliability-10-builder-and-party-inventory-values-are-right) |
| RELIABILITY-6.6 | Covered elsewhere |
| RELIABILITY-6.7 | Covered elsewhere |
| RELIABILITY-6.8 | Covered elsewhere |
| RELIABILITY-6.9 | [UAT-RELIABILITY-9](RELIABILITY.md#uat-reliability-9-roll-reasons-and-initiative-read-the-right-source) |
| RELIABILITY-6.10 | Covered elsewhere |
| RELIABILITY-6.11 | Covered elsewhere |
| RELIABILITY-6.12 | Covered elsewhere |
| RELIABILITY-6.13 | [UAT-RELIABILITY-10](RELIABILITY.md#uat-reliability-10-builder-and-party-inventory-values-are-right) |
| RELIABILITY-6.14 | Covered elsewhere |
| RELIABILITY-6.15 | [UAT-RELIABILITY-9](RELIABILITY.md#uat-reliability-9-roll-reasons-and-initiative-read-the-right-source) |
| RELIABILITY-6.16 | Covered elsewhere |
| RELIABILITY-6.17 | [UAT-RELIABILITY-10](RELIABILITY.md#uat-reliability-10-builder-and-party-inventory-values-are-right) |
| RELIABILITY-6.18 | Covered elsewhere |
| RELIABILITY-6.19 | [UAT-RELIABILITY-8](RELIABILITY.md#uat-reliability-8-the-sheet-shows-correct-rests-ability-checks-and-hit-points) |
| RELIABILITY-7.1 | Covered elsewhere |
| RELIABILITY-7.2 | [UAT-RELIABILITY-10](RELIABILITY.md#uat-reliability-10-builder-and-party-inventory-values-are-right) |
| RELIABILITY-8.1 (internal PBI) | Covered elsewhere |
| RELIABILITY-8.2 (internal PBI) | [UAT-RELIABILITY-11](RELIABILITY.md#uat-reliability-11-authoring-selects-labels-and-lists) |
| RELIABILITY-8.3 (internal PBI) | [UAT-RELIABILITY-5](RELIABILITY.md#uat-reliability-5-forms-and-sign-out-recover-without-silent-data-loss) |
| RELIABILITY-8.4 (internal PBI) | [UAT-RELIABILITY-11](RELIABILITY.md#uat-reliability-11-authoring-selects-labels-and-lists) |
| RELIABILITY-8.5 (internal PBI) | Covered elsewhere |
| RELIABILITY-8.6 (internal PBI) | Covered elsewhere |
| RELIABILITY-8.7 (internal PBI) | [UAT-RELIABILITY-11](RELIABILITY.md#uat-reliability-11-authoring-selects-labels-and-lists) |
| RELIABILITY-9.1 | [UAT-RELIABILITY-5](RELIABILITY.md#uat-reliability-5-forms-and-sign-out-recover-without-silent-data-loss) |
| RELIABILITY-9.2 | [UAT-RELIABILITY-11](RELIABILITY.md#uat-reliability-11-authoring-selects-labels-and-lists) |
| RELIABILITY-9.3 | Covered elsewhere |
| RELIABILITY-9.4 | Covered elsewhere |
| RELIABILITY-9.6 | [UAT-RELIABILITY-5](RELIABILITY.md#uat-reliability-5-forms-and-sign-out-recover-without-silent-data-loss) |
| RELIABILITY-9.7 | Covered elsewhere |
| RELIABILITY-9.8 | Covered elsewhere |
| RELIABILITY-10.1 | Covered elsewhere |
| RELIABILITY-10.2 | Covered elsewhere |
| RELIABILITY-10.3 | [UAT-RELIABILITY-10](RELIABILITY.md#uat-reliability-10-builder-and-party-inventory-values-are-right) |
| RELIABILITY-11.1 | Covered elsewhere |
| RELIABILITY-12.1 (internal PBI) | Covered elsewhere |
| RELIABILITY-12.2 (internal PBI) | Covered elsewhere |
| RELIABILITY-13.1 | Covered elsewhere |
| RELIABILITY-14.1 | Covered elsewhere |
| RELIABILITY-15.1 | Covered elsewhere |
| RELIABILITY-15.2 | Covered elsewhere |
| RELIABILITY-15.3 | Covered elsewhere |
| RELIABILITY-16.1 | Covered elsewhere |
| RELIABILITY-17.1 | Covered elsewhere |
| RELIABILITY-18.1 | Covered elsewhere |
| RELIABILITY-19.1 | Covered elsewhere |
| RELIABILITY-19.2 | Covered elsewhere |
| RELIABILITY-19.3 | Covered elsewhere |
| RELIABILITY-20.1 | Covered elsewhere |
| RELIABILITY-20.2 | Covered elsewhere |
| RELIABILITY-20.3 | Covered elsewhere |
| RELIABILITY-20.4 | Covered elsewhere |
| RELIABILITY-20.5 | Covered elsewhere |
| RELIABILITY-21.1 | [UAT-RELIABILITY-12](RELIABILITY.md#uat-reliability-12-core-pages-open-with-their-data) |
| RELIABILITY-21.2 | [UAT-RELIABILITY-12](RELIABILITY.md#uat-reliability-12-core-pages-open-with-their-data) |
| RELIABILITY-21.3 | [UAT-RELIABILITY-12](RELIABILITY.md#uat-reliability-12-core-pages-open-with-their-data) |
| RELIABILITY-21.4 | [UAT-RELIABILITY-12](RELIABILITY.md#uat-reliability-12-core-pages-open-with-their-data) |
| RELIABILITY-21.5 | Covered elsewhere |
| RELIABILITY-21.6 | Covered elsewhere |
| RELIABILITY-21.7 | Covered elsewhere |
| RELIABILITY-21.8 | [UAT-RELIABILITY-13](RELIABILITY.md#uat-reliability-13-account-deletion-closes-the-live-table) (blocked) |
| RELIABILITY-21.9 | Covered elsewhere |
| RELIABILITY-21.10 | Covered elsewhere |
| RELIABILITY-21.11 | Covered elsewhere |
| RELIABILITY-21.12 | Covered elsewhere |
| RELIABILITY-21.13 | Covered elsewhere |
| RELIABILITY-21.14 | [UAT-RELIABILITY-5](RELIABILITY.md#uat-reliability-5-forms-and-sign-out-recover-without-silent-data-loss) |
| RELIABILITY-21.15 | Covered elsewhere |
| RELIABILITY-21.16 | Covered elsewhere |
| RELIABILITY-21.17 | Covered elsewhere |
| RELIABILITY-21.18 | Covered elsewhere |
| RELIABILITY-21.19 | Covered elsewhere |
| RELIABILITY-21.20 | Covered elsewhere |
| RELIABILITY-21.21 | Covered elsewhere |

</details>

<details>
<summary>VTT_UI: 12 of 13 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| VTT_UI-1.1 | [UAT-VTT_UI-1](VTT_UI.md#uat-vtt_ui-1-token-identity-status-rings-facing-and-system-state) |
| VTT_UI-1.2 | [UAT-VTT_UI-1](VTT_UI.md#uat-vtt_ui-1-token-identity-status-rings-facing-and-system-state) |
| VTT_UI-1.3 | [UAT-VTT_UI-1](VTT_UI.md#uat-vtt_ui-1-token-identity-status-rings-facing-and-system-state) |
| VTT_UI-2.1 | [UAT-VTT_UI-1](VTT_UI.md#uat-vtt_ui-1-token-identity-status-rings-facing-and-system-state) |
| VTT_UI-3.1 | [UAT-VTT_UI-2](VTT_UI.md#uat-vtt_ui-2-previews-footprints-large-tokens-and-dragging) |
| VTT_UI-3.2 | [UAT-VTT_UI-3](VTT_UI.md#uat-vtt_ui-3-light-fog-senses-and-the-gms-view-preview) |
| VTT_UI-3.4 | [UAT-VTT_UI-3](VTT_UI.md#uat-vtt_ui-3-light-fog-senses-and-the-gms-view-preview) |
| VTT_UI-3.5 | [UAT-VTT_UI-3](VTT_UI.md#uat-vtt_ui-3-light-fog-senses-and-the-gms-view-preview) |
| VTT_UI-3.3 | [UAT-VTT_UI-2](VTT_UI.md#uat-vtt_ui-2-previews-footprints-large-tokens-and-dragging) |
| VTT_UI-4.1 | [UAT-VTT_UI-4](VTT_UI.md#uat-vtt_ui-4-keyboard-screen-reader-and-low-zoom) |
| VTT_UI-4.2 | [UAT-VTT_UI-4](VTT_UI.md#uat-vtt_ui-4-keyboard-screen-reader-and-low-zoom) |
| VTT_UI-5.1 | Covered elsewhere |
| VTT_UI-5.2 | [UAT-VTT_UI-3](VTT_UI.md#uat-vtt_ui-3-light-fog-senses-and-the-gms-view-preview) |

</details>

<details>
<summary>PERF: 5 of 21 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| PERF-1.1 (internal PBI) | Covered elsewhere |
| PERF-1.2 (internal PBI) | Covered elsewhere |
| PERF-1.3 (internal PBI) | [UAT-PERF-2](PERF.md#uat-perf-2-four-people-at-a-local-table-feel-responsive) |
| PERF-2.1 | [UAT-PERF-1](PERF.md#uat-perf-1-managed-three-user-live-room-journey-needs-managed-credentials-run-only-on-an-approved-staging-smoke) (blocked) |
| PERF-3.1 | Covered elsewhere |
| PERF-3.2 | [UAT-PERF-2](PERF.md#uat-perf-2-four-people-at-a-local-table-feel-responsive) |
| PERF-3.3 | [UAT-PERF-2](PERF.md#uat-perf-2-four-people-at-a-local-table-feel-responsive) |
| PERF-3.4 | Covered elsewhere |
| PERF-3.5 | Covered elsewhere |
| PERF-3.6 | Covered elsewhere |
| PERF-3.7 | [UAT-PERF-2](PERF.md#uat-perf-2-four-people-at-a-local-table-feel-responsive) |
| PERF-3.8 | Covered elsewhere |
| PERF-3.9 | Covered elsewhere |
| PERF-3.10 | Covered elsewhere |
| PERF-3.11 | Covered elsewhere |
| PERF-3.12 | Covered elsewhere |
| PERF-3.14 | Covered elsewhere |
| PERF-4.1 (internal PBI) | Covered elsewhere |
| PERF-4.2 (internal PBI) | Covered elsewhere |
| PERF-4.3 (internal PBI) | Covered elsewhere |
| PERF-4.4 (internal PBI) | Covered elsewhere |

</details>

<details>
<summary>QUALITY: 0 of 2 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| QUALITY-1.1 | Covered elsewhere |
| QUALITY-3.1 | Covered elsewhere |

</details>

<details>
<summary>RELEASE: 5 of 17 ACs in scenarios</summary>

| AC | Scenarios |
| -- | --------- |
| RELEASE-1.1 (internal PBI) | Covered elsewhere |
| RELEASE-1.2 (internal PBI) | Covered elsewhere |
| RELEASE-1.3 (internal PBI) | Covered elsewhere |
| RELEASE-2.1 | Covered elsewhere |
| RELEASE-2.2 | Covered elsewhere |
| RELEASE-2.3 | Covered elsewhere |
| RELEASE-3.1 | Not coverable |
| RELEASE-3.2 | Not coverable |
| RELEASE-4.1 | Not coverable |
| RELEASE-4.2 | Not coverable |
| RELEASE-5.1 | Covered elsewhere |
| RELEASE-6.1 | Covered elsewhere |
| RELEASE-7.1 | [UAT-RELEASE-1](RELEASE.md#uat-release-1-exact-cleanup-and-final-acceptance) |
| RELEASE-7.2 | [UAT-RELEASE-1](RELEASE.md#uat-release-1-exact-cleanup-and-final-acceptance) |
| RELEASE-7.3 | [UAT-RELEASE-1](RELEASE.md#uat-release-1-exact-cleanup-and-final-acceptance) |
| RELEASE-8.1 | [UAT-RELEASE-1](RELEASE.md#uat-release-1-exact-cleanup-and-final-acceptance) |
| RELEASE-8.2 | [UAT-RELEASE-1](RELEASE.md#uat-release-1-exact-cleanup-and-final-acceptance) |

</details>

<!-- coverage:end -->
