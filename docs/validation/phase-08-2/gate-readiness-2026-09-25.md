# Phase 8.2 gate readiness review (2026-09-25)

- **Status:** transitional evidence summary
- **Scope:** every open (not ACCEPTED) criterion in the [acceptance ledger](../../roadmap/08-2-convex-cutover-acceptance.json), checked against current source
- **Update when:** a criterion listed here changes status, or its cited tests or implementation change
- **Recorded:** 2026-09-25, against `codex/phase-08-2-convex-cutover` at `76d164f6` plus the uncommitted working tree; second pass against `dd074aef` (see [Second pass](#second-pass-2026-09-25-against-dd074aef))

The first review moved **44** criteria and **4** cases (P06, V03, V08, V10) to `READY_FOR_ACCEPTANCE`. The second pass moved **4** more criteria (V05.5, V09.7, V12.7, V12.8) and **2** cases (V09, V12). Accepted counts are unchanged: **53/75** cases and **195/276** criteria. The ledger now holds 48 READY_FOR_ACCEPTANCE, 21 IN_PROGRESS and 12 NOT_STARTED criteria; run `node scripts/acceptanceProgress.mjs` for live counts.

`READY_FOR_ACCEPTANCE` means that every clause of the criterion is implemented in current source and asserted by an existing test. It does not mean accepted. Acceptance still requires the final-source R08 lifecycle run (`yarn validate:pre-staging:local`) at each case's proof tier. No criterion or case was set to ACCEPTED, and no case-level acceptance data was changed.

## Method and limits

- **Reading only.** Each criterion was checked by reading its implementing code and finding the tests that assert its behavior. No test suite, typecheck or build was run for this review, because an integration run held the machine and the validation lock.
- **Which tests count.** A test counts only if it is part of a suite that runs in-process: Convex `convex-test`, the Session Worker pool, web Vitest, or package Vitest. The last recorded pass of those suites is commit `76d164f6` (Convex 364 files / 2,166 tests, plus the Worker, web and package suites). The uncommitted working tree touches many of the cited files, and it has not been re-run since.
- **Development drivers.** Real-backend drivers under `apps/apis/tests/development*.ts` count only when a `convex-test` file runs them in-process: `developmentLifecycleProof.test.ts` runs the Encounter lifecycle, automation and transaction drivers, and `developmentActionContentionProof.test.ts` runs the action contention driver. Drivers that only run against a real backend are not counted, because at least one of them no longer matches current contracts (see V14.4).
- **Partial is open.** A criterion with any unproven clause stays at its previous status. The missing clause is recorded below.
- The one command run was the read-only static audit `node scripts/auditNativeBoundaries.mjs`. Its log is in ignored `local-validation/acceptance-readiness-20260925/audit-native-boundaries.log`.

## Second pass (2026-09-25, against `dd074aef`)

This pass covers the commits `bfbf3a93`..`dd074aef` made after the first review (`0242f821`): the room capture cache and bundled capture (D32–D34), the reworded V09.7 and V11.4 (Q6/Q7), and health display levels, Party can view, roster portraits and room idle release (D35–D37).

- **Test basis.** The full in-process suites passed on `dd074aef` in one integration run: Convex 368 files / 2,190 tests, web 248 / 1,377, and the schema, shared, source-data and Worker suites, with clean backend and web typechecks (ignored `local-validation/s6/s4b2-s6h/summary.txt`). No suite was run for this pass; it only read source and tests.
- **Re-check of READY criteria.** Every `file › test name` in a READY criterion's `proof` still exists in current source. The new commits changed the player projection contract (a `health` field replaces the removed player `healthBand`), and the affected tests were updated rather than weakened. No READY criterion was invalidated, so none moved back.

### Moved to READY_FOR_ACCEPTANCE

- `V05.5` The room activates on the first admitted socket, drains its outbox and releases authority after five minutes without one, and closes on Campaign archive or deletion (ADR 0033).
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: drains and releases authority after five minutes without an admitted socket (no release while a socket is admitted; the next admitted socket activates a fresh epoch)
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: cancels the idle release when a member reconnects inside the window
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: publishes the pending outbox before an idle room releases its authority
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: closes every socket when the live Session ends (`CLOSE_ROOM` drains and releases)
  - `apps/apis/convex/campaigns/lifecycle.test.ts`: archives only with current owner authority and version, preserving member reads and stored data (schedules `CLOSE_ROOM`)
  - `apps/apis/convex/campaigns/deletionLifecycle.test.ts`: retains the root through a %s room close and retries the captured authority
  - Implementation: `apps/session-worker/src/nativeLiveSessionRoom.ts` (`room_idle_release`, `alarm`), `apps/session-worker/src/roomLimits.ts`, `apps/apis/convex/liveSessions/controlScheduling.ts`, `apps/apis/convex/campaigns/deletionJobs.ts`
- `V09.7` Removing a member drops them from every controller list, and development data is migrated or reset under the standing local-reset approval.
  - `apps/apis/convex/encounters/playerControl.test.ts`: answers GM, assigned player, granted controller, other player and departed member (the departing member leaves the stored actor and projection controller lists)
  - Development data: the local deployment was reset under the standing approval before the `dd074aef` integration run (ignored `local-validation/s6/s4b2-s6h/reset.log`, backup `local-validation/convex-reset/s4b2-s6h.before.zip`), then deployed, code-generated, seeded and audited.
  - Implementation: `apps/apis/convex/encounters/actorControllerRemoval.ts`, `apps/apis/convex/campaigns/membershipDeparture.ts` (`depart`, shared by `leave` and `removeMember`), `apps/apis/convex/campaigns/accountDeparture.helper.ts`
- `V12.7` Health display is Hidden by default, Descriptive, Bar or Exact; each player sets it for their Character and the GM per Encounter with per-actor overrides, and the GM always sees exact values (ADR 0034).
  - `apps/apis/convex/encounters/healthDisplay.test.ts`: redacts enemy health for every level, with the actor override over the Encounter default
  - `apps/apis/convex/encounters/healthDisplay.test.ts`: shows a Character at its player’s level, and exact health to its controller
  - `packages/rules-runtime/src/__tests__/encounterPlayerProjection.test.ts`: carries only what each health display level allows; prefers the actor override to the Encounter default, and shows controllers exact health; shows a Character at its player's level, never the Encounter default
  - `packages/schema/src/__tests__/encounter-contracts.test.ts` (each level carries only its own fields; bar ratios are coarse)
  - `apps/apis/convex/campaigns/partyVisibility.test.ts`: lets only the Character’s player set it, and never lets another player act
  - `apps/web/src/domains/characters/sheet/core/CharacterSheetPartyVisibility.test.tsx`: lets the Character’s player share the Sheet and choose a health display level
  - `apps/web/src/domains/campaigns/vtt/CampaignTabletopEncounterDrawer.test.tsx`: shows a player only the health its level allows: %j; always shows the GM exact hit points instead of a band
  - Implementation: `packages/schema/src/api/healthDisplay.ts`, `packages/rules-runtime/src/encounterPlayerProjection.ts`, `apps/apis/convex/encounters/healthViewer.ts`, `projectionReads.ts`, `resultPresentation.ts`, `commands.ts` (`SET_HEALTH_DISPLAY_DEFAULT`, `UPDATE_ACTOR healthDisplay`), `apps/web/src/domains/campaigns/vtt/EncounterActorHealth.tsx`
- `V12.8` Another player's Character Sheet is GM-only unless its "Party can view" option is on, personality and background are never shown to other players, and the Campaign roster shows only public basics (name, portrait, level, class) (ADR 0034).
  - `apps/apis/convex/campaigns/partyVisibility.test.ts`: keeps another player’s Sheet GM-only until its player turns Party can view on (personality, background and concept are stripped server-side)
  - `apps/apis/convex/campaigns/partyVisibility.test.ts`: lets only the Character’s player set it, and never lets another player act
  - `apps/apis/convex/campaigns/partyVisibility.test.ts`: shows every member only the public roster basics
  - `apps/apis/convex/media/characterPortrait.test.ts`: lets only active members read the portrait of a Character assigned in their Campaign
  - `apps/web/src/domains/campaigns/components/CampaignParty.test.tsx`: shows another player only roster basics, with View Sheet only when Party can view is %s
  - Implementation: `apps/apis/convex/campaigns/characterSheet.ts` (`get`, `basics`), `apps/apis/convex/campaigns/characterState.ts` (`readCampaignCharacterReader`), `packages/rules-runtime/src/character/campaignCharacterSheet.ts` (`PARTY_MEMBER` projection), `apps/apis/convex/media/characterPortraitAssets.ts`, `apps/web/src/domains/campaigns/components/CampaignParty.tsx`

Case changes: V09 and V12 have no open criteria left that are not READY, so both cases are READY_FOR_ACCEPTANCE. V05 stays IN_PROGRESS (V05.3, V05.4) and V11 stays IN_PROGRESS (V11.4).

### Judgment calls in this pass

- `V09.7`: the member-removal clause is asserted through the leave path. `removeMember` runs the same `depart` function, which calls `removeEncounterActorController` unconditionally, but no test drives `removeMember` itself against controller lists. The data clause rests on the recorded local reset, which the reworded criterion permits; it cannot be a test assertion.
- `V05.5`: the deletion test asserts the room-close control call and its retry before purge; the close body (`CLOSE_ROOM`) is asserted for archive in `lifecycle.test.ts` and for the Worker in `nativeLiveSessionRoom.test.ts`.
- `V12.6` stays READY: per D35, an actor's controllers (including a Character's own player) see exact health. Every other player receives no health unless a level other than Hidden is set, and Hidden is the default.
- `V11.4` stays open (see below). Its Assisted clauses are proven by `evidenceRolls.test.ts`: the GM answers the enemy save when auto-roll is off, and an auto-roll GM gets the save rolled with the action completing.

## Criteria moved to READY_FOR_ACCEPTANCE (first review)

The ledger `proof` arrays carry the same evidence. `%s` and `$name` placeholders are the literal parameterized test titles.

### F12 — Account deletion (case IN_PROGRESS)

- `F12.1` Wrong-password deletion and deletion by the owner of an ACTIVE or ARCHIVED Campaign are refused with no writes.
  - `apps/apis/convex/accountDeletion.test.ts`: requires the current account email and password without changing credentials, sessions or app state
  - `apps/apis/convex/accountDeletion.test.ts`: rejects invalid credentials, stale cookie-session tokens and actor injection without writes
  - `apps/apis/convex/accountDeletion.test.ts`: preserves every provider/app row when the account owns a %s Campaign (ACTIVE, ARCHIVED)
  - Implementation: `apps/apis/convex/lib/authTriggers.helper.ts`
- `F12.2` Deletion through Better Auth revokes every session and stale JWT and removes private Characters, authored content, Profile, Social, notification, usage and media state.
  - `apps/apis/convex/accountDeletion.test.ts`: deletes every own session and linked credential while preserving another account
  - `apps/apis/convex/accountDeletionHttp.test.ts`: deletes only the signed-in account and expires exact session and Convex JWT cookies after commit
  - `apps/apis/convex/characters/accountDeletion.test.ts`: removes complete private Character state and preserves finished Encounter history: %s
  - `apps/apis/convex/accountDeletion.test.ts`: cleans current owned authored records through the native trigger: %s
  - `apps/apis/convex/social/profiles.test.ts`: fails closed on corrupt mature preference evidence and deletes only the departing account profile
  - `apps/apis/convex/social/accountDeletion.test.ts`: withdraws pending applicant history, deletes current identity, and presents retained evidence
  - `apps/apis/convex/notifications.test.ts`: removes only the deleted account notification rows and preference-bearing profile
  - `apps/apis/convex/accountEntitlements.test.ts`: removes the deleted account tier without touching another account
  - `apps/apis/convex/encounters/accountDeletion.test.ts`: removes only the deleted owner’s Blueprints, receipts, and usage
  - `apps/apis/convex/media/avatar.test.ts`: cleans pending and ready keys after account deletion, without touching another owner
  - Implementation: `apps/apis/convex/lib/authTriggers.helper.ts`
- `F12.4` Account deletion evicts the exact user from the Campaign live table (ADR 0033).
  - `apps/apis/convex/campaigns/accountDeparture.test.ts`: detaches a trusted account from an %s Campaign while retaining Campaign history (asserts the exact liveSessions/control:evictUser schedule)
  - `apps/apis/convex/liveSessions/control.test.ts`: evicts one membership epoch from the Campaign room without any Session
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: evicts only the exact departed membership epoch through private room control
  - Implementation: `apps/apis/convex/campaigns/accountDeparture.helper.ts`, `apps/apis/convex/liveSessions/controlScheduling.ts`

### P06 — Authoritative rolls and evidence (case READY_FOR_ACCEPTANCE)

- `P06.4` Player Campaign rolls default to the Table, with To GM and Just me options, and rolls that change Character state (such as short-rest hit dice) are always GM-visible: Table or To GM, never Just me (ADR 0034).
  - `apps/web/src/domains/characters/sheet/dice/useCharacterSheetRollController.test.tsx`: defaults a player Campaign roll to the table and can send it to the GM
  - `apps/web/src/domains/characters/sheet/dice/useCharacterSheetRollController.test.tsx`: keeps player hit-die rolls on Table or To GM, never Just me
  - `apps/apis/convex/campaigns/rolls.test.ts`: posts a player TABLE roll to everyone and a To GM roll only to that player and the GM
  - `apps/apis/convex/campaigns/rolls.test.ts`: keeps a player "Just me" roll in that player history only
  - `apps/apis/convex/campaigns/characterRolls.test.ts`: refuses a player "Just me" hit-die roll for a Campaign rest
  - `apps/apis/convex/campaigns/characterRolls.test.ts`: completes a short rest from a To GM hit-die roll that only the player and GM can read
  - Implementation: `apps/apis/convex/campaigns/rolls.ts`, `apps/apis/convex/characters/rest.ts`
- `P06.5` The GM rolls Private, Blind or to the Table and can reveal a private roll (ADR 0034).
  - `apps/web/src/domains/characters/sheet/dice/useCharacterSheetRollController.test.tsx`: defaults a GM Campaign roll to private and hides a blind result
  - `apps/apis/convex/campaigns/rolls.test.ts`: hides a GM blind roll value from everyone until the GM reveals it to the TABLE once
  - `apps/apis/convex/campaigns/rolls.test.ts`: reveals only a GM roll retained for the same Campaign
  - Implementation: `apps/apis/convex/campaigns/rolls.ts`

### P15 — Sessions and control (case IN_PROGRESS)

- `P15.2` Sessions are an optional log (schedule, RSVP, attendance, notes, references, recap), and finishing one changes no Encounter Run, presentation or live-table state (ADR 0033).
  - `apps/apis/convex/campaigns/campaignPlay.test.ts`: leaves live authority, presentation and an ACTIVE Run untouched when a Session finishes
  - `apps/apis/convex/campaigns/campaignPlay.test.ts`: builds the party from active assignments and opens the table for a player without a Session
  - `apps/apis/convex/campaigns/sessions.test.ts`: merges schedule updates, clears nullable metadata together, and rejects stale or malformed writes
  - `apps/apis/convex/campaigns/sessions.test.ts`: keeps RSVP identity self-scoped and unique, while attendance is owner-only and versioned
  - `apps/apis/convex/campaigns/sessionNotes.test.ts`: keeps private notes out of player pages and preserves kind, Session, archive, and membership boundaries
  - `apps/apis/convex/campaigns/sessionReferences.test.ts`: enforces member reads, GM-only writes, Session and Campaign scope, archive, and exact removal scope
  - Implementation: `apps/apis/convex/campaigns/sessionFinish.ts`

### V03 — Scene entities, geometry, and visibility facts (case READY_FOR_ACCEPTANCE)

- `V03.4` Players may open and close unlocked doors, and locking stays GM-only (ADR 0034).
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: lets $role change a visible $from door to $to: $outcome
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: refuses a player door change for $case
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: lets a player open a door in a fog-OFF Scene even with a kept unexplored layer
  - Implementation: `packages/shared/src/domains/vtt/geometry.ts` (sceneDoorChangeFailure), `apps/session-worker/src/nativeRoomSceneCommand.ts`
- `V03.5` Fog of war is opt-in per Scene: with fog off, players see every non-hidden token, wall, door and light; with fog on, the shared-party or per-player exploration model applies (ADR 0034).
  - `packages/shared/src/__tests__/vtt-scene.test.ts`: shows players every non-hidden object with fog OFF and hides them again with fog on
  - `apps/apis/convex/scenes/fog.test.ts`: shows players every non-hidden object with fog OFF, refuses fog writes and keeps layers across modes
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: fans out every non-hidden token and door to a player in a fog-OFF Scene
  - `apps/web/src/domains/campaigns/vtt/vttSceneRenderer.model.test.ts`: combines explored fog bits from private layers and draws no fog while fog is OFF
  - Implementation: `packages/shared/src/domains/vtt/sceneReducer.ts` (projectSceneForViewer), `apps/apis/convex/scenes/fogCommands.ts`

### V05 — Session admission and presence (case IN_PROGRESS)

- `V05.1` Any ACTIVE Campaign member can get a ticket without an open Session; ticket issue and authority claim require current membership and an ACTIVE Campaign (ADR 0033).
  - `apps/apis/convex/liveSessions/tickets.test.ts`: issues HS256 60-second tickets for active owner and player admissions
  - `apps/apis/convex/liveSessions/tickets.test.ts`: denies unauthenticated, nonmember, archived, and cross-Campaign ticket requests
  - `apps/apis/convex/campaigns/campaignPlay.test.ts`: builds the party from active assignments and opens the table for a player without a Session
  - Implementation: `apps/apis/convex/liveSessions/tickets.ts`, `apps/apis/convex/liveSessions/authority.ts`
- `V05.2` Tickets are signed, single-use, valid for one minute and bound to the Campaign's room.
  - `apps/apis/convex/liveSessions/tickets.test.ts`: issues HS256 60-second tickets for active owner and player admissions
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: requires native authentication, consumes the ticket once, and never persists the JWT
  - `apps/session-worker/test/nativeWorkerEntry.test.ts`: refuses a valid ticket used on another Campaign room path
  - Implementation: `apps/apis/convex/liveSessions/tickets.ts`, `apps/session-worker/src/ticket.ts`

### V08 — Encounter lifecycle and optional Scene binding (case READY_FOR_ACCEPTANCE)

- `V08.1` Encounter Runs belong to the Campaign and carry no Session reference, and a PREPARED Run can be deleted (ADR 0033).
  - `apps/apis/convex/campaigns/campaignPlay.test.ts`: deletes only a prepared Run with exact command replay
  - `apps/apis/convex/campaigns/playMigrations.test.ts`: strips Session keys from every Campaign-owned play row and narrows presentations
  - Implementation: `apps/apis/convex/encounters/runs.ts` (deletePrepared)
- `V08.2` START requires no other ACTIVE Run in the Campaign, and an ACTIVE Run persists across sittings until COMPLETE (ADR 0033).
  - `apps/apis/convex/encounters/commands.test.ts`: allows only one active Run per Campaign and preserves START replay
  - `apps/apis/convex/campaigns/campaignPlay.test.ts`: leaves live authority, presentation and an ACTIVE Run untouched when a Session finishes
  - Implementation: `apps/apis/convex/encounters/commands.ts`
- `V08.3` Runs in Manual and Assisted mode freeze snapshots, accept normalized corrections and progress later (ADR 0034 removes AUTOMATIC).
  - `apps/apis/convex/encounters/commands.test.ts`: starts a Manual Run through normalized initiative and replays the terminal command
  - `apps/apis/convex/encounters/commands.test.ts`: pauses and resolves Assisted initiative without exposing partial Run state
  - `apps/apis/convex/encounters/initiativeCorrection.test.ts`: rewinds, clears, reselects, and revisits a manually-settled round without new rolls
  - `apps/apis/convex/encounters/runs.test.ts`: atomically snapshots assigned Characters and enemies, and replays without source reads
  - `packages/schema/src/__tests__/campaign-live-play-contracts.test.ts` (AUTOMATIC automationMode rejected)
  - `apps/apis/convex/encounters/developmentLifecycleProof.test.ts`: runs the shared Manual/Automatic/Assisted lifecycles, native map/Scene binding and cleanup through local transactions
  - Implementation: `packages/schema/src/api/campaignSettings.ts` (automationModeDtoSchema), `apps/apis/convex/encounters/commands.ts`
- `V08.4` Run-to-Scene bindings are immutable and actor-token bindings are versioned, with successive token reuse and historical receipts.
  - `apps/apis/convex/encounters/sceneBindings.test.ts`: binds the presented Scene and replays the original result after presentation changes
  - `apps/apis/convex/encounters/sceneBindings.test.ts`: rejects a competing binding and authorization or lifecycle failures without rows
  - `apps/apis/convex/encounters/actorTokenBindings.test.ts`: sets and replaces tokens, preserves exact historical replay and exposes binding receipts in timeline
  - `apps/apis/convex/encounters/actorTokenBindings.test.ts`: enforces token uniqueness within a Run and allows stable token identity across Runs
  - Implementation: `apps/apis/convex/encounters/sceneBindings.ts`, `apps/apis/convex/encounters/actorTokenBindings.ts`
- `V08.5` The Campaign presents zero or one live Scene, and presentation survives reconnects, Encounter completion and Session finish (ADR 0033).
  - `apps/apis/convex/scenes/presentations.test.ts`: creates, replays, clears and reads one Campaign presentation without duplicating receipts
  - `apps/apis/convex/scenes/presentations.test.ts`: keeps one Campaign presentation and its map across Session finish until the Scene is cleared
  - `apps/apis/convex/encounters/developmentLifecycleProof.test.ts`: runs the shared Manual/Automatic/Assisted lifecycles, native map/Scene binding and cleanup through local transactions (apps/apis/tests/developmentEncounterLifecycle.ts asserts the presentation is unchanged after COMPLETE)
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: resends the authoritative state on a valid resume frame
  - Implementation: `apps/apis/convex/scenes/presentations.ts`
- `V08.6` Forced rollbacks and real command, binding, presentation and ownership races leave consistent state, with exact cleanup.
  - `apps/apis/convex/encounters/developmentLifecycleProof.test.ts`: runs the shared Manual/Automatic/Assisted lifecycles, native map/Scene binding and cleanup through local transactions (apps/apis/tests/developmentEncounterTransactions.ts: forced rollback and concurrent command/binding/presentation/ownership/Session-finish schedules)
  - Implementation: `apps/apis/convex/encounters/developmentLifecycle.ts` (verifyRollback), `apps/apis/convex/encounters/commands.ts`

### V09 — Encounter actors and initiative (case READY_FOR_ACCEPTANCE since the second pass)

- `V09.1` Actor removal, remaining-turn reorder and initiative-position reinforcement preserve the cursor, history, pending decisions, source authority, privacy and checksums.
  - `apps/apis/convex/encounters/actorRemovalCommand.test.ts`: removes prepared actors and exact bindings/reminders, preserves Scene identity, and replays historically with current authority
  - `apps/apis/convex/encounters/actorRemovalCommand.test.ts`: reconciles active initiative across historical rounds and permits an empty Run to change round
  - `apps/apis/convex/encounters/actorRemovalCommand.test.ts`: supersedes a frozen Assisted initiative and preserves its maintenance receipt on retry
  - `apps/apis/convex/encounters/actorReorderCommand.test.ts`: changes remaining turns immediately while preserving current/completed turns, scores and older rounds
  - `apps/apis/convex/encounters/actorReorderCommand.test.ts`: preserves contiguous SIDE_ROLL order and refuses a pending Assisted decision
  - `apps/apis/convex/encounters/actorReinforcementCommand.test.ts`: inserts before and after the current actor while preserving settled manual participants
  - `apps/apis/convex/encounters/actorReinforcementCommand.test.ts`: rejects a tampered retained reinforcement actor snapshot and rolls back an injected post-write failure
  - Implementation: `apps/apis/convex/encounters/actorRemovalCommand.ts`, `apps/apis/convex/encounters/actorReorderCommand.ts`, `apps/apis/convex/encounters/actorReinforcementCommand.ts`
- `V09.2` Actor, side and cadence initiative scenarios pass current-round and next-round eligibility, same-version reinforcement races, exact replay and rollback.
  - `apps/apis/convex/encounters/developmentLifecycleProof.test.ts`: runs the shared Manual/Automatic/Assisted lifecycles, native map/Scene binding and cleanup through local transactions (apps/apis/tests/developmentEncounterAutomation.ts: actor/side/cadence scenarios and the same-version REINFORCE race with one VERSION_STALE loser)
  - `apps/apis/convex/encounters/commands.test.ts`: runs native SIDE_ROLL start, side transitions, correction, and both cadence wraps
  - `apps/apis/convex/encounters/actorReinforcementCommand.test.ts`: rejects stale versions and pending occurrences without writes
  - Implementation: `apps/apis/convex/encounters/actorReinforcementCommand.ts`, `apps/apis/convex/encounters/commands.ts`
- `V09.3` A Run takes its party from the Campaign's ACTIVE Character assignments, and the GM removes absent Characters before START (ADR 0033).
  - `apps/apis/convex/encounters/runs.test.ts`: atomically snapshots assigned Characters and enemies, and replays without source reads
  - `apps/apis/convex/encounters/runs.test.ts`: excludes unassigned Characters from the party and fails closed for corrupt replay projections
  - `apps/apis/convex/campaigns/campaignPlay.test.ts`: builds the party from active assignments and opens the table for a player without a Session
  - `apps/apis/convex/encounters/actorRemovalCommand.test.ts`: removes prepared actors and exact bindings/reminders, preserves Scene identity, and replays historically with current authority
  - Implementation: `apps/apis/convex/encounters/runs.ts`
- `V09.4` Each Run actor has GM-set controllerUserIds limited to current players, and a Character actor's assigned player is always a controller.
  - `apps/apis/convex/encounters/playerControl.test.ts`: answers GM, assigned player, granted controller, other player and departed member
  - `apps/web/src/domains/campaigns/vtt/CampaignTabletopEncounterDrawer.test.tsx`: lets the GM grant a player control of an actor and set its disposition
  - Implementation: `apps/apis/convex/encounters/actorController.ts`, `apps/apis/convex/encounters/commands.ts` (UPDATE_ACTOR controllerUserIds)
- `V09.5` One predicate (encounters/actorController.ts) decides control: the GM always, and a controller for that actor.
  - `apps/apis/convex/encounters/playerControl.test.ts`: answers GM, assigned player, granted controller, other player and departed member
  - `apps/apis/convex/encounters/playerControl.test.ts`: moves an Encounter-bound token only for the bound actor controllers
  - Implementation: `apps/apis/convex/encounters/actorController.ts` (readEncounterActorControl, used by action, choice, Disarm, turn, response, pending and movement admission)
- `V09.6` Each Run actor has a GM-editable disposition, FRIENDLY for Characters and HOSTILE for creatures by default.
  - `apps/apis/convex/encounters/playerControl.test.ts`: defaults dispositions by actor kind and lets only the GM change them
  - `packages/rules-runtime/src/__tests__/encounterPlayerProjection.test.ts`: omits every actor health band and hidden actors while keeping control and disposition
  - Implementation: `apps/apis/convex/encounters/commands.ts`, `packages/schema/src/api/encounterData.ts`

### V10 — Actions, reactions, effects, and selected optional combat rules (case READY_FOR_ACCEPTANCE)

- `V10.5` A player resolves actions for actors they control on that actor's turn, and ends that turn.
  - `apps/apis/convex/encounters/playerControl.test.ts`: lets a granted player act for the companion only on its turn against visible targets
  - `apps/apis/convex/encounters/playerControl.test.ts`: lets the assigned player end their Character turn but not the GM-only commands
  - `apps/apis/convex/encounters/actionCommands.test.ts`: lets a player resolve only an actor the GM granted them and binds its replay to that player
  - `apps/web/src/domains/campaigns/vtt/CampaignTabletopEncounterDrawer.test.tsx`: lets a player end the turn only for an actor they control
  - Implementation: `apps/apis/convex/encounters/actionAdmission.ts`, `apps/apis/convex/liveSessions/encounterTurnAdmission.ts`
- `V10.6` Actions for other actors or uncontrolled creatures, out-of-turn actions and hidden targets are refused with domain rejections.
  - `apps/apis/convex/encounters/playerControl.test.ts`: lets a granted player act for the companion only on its turn against visible targets (NOT_ACTOR_CONTROLLER, NOT_CURRENT_ACTOR, TARGET_UNAVAILABLE)
  - `apps/apis/convex/encounters/actionCommands.test.ts`: never overrides hard checks
  - Implementation: `apps/apis/convex/encounters/actionAdmission.ts`, `apps/apis/convex/lib/domainRejections.ts`
- `V10.7` A granted companion can be used until control is revoked.
  - `apps/apis/convex/encounters/playerControl.test.ts`: lets a granted player act for the companion only on its turn against visible targets (revoking control refuses the next action)
  - Implementation: `apps/apis/convex/encounters/actorController.ts`
- `V10.8` Target disposition warnings compare dispositions, and the action drawer shows unavailable actions dimmed with their reasons.
  - `apps/apis/convex/encounters/actionCommands.test.ts`: treats range and target disposition as overridable warnings
  - `apps/web/src/domains/campaigns/vtt/CampaignTabletopActionDrawer.test.tsx`: shows why an action already breaks a rule before it is chosen
  - Implementation: `apps/apis/convex/encounters/actionChoices.ts`, `apps/web/src/domains/campaigns/vtt/CampaignTabletopActionDrawer.ts`x
- `V10.9` In Assisted mode, bendable rule checks warn and allow a logged "Do it anyway" that the GM sees as a badge, and never drive resources negative (ADR 0034).
  - `apps/apis/convex/encounters/actionCommands.test.ts`: warns on an exhausted allowance and charge, refuses a partial acknowledgement, then records the override without going negative
  - `apps/apis/convex/encounters/actionCommands.test.ts`: treats range and target disposition as overridable warnings
  - `apps/apis/convex/encounters/actionCommands.test.ts`: never overrides hard checks
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: forwards overridable rule warnings with an action rejection
  - `apps/web/src/domains/campaigns/vtt/CampaignTabletopActionDrawer.test.tsx`: shows the server warnings and resends with them acknowledged on "Do it anyway"
  - Implementation: `apps/apis/convex/encounters/actionAdmission.ts`, `apps/web/src/domains/campaigns/components/CampaignEncounterWorkspace.ts`x (override badge)
- `V10.10` A player has at most one Encounter command in flight.
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: lets a player have one Encounter command in flight
  - Implementation: `apps/session-worker/src/nativeLiveSessionRoom.ts`
- `V10.11` GM undo reverts the last committed action exactly from its receipt's before-states, or refuses with an explanation when a later command or Sheet write touched an affected actor (ADR 0034).
  - `apps/apis/convex/encounters/actionCommands.test.ts`: restores Creature hit points, charges and the action allowance exactly, once
  - `apps/apis/convex/encounters/actionCommands.test.ts`: deletes the effect an action created and restores its conditions
  - `apps/apis/convex/encounters/actionCommands.test.ts`: refuses after a later Encounter command changed the Run
  - `apps/apis/convex/encounters/liveCharacterState.test.ts`: restores a Character the action damaged, then refuses once its Sheet changes
  - Implementation: `apps/apis/convex/encounters/actionRevert.ts`

### V11 — Decisions, pause, and resume (case IN_PROGRESS)

- `V11.5` "Roll dice" records every attempt in the roll log without settling.
  - `apps/apis/convex/encounters/evidenceRolls.test.ts`: routes a creature save against a player action to the GM, who rolls twice and settles the latest roll
  - Implementation: `apps/apis/convex/encounters/evidenceRolls.ts`
- `V11.6` A response settles with the latest app roll ID or entered faces, never with a client-supplied app value.
  - `apps/apis/convex/encounters/evidenceRolls.test.ts`: routes a creature save against a player action to the GM, who rolls twice and settles the latest roll (ROLL_UNAVAILABLE for an older or unknown roll id)
  - `apps/apis/convex/encounters/evidenceRolls.test.ts`: lets the controlling player enter their own attack roll and rejects a forged face count
  - Implementation: `packages/schema/src/api/encounterRuleCommands.ts` (SYSTEM_ROLL carries only rollId), `apps/apis/convex/encounters/evidenceRolls.ts`
- `V11.7` The chosen d20 mode is stored beside the derived mode and labeled when changed.
  - `apps/apis/convex/encounters/evidenceRolls.test.ts`: settles an overridden advantage app roll with both faces and labels the change
  - `apps/apis/convex/encounters/evidenceRolls.test.ts`: lets the controlling player enter their own attack roll and rejects a forged face count
  - `apps/web/src/domains/campaigns/vtt/CampaignTabletopDecisionDrawer.test.tsx`: recommends the derived mode, rolls without settling and settles by the latest roll id
  - Implementation: `apps/apis/convex/encounters/evidenceRolls.ts`
- `V11.8` In Assisted mode an authored automatic reaction becomes a Use/Decline choice for its controller.
  - `apps/apis/convex/encounters/automaticMovementReactionPolicy.test.ts`: offers an authored automatic reaction to its controller as a Use/Decline choice in Assisted mode
  - Implementation: `apps/apis/convex/encounters/movementReactionDiscovery.ts`
- `V11.9` The "Auto-roll my dice" preference is stored server-side, defaults on, and only produces dice results without making choices (ADR 0034).
  - `apps/apis/convex/auth.test.ts`: defaults new profiles to automatic dice and persists the choice only for the caller
  - `apps/apis/convex/encounters/evidenceRolls.test.ts`: rolls on the server without a prompt when the roller auto-rolls
  - `apps/apis/convex/encounters/automaticMovementReactionPolicy.test.ts`: offers an authored automatic reaction to its controller as a Use/Decline choice in Assisted mode
  - `apps/web/src/settings/SettingsPages.test.tsx`: persists the automatic dice rolling preference
  - Implementation: `apps/apis/convex/lib/rollPreferences.ts`, `apps/apis/convex/account.ts`, `apps/apis/convex/encounters/actorController.ts` (readEncounterAutoRollByActorId)
- `V11.10` GM void cancels a paused action whole and resolves declinable choices as declined (ADR 0034).
  - `apps/apis/convex/encounters/occurrenceVoid.test.ts`: cancels paused actions, declines optional choices and refuses steps play needs
  - `apps/apis/convex/encounters/occurrenceVoid.test.ts`: cancels a paused Disarm whole, records the void once and settles nothing
  - `apps/apis/convex/encounters/occurrenceVoid.test.ts`: declines movement reaction choices, keeping a paused move fenced until it settles
  - `apps/web/src/domains/campaigns/vtt/CampaignTabletopDecisionDrawer.test.tsx`: lets the GM void the pending decision and hides the control from players
  - Implementation: `apps/apis/convex/encounters/occurrenceVoid.ts`

### V12 — Player and GM privacy and redaction (case READY_FOR_ACCEPTANCE since the second pass)

- `V12.4` Every command result and replay a player receives is the redacted player projection, and the room refuses anything else.
  - `apps/apis/convex/encounters/playerControl.test.ts`: lets a granted player act for the companion only on its turn against visible targets (result and replay parse as the player projection)
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: never hands a player an unredacted GM projection
  - Implementation: `apps/apis/convex/encounters/resultPresentation.ts`, `apps/session-worker/src/nativeRoomEncounterCommand.ts`
- `V12.5` A replay by command ID is returned only to its issuer.
  - `apps/apis/convex/encounters/playerControl.test.ts`: lets a granted player act for the companion only on its turn against visible targets (COMMAND_ID_REUSED for another member)
  - `apps/apis/convex/encounters/actionCommands.test.ts`: lets a player resolve only an actor the GM granted them and binds its replay to that player
  - Implementation: `apps/apis/convex/encounters/actionAdmission.ts`, `apps/apis/convex/encounters/resultPresentation.ts`
- `V12.6` The player projection carries no actor health by default.
  - `packages/rules-runtime/src/__tests__/encounterPlayerProjection.test.ts`: omits every actor health band and hidden actors while keeping control and disposition
  - `apps/apis/convex/encounters/playerControl.test.ts` (expectPlayerProjection: no healthBand, currentHitPoints, resources, statBlock or gmNotes)
  - Implementation: `packages/rules-runtime/src/encounterPlayerProjection.ts`

### V14 — Same-aggregate contention and unrelated concurrency (case IN_PROGRESS)

- `V14.1` Lifecycle, binding, presentation and ownership race schedules pass against Campaign-keyed Runs and presentation (ADR 0033).
  - `apps/apis/convex/encounters/developmentLifecycleProof.test.ts`: runs the shared Manual/Automatic/Assisted lifecycles, native map/Scene binding and cleanup through local transactions (apps/apis/tests/developmentEncounterTransactions.ts: lifecycle, binding, presentation, ownership and Session-finish race schedules on Campaign-keyed Runs)
  - `apps/apis/convex/campaigns/campaignPlay.test.ts`: fences direct writes only to the presented Scene while room authority is live
- `V14.2` Same-Scene movement contention and distinct-Scene writes stay consistent.
  - `apps/apis/convex/encounters/developmentLifecycleProof.test.ts`: runs the shared Manual/Automatic/Assisted lifecycles, native map/Scene binding and cleanup through local transactions (apps/apis/tests/developmentEncounterCutover.ts verifyEncounterCutoverContention: same-Scene bound-move race with one stale loser, exact replay and concurrent distinct-Scene writes)
  - `apps/apis/convex/scenes/standaloneMovement.test.ts`: rejects a competing staged move after the first publication changes the Scene
- `V14.3` Same-Run actions serialize while independent Runs proceed.
  - `apps/apis/convex/encounters/developmentActionContentionProof.test.ts`: proves V14 native RESOLVE_ACTION contention through public commands (apps/apis/tests/developmentEncounterActionTransactions.ts: same-Run winner/stale loser while a second Run's concurrent duplicate commits once)
- `V14.5` An Encounter reads a Character's HP and state live from the Character at capture time, fenced by the captured revisions; the Run keeps no Character HP, maximum, condition or stream-version mirror, so a Sheet write no longer refuses that Character's Encounter commands (ADR 0034).
  - `apps/apis/convex/encounters/liveCharacterState.test.ts`: keeps Encounter commands and projections current after Sheet edits made after Run creation
  - `apps/apis/convex/encounters/liveCharacterState.test.ts`: shows a changed Character maximum without blocking Encounter commands on it
  - `apps/apis/convex/liveSessions/liveCharacterFence.test.ts`: refuses a room plan whose Character changed before commit and commits a re-captured plan
  - `apps/apis/convex/encounters/runs.test.ts`: atomically snapshots assigned Characters and enemies, and replays without source reads (Character actor stores no currentHitPoints or sourceRevision)
  - Implementation: `apps/apis/convex/encounters/documents.ts`, `apps/apis/convex/liveSessions/encounterRulesCapture.ts`

### R06 — Session Durable Object is the active live-command authority (case IN_PROGRESS)

- `R06.3` Character Sheet writes stay in Convex under the approved Character authority amendment.
  - `apps/apis/convex/liveSessions/state.test.ts`: keeps Character Sheet commands in Convex while Scene authority is active and draining
  - Implementation: `apps/apis/convex/characters/sheetCommands.ts`
- `R06.4` While room authority is active, the room is the single writer of the presented Scene and of all Encounter commands, and the direct-write fence covers only the presented Scene (ADR 0033).
  - `apps/apis/convex/campaigns/campaignPlay.test.ts`: fences direct writes only to the presented Scene while room authority is live
  - `apps/apis/convex/scenes/presentations.test.ts`: fences direct writes and commits a live presentation only at the matching room state
  - `apps/apis/convex/encounters/sceneBindings.test.ts`: rejects a new binding while the Campaign live table owns the presented Scene
  - `apps/session-worker/test/nativeLiveSessionRoom.test.ts`: forwards an unplanned Encounter command in room order and acknowledges only its initiator
  - Implementation: `apps/apis/convex/liveSessions/authorityGuard.ts` (assertConvexOwnsSceneLiveState), `apps/apis/convex/encounters/commands.ts` (execute is internal; only the room route reaches it)

## Criteria that remain open

Updated in the second pass against `dd074aef`. No new test in `bfbf3a93`..`dd074aef` covers any row below except where a row says so.

| Criterion | Status kept | Missing clause or evidence |
| --- | --- | --- |
| `F12.3` | IN_PROGRESS | Deleted user attribution is asserted only for chat and rolls (`campaigns/chat.test.ts`) and for Social. No current test asserts Deleted user attribution on the Session log, Campaign-owned Encounter Run history or retained handout delivery. Existing tests prove only that these records are retained. |
| `F12.5` | IN_PROGRESS | Injected rollback is covered (`accountDeletion.test.ts` late rollback, `developmentAccountDeletionRollback.test.ts`). No current test reruns deferred cleanup and shows that it converges identically; only the historical browser suite did. |
| `P15.1` | IN_PROGRESS | Concurrent Session numbering and metadata contention are asserted only in the real-backend driver `apps/apis/tests/developmentSessionControl.ts` (`verifySessionControl`), which no in-process test runs. RSVP uniqueness, attendance, note privacy, reference pins and finish replay are covered by `sessions`, `sessionNotes` and `sessionReferences` tests. |
| `P15.3` | IN_PROGRESS | Clock version contention is asserted only in the same real-backend driver. "Managed recovery stays within limits" needs a managed performance run. DAILY once-only recovery is covered by `clock.test.ts`. |
| `P15.4` | IN_PROGRESS | GM adjustment and condition contention are asserted only in the same real-backend driver. Projection, masking, removal and archived-before-replay are covered by `gmWrites`, `gmReads` and `sessionNotes` tests. |
| `V05.3` | IN_PROGRESS | Origin, wrong-room and ticket-replay refusals are tested. No test covers an invalid signature or invalid claims (issuer, audience, version or role), and no test directly asserts that current authority is renewed under a lock before READY. |
| `V05.4` | IN_PROGRESS | Closing a removed member's socket is tested ("closes an authenticated socket when a later capture returns membership conflict"). No test covers stale-role closure or authority rotating to another current member. The role recheck exists in `nativeLiveSessionRoom.ts`. |
| `V07.4` | IN_PROGRESS | Implemented server-side: a controlling member commits in `scenes/standaloneMovement.test.ts`, and the room planner refuses uncontrolled players. No test shows a player committing a controlled-token move through the room on the presented Scene. The web gate removal in `CampaignVttStage.tsx` is untested. |
| `V07.5` | IN_PROGRESS | Bound-token control follows the predicate (`playerControl.test.ts`). **Not implemented:** no display of a player's remaining movement exists in `apps/web/src`. D37 schedules it with S4-c (the room's bound-movement commit). |
| `V11.4` | IN_PROGRESS | Reworded by Q6. Controller and GM answering, the Assisted pause on a creature save for the GM, and the auto-roll exception are tested (`evidenceRolls.test.ts`). **Missing:** "Manual mode raises no rules prompts" is asserted only for movement (`spatialMovement.test.ts` "leaves targets and effects unchanged in Manual mode"), turn phases and initiative. No test covers a save-forcing action in a Manual Run: native action execution throws "Native action execution requires an Assisted Encounter." (`actionAdmission.ts`), and nothing asserts that refusal or the absence of a prompt. Manual Concentration (`concentration.ts`) is also unasserted. |
| `V14.4` | IN_PROGRESS | Covered only by the real-backend driver `developmentEncounterReactionTransactions.ts`, which is stale against current contracts: it sends `SYSTEM_ROLL` without `rollId` and `ENTER_DICE` without `rollMode`, and it calls the now-internal `commandActions` execute. No in-process test covers it. |
| `V15.1` | IN_PROGRESS | No passing frozen-workload run exists; the last attempt, V15-20260924-05, failed. The handoff defers V15 until room dispatch and recovery exist. |
| `V15.2` | IN_PROGRESS | No measurements exist. |
| `V15.3` | IN_PROGRESS | The schedule labels PLAYER participants, but `developmentEncounterCutover.ts` issues every command as the GM. |
| `V15.4` | NOT_STARTED | Needs a managed R09 run. |
| `R01.1`–`R05.1` | IN_PROGRESS | These need fresh final-source builds, typechecks and scans. Tracked source and the lockfile have no `@supabase`, `@trpc` or `@gorules` dependency; the lockfile keeps transitive `pg@8` and `@better-auth/kysely-adapter`. The static audit currently **fails**, but only on ignored local leftovers: `apps/web/vite-env.d.ts` (declares `VITE_SUPABASE_*`; ignored by the root `*.d.ts` rule), `apps/web/.netlify/` and `apps/web/storybook-static/`. A fresh R08 checkout would not contain them. |
| `R01.2`–`R05.2`, `R08.*`, `R09.*`, `R10.*` | unchanged | Need the R08 lifecycle, staging or production runs. |
| `R06.1` | IN_PROGRESS | The room now caches stable captures and bundles each command's volatile capture into one Convex read with per-part read checksums (D32, `roomCaptureCache.test.ts`), but ordered room dispatch and crash recovery are still missing, and the S4B planners (Disarm, Cleaving responses, `ROLL_ENEMY_ACTION`, Legendary Resistance, spatial interpretation, Manual) still run in Convex (handoff Next 7–8). |
| `R06.2` | IN_PROGRESS | **Not implemented:** the room refuses Encounter-bound movement ("rejects encounter-bound token movement before committing durable state"). The D27 Convex-first route is pending. |

## Judgment calls on READY criteria

- `V03.5`: the handoff's fog follow-up notes that Convex fog writes don't enforce the rule matching layer owner kind to fog mode (shared-party or per-player). Visibility with fog on uses the existing model, so the criterion is treated as met.
- `P06.5`: revealing a blind GM roll is asserted end to end. Revealing a plain private roll uses the same `reveal` path but has no separate success assertion.
- `V08.5`: reconnect survival rests on the Convex-persisted presentation and the Worker resume test; no browser test covers it.
- `V10.9`: the GM override badge renders in `CampaignEncounterWorkspace.tsx` from timeline `ruleOverrides`, which is tested server-side. The badge itself has no unit test.
- `R06.4`: the room is the single writer because Convex refuses direct writes to the presented Scene, including Encounter-bound movement. Until R06.2 lands, bound movement on the presented Scene is refused rather than routed.
