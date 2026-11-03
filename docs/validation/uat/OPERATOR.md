# UAT operator guide

For the operator (an agent or engineer): how to prepare the build and the review data, and which gaps limit the local run. Testers start at the [Start here page](README.md).

## Setup

The operator (an agent or engineer) prepares the build once per UAT pass. The tester starts at step 6.

1. Docker Desktop is running and the local Convex container answers: `http://127.0.0.1:3210/version` returns a version. The [release runbook](../../runbooks/phase-8-2-release.md#final-local-source) covers starting it.
2. Reset the local backend in the heavy validation lane: `pwsh -NoProfile -File scripts/resetLocalConvex.ps1 -Name uat-<date>`. This empties every app table, accounts included.
3. Deploy the source under test to the local container and seed the SRD corpus (`yarn workspace @artificer-toolkit/apis seed:srd:convex:local`), as the release runbook's final-local-source steps describe. Record the git commit (`git rev-parse HEAD`): every result names it.
4. Build the review data: `node scripts/seedReviewData.mjs --name=uat-<date>`. Its log ends with `Review data: 4 Campaign(s) created, 0 already finished.` (a re-run without a reset says `0 created, 4 already finished`, which is also fine). The script starts and stops its own Session Worker; see the [review data section](../../runbooks/phase-8-2-release.md#review-data) of the runbook.
5. Start the Session Worker (`yarn dev:session-worker`, port 8787) and the web app (`yarn dev`, http://localhost:3000) from the main checkout, which holds the Worker's local `.dev.vars`. Start them after step 4, which needs port 8787 free.
6. Open the four browser profiles described [below](README.md#running-several-users-side-by-side) and sign in to each with its [account](README.md#accounts).
7. Run the scenarios in the order of the [tracker](TRACKER.md).

One pass uses the review data once. Scenarios put shared state back through the product's normal controls (their R steps), so no reset is needed inside a pass. To start a new pass, repeat steps 2 to 5.

## Review data

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

## Known UAT gaps

These stop some scenarios on the local build. Each scenario that depends on an open one says "Blocked until gap Gn is fixed". G2, G3 and G5 are closed (RELEASE-8.T3), and G1 (RELEASE-8.T4).

| Gap    | What is missing                                                                                                                                                                | Effect                                                                                                    | Smallest fix                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **G1** | Closed: local email was accept-and-discard; the sink now keeps the newest 50 messages.                                                                                         | None: email steps run locally, see [Reading local email](README.md#reading-local-email).                  | Done (RELEASE-8.T4): `apps/apis/tests/localEmailSink.ts`, read with `scripts/localConvexFixtures.ps1 -Action mail`. |
| **G2** | Closed: the review data provisions the **SUPERADMIN** account `Review_Admin_Sol` and promotes it with `authAdmin:setRole`.                                                     | None.                                                                                                     | Done (RELEASE-8.T3).                                                                                                |
| **G3** | Closed: the review data provisions **SPARE1** `Review_Pl_Dara` and **SPARE2** `Review_Pl_Eli`, who join no Campaign.                                                           | None.                                                                                                     | Done (RELEASE-8.T3).                                                                                                |
| **G4** | Managed staging credentials.                                                                                                                                                   | Staging and production scenarios (PERF and RELEASE) run only on an approved staging smoke, never locally. | None locally: they run at the staging step of the release sequence.                                                 |
| **G5** | Closed: **Review: Sandbox** has walls, a door, terrain, per-player fog, dim light, a point light, hidden tokens and a Large creature, in Manual mode with standard initiative. | None. Scenarios needing other setup still say "Heavy setup:" with what to build.                          | Done (RELEASE-8.T3).                                                                                                |
