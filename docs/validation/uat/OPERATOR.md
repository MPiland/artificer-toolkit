# UAT operator guide

For the owner and the operator (an agent or engineer): how to prepare staging, sets and the review data, and which gaps limit the run. Testers start at the [Start here page](README.md). Staging is the supported UAT environment; the local build is an operator fallback.

## Staging sets

RELEASE-8.T5 builds the four review Campaigns on staging through product commands. Each tester gets their own set (GM, P1, P2, P3, SPARE and a copy of the four Campaigns); hand the sign-in details over privately and never write them in the repository. Rebuild a tester's set between rounds when a scenario consumed data. Before a session also issue the invitations that [ACCOUNTS-6](ACCOUNTS/UAT-ACCOUNTS-6.md) and [RELIABILITY-13](RELIABILITY/UAT-RELIABILITY-13.md) name.

## Local fallback

Everything below prepares the local build and applies when staging is unavailable. Scenarios marked **Local only** need the local email sink or another local tool.

### Setup

The operator (an agent or engineer) prepares the build once per UAT pass. The tester starts at step 6.

1. Docker Desktop is running and the local Convex container answers: `http://127.0.0.1:3210/version` returns a version. The [release runbook](../../runbooks/phase-8-2-release.md#final-local-source) covers starting it.
2. Reset the local backend in the heavy validation lane: `pwsh -NoProfile -File scripts/resetLocalConvex.ps1 -Name uat-<date>`. This empties every app table, accounts included. With the dev Session Worker stopped, also move `apps/session-worker/.wrangler/state` aside: its rooms name Live Sessions the reset removed, and on start each would retry Convex and log `LiveSessionRouteError` until cleared.
3. Deploy the source under test to the local container and seed the SRD corpus (`yarn workspace @artificer-toolkit/apis seed:srd:convex:local`), as the release runbook's final-local-source steps describe. Record the git commit (`git rev-parse HEAD`): every result names it.
4. Build the review data: `node scripts/seedReviewData.mjs --name=uat-<date>`. Its log ends with `Review data: 4 Campaign(s) created, 0 already finished.` (a re-run without a reset says `0 created, 4 already finished`, which is also fine). The script starts and stops its own Session Worker; see the [review data section](../../runbooks/phase-8-2-release.md#review-data) of the runbook.
5. Start the Session Worker (`yarn dev:session-worker`, port 8787) and the web app (`yarn dev`, http://localhost:3000) from the main checkout, which holds the Worker's local `.dev.vars`. Start them after step 4, which needs port 8787 free. `yarn dev` reads its Convex settings from the repo root env files only. Once per machine, copy `VITE_CONVEX_URL`, `CONVEX_SITE_URL`, `AUTH_PROXY_SECRET`, `SITE_URL`, `VITE_LIVE_SESSION_WEBSOCKET_URL` and `VITE_MEDIA_STORAGE_ORIGIN` from `local-validation/local-convex/local.application.env` into a root `.env.development.local`, which overrides `.env.local` in development only. Never copy `CONVEX_DEPLOYMENT`. The Worker's `.dev.vars` also needs `LOCAL_CONTENT_SNAPSHOT_ORIGIN=http://127.0.0.1:8026`, the local R2 fixture Convex writes snapshots to; without it the Worker reads its own empty R2 and content lists return 404. Viewing homebrew content additionally needs `CONTENT_SNAPSHOT_TOKEN_SECRET`, the value set on the local Convex deployment.
6. Open the four browser profiles described [below](README.md#role-setup-for-the-owner) and sign in to each with its [account](README.md#roles-and-accounts).
7. Run the scenarios in the order of the [tracker](TRACKER.md).

One pass uses the review data once. Scenarios put shared state back through the product's normal controls (their R steps), so no reset is needed inside a pass. To start a new pass, repeat steps 2 to 5.

### Local accounts

The review data creates seven local-only accounts. Sign in at `<STAGING_URL>` (locally http://localhost:3000)/sign-in with **Email or username** and the shared review password, which is the `REVIEW_PASSWORD` constant in [developmentReviewDataScenarios.ts](../../../apps/apis/tests/developmentReviewDataScenarios.ts). It exists only on the local Docker backend and guards nothing.

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

Public sign-up is closed. A spare joins a Campaign without email: the GM invites it by username from a listing and the spare accepts in the app. Steps that read an email (an invitation link, a confirmation link, a reset code) use [local email](#reading-local-email).

The spare accounts are consumed in order: SPARE2 joins one Campaign for [EXPLORATORY-4](EXPLORATORY/EXPLORATORY-4.md) and is removed again; SPARE1 stays outside every Campaign until [ACCOUNTS-12](ACCOUNTS/UAT-ACCOUNTS-12.md) deletes it, and SPARE2 is deleted last, by [RELIABILITY-13](RELIABILITY/UAT-RELIABILITY-13.md).

### Review data

`scripts/seedReviewData.mjs` builds four Campaigns through the product's own commands. Every one uses a square 5-foot grid on an 800 by 600 map. The first three use **Assisted** mode and the **Speed Factor** initiative variant, fog off, bright light, and no walls, doors, terrain or hidden tokens; **Review: Sandbox** carries those board features instead. Each has a Session for play, a last Session titled "Review data ready", a presented Scene with every combatant's token, and an Encounter that is started and partly played.

| Campaign                       | Members        | Characters                                                              | Creatures                                              | Already played                                                                                        |
| ------------------------------ | -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Review: Party in the Field** | GM, P1, P2, P3 | Aria (P1), Bryn (P2), Cade (P3)                                         | Wolf (next to Aria), Goblin (next to Bryn)             | Round 1: Aria attacks the Wolf, Bryn the Goblin, Wolf attacks Aria, Goblin attacks Bryn; round 2 open |
| **Review: Shield and Hold**    | GM, P1         | Ember (P1): Shield, Hold Person; four 1st-level and two 2nd-level slots | Wolf (adjacent), Goblin (two squares away)             | Hold Person paralyzes the Goblin (Ember concentrates); the Wolf bites Ember, who casts Shield         |
| **Review: Fire and Thunder**   | GM, P2         | Pyra (P2): Fireball, Thunderwave; two 1st-level and two 3rd-level slots | Wolf (adjacent), three Goblins grouped                 | Fireball on the Goblins (all fail); round 2 Thunderwave catches the Wolf                              |
| **Review: Sandbox**            | GM, P1, P2, P3 | Iris (P1), Juno (P2), Kit (P3)                                          | Large Ogre (lit east room), hidden Goblin, hidden Wolf | Nothing: initiative is rolled and nobody has acted                                                    |

**Review: Sandbox** uses **Manual** mode and **standard** initiative. Its Scene has fog of war **Per player** and **Dim** ambient light; a wall at the middle of the map splits a west room from an east room, with a closed door in the wall; a line of rubble (difficult terrain, double movement cost) crosses the west room; one point light lights the east room. The party starts in the west room. It is not "the Sandbox Campaign", the copy of a Campaign that [CAMPAIGN-1](CAMPAIGN/UAT-CAMPAIGN-1.md) makes; scenarios name the one they use. The Goblin's and the Wolf's tokens are hidden from players, and the Ogre's token covers 2 by 2 squares.

Hit points and slot counts on screen depend on those rolls: scenarios compare against what you see before a step, not against fixed numbers.

Anything else a scenario needs (a new or higher-level Character, a Builder-built caster, homebrew content, an uploaded map, a throwaway Campaign) is created by the tester in that file's setup steps, through the product.

### Reading local email

The local build sends no real email. Password-reset codes, email-change and verification links, invitations and notification emails go to the local email sink, which keeps the newest 50 messages. To read them:

1. Run `pwsh -NoProfile -File scripts/localConvexFixtures.ps1 -Action mail`. It replaces the ignored `local-validation/local-email/` folder with the sink's current messages and prints how many it copied.
2. Open the newest file for the recipient in a browser. Each file is named `<received time>-<sequence>-<recipient>.html` and starts with the **To** and **Subject** lines, then the email as sent, then its plain-text version (which also shows any code).

Run the command again after each step that sends an email. The sink keeps messages until the local container is recreated; older ones are dropped once there are more than 50. The first `localConvexFixtures.ps1 -Action start` after updating to this sink restarts the local fixtures, which also clears map uploads held by the local R2 substitute.

An account invitation has no app screen: it is issued by the internal `authInvitations:issue` function. To send one to a new address, run `node apps/apis/scripts/convexRunLocal.mjs authInvitations:issue '{"email":"<new address>@example.invalid","token":"<64 hex characters>"}'` (make a token with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`), then read the invitation email as above.

### Running several users side by side

Each account needs its own browser session, because sign-in is a cookie on `localhost:3000`.

- Use **one named container (Brave 1.92+ or Firefox) or one browser profile per role**, never plain tabs ([Role setup](README.md#role-setup-for-the-owner)). Private or incognito windows of one browser share one session, so they count as one role at most.
- Tile the windows so the GM window and at least one player window are visible at once. Scenarios list what every other window must show, and what it must **not** show (hidden tokens, GM private rolls, other players' private data).
- One person can drive all four windows. Helpers can join only on this machine: the local build is not reachable from other devices, including phones.
- **Mobile width**: open the browser's developer tools, turn on the device toolbar and pick a 375-pixel-wide phone. Real phones cannot reach the local build.
- **Dropped connection**: in developer tools, open the Network panel and set throttling to **Offline**, then back to **No throttling**; or close the tab and reopen the page.
- Each step names who acts, for example "3. **P1:** ...". When a step says "at the same time", have two windows ready and click within a second or two of each other.

### Known UAT gaps

These stop some scenarios on the local build. Each scenario that depends on an open one says "Blocked until gap Gn is fixed". G2, G3 and G5 are closed (RELEASE-8.T3), and G1 (RELEASE-8.T4).

| Gap    | What is missing                                                                                                                                                                | Effect                                                                                                    | Smallest fix                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **G1** | Closed: local email was accept-and-discard; the sink now keeps the newest 50 messages.                                                                                         | None: email steps run locally, see [Reading local email](#reading-local-email).                           | Done (RELEASE-8.T4): `apps/apis/tests/localEmailSink.ts`, read with `scripts/localConvexFixtures.ps1 -Action mail`. |
| **G2** | Closed: the review data provisions the **SUPERADMIN** account `Review_Admin_Sol` and promotes it with `authAdmin:setRole`.                                                     | None.                                                                                                     | Done (RELEASE-8.T3).                                                                                                |
| **G3** | Closed: the review data provisions **SPARE1** `Review_Pl_Dara` and **SPARE2** `Review_Pl_Eli`, who join no Campaign.                                                           | None.                                                                                                     | Done (RELEASE-8.T3).                                                                                                |
| **G4** | Managed staging credentials.                                                                                                                                                   | Staging and production scenarios (PERF and RELEASE) run only on an approved staging smoke, never locally. | None locally: they run at the staging step of the release sequence.                                                 |
| **G5** | Closed: **Review: Sandbox** has walls, a door, terrain, per-player fog, dim light, a point light, hidden tokens and a Large creature, in Manual mode with standard initiative. | None. Scenarios needing other setup still say "Heavy setup:" with what to build.                          | Done (RELEASE-8.T3).                                                                                                |
