# Slice workbook: ENCOUNTER-5 (three-user Assisted Encounter journey)

**Status:** DONE (2026-10-13), awaiting main-session review
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

No local journey runs an Encounter with three users in Assisted mode with auto-roll on. The only three-user journey is the managed browser spec `apps/web/tests/managed-vtt/managedRemoteVtt.spec.ts`, which needs a cloud deployment and is out of bounds (ADR 0035). Build a local journey: a GM and two players, each controlling their own Character (players drive their own actions), run an Assisted Encounter with auto-roll on from START through at least one full round to COMPLETE. Every member sees the turn order, rolls and results the GM and rules produce, projected for that member.

Follow the existing real-room convex-test pattern (for example `cutoverPrivacy.test.ts` D87, where the GM starts and completes the Encounter in the real room). Use real SRD Characters and Creatures; fake only platform and data. This is not a browser test: the criterion is about the Encounter flow, not what a page shows.

Read first: the ENCOUNTER-5 ledger entry (5.1 note: replaces the original Automatic journey; AUTOMATIC is not reinstated); ADR 0034; ENCOUNTER-2's Assisted-mode decisions in `docs/handoffs/phase-08-2-decisions.md`; the room fixtures used by `cutoverPrivacy.test.ts`.

## Closes

- ENCOUNTER-5.1 and the ENCOUNTER-5 journey.

## File scope

New journey test file(s) under `apps/apis/convex` (or `apps/session-worker/test` if the room fixture lives there) and test fixtures. No production code unless the journey finds a bug; a bug gets a red regression test and is reported in the status log before it is fixed. Out of scope: every file the parallel slices own (basic actions, drawer previews, senses, privacy, Scene lengths).

## Red-first checklist

1. The journey fails before it is wired (record the first red reason).
2. Three members admitted: GM and two players, each player bound to their own Character; a player cannot act for the other's Character.
3. Assisted with auto-roll on: initiative and the turn's attack and damage rolls auto-roll; each member receives the result once, projected for them.
4. At least one full round, then the GM completes the Encounter and all three see it end.

## Status log

- 2026-10-13: workbook written; session started.
- 2026-10-13: journey `apps/apis/convex/liveSessions/assistedPartyJourney.test.ts` (3 tests) and fixture `apps/apis/tests/fixtures/assistedParty.ts` written. No production code changed and no product bug found. Shared test code changed: `equipAllItems` is exported from `encounterCharacter.ts`, and `declarationCommand` moved from `initiativeDeclarations.test.ts` into `encounterInitiative.ts` so both tests import it.
- Red evidence (logs in `local-validation/encounter-5/`, main checkout):
  - Item 1: the first runs failed at import because the dependency packages had no `dist` (environment, not product; their logs were overwritten, the cause was `@artificer-toolkit/design-system` unresolved). `red-initiative-order.log` (same content as `run-1.log`) is the first real run: 2 of 3 tests passed and the initiative test failed (`expected 1 to be 3`). The fixture first used the `ACTOR_ROLL` policy, under which START rolls nothing and `ROLL_ACTOR_INITIATIVE` is a GM-only tool command (`GM_ONLY` for a player). The journey now uses `DECLARED_ACTION_ROLL`, the player-driven path: each actor's controller settles a pending declaration and the app auto-rolls the d20.
  - Items 2 and 4 have no separate red: they passed on the first real run, because the journey adds no production code and its only red cause was the missing fixture and wiring (item 1).
  - Item 3 red is the `red-initiative-order.log` failure above.
- Green: `green-journey.log` (3 of 3). Neighbours `green-neighbours.log` (`initiativeDeclarations`, `characterWeaponCritical`: 12 of 12).
- Typecheck: `tsc.log` shows one error, `convex/encounters/actionChoices.test.ts(76,14)` ('catalogue' possibly null). That file is untouched by this slice; it fails on the base.
- Decision: initiative uses `DECLARED_ACTION_ROLL`, not `ACTOR_ROLL`. Declared initiative auto-rolls do not post a table roll card (no chat conversation exists until an attack posts), so item 3's "each member receives the result once" is proved for attack and damage cards (identical for all three members, unique ids) and for initiative through the turn order every member reads (it follows the dice).

- 2026-10-13 review round (main session): six test-only fixes. (1) After COMPLETE every member's room frame is `held:false`; the fixture deletes the base fixture's stale PREPARED Run so no member is held on it. (2) Each attack result's `occurrence` matches `{status:'COMPLETE'}`. (3) ATTACK cards belong to Aria, Bryn and the Wolf, DAMAGE cards to Aria and Bryn only, checked by `characterLabel` (player attack cards carry no `characterId`). (4) The test reads the stored round-1 `initiativeScore` rows and asserts they rise in declaration order before asserting turn order. (5) Control binding is positive: for each declaration the other player is refused `NOT_ACTOR_CONTROLLER` and the owner is accepted (the GM may adjudicate any actor, so it is not a stranger). (6) `createPartyPlayer` names Bryn's player; the fixture comment now says so. Logs: `round2-*` (first attempt failed: GM counted as a stranger, wrong type import path), `round3-journey.log` (card check keyed on `characterId`), green `round4-journey.log` (3 of 3), `round4-neighbours.log` (12 of 12), `round4-tsc.log` (only the known `actionChoices.test.ts:76` error).

## Proposed ledger edits (filled by the slice session)

`docs/roadmap/08-phase-ledger.json`, ENCOUNTER-5:

- `status`: `"DONE"` (ENCOUNTER-5.1 `status`: `"DONE"`).
- `journeyTests`: `["apps/apis/convex/liveSessions/assistedPartyJourney.test.ts"]` (replaces `encounterJourneys.test.ts`).
- `journeyStatus`: `"full"`; remove `journeyGap`.
- ENCOUNTER-5.1 `proof`: `["apps/apis/convex/liveSessions/assistedPartyJourney.test.ts"]`.
