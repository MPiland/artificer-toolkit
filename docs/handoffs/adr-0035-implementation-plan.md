# ADR 0035 implementation plan

> Status: approved direction, implementation in progress (updated 2026-09-30). This plan implements [ADR 0035](../adr/0035-room-authoritative-live-encounters.md), including its amendments. The mapping below is the historical 2026-09-27 baseline at `26179a9f4`, not current behavior. Current source and remaining work are recorded in the [source batch](../validation/phase-08-2/room-command-source-batch-2026-09-30.md) and [Claude continuation handoff](phase-08-2-claude-source-first.md). Acceptance remains **51/75 cases and 190/276 criteria**.

Current unverified source includes fenced delta checkpoints, SQLite Scene geometry/undo/binding and
native Encounter transactions, Character Builder reload reconciliation, fresh-epoch corruption
recovery, and S7 held Character play/receipt transactions. Character holds and direct Convex play
fences are present; frontend routing/subscriptions and membership/account-deletion integration are
unfinished. S3 and S5–S9 still require integrated execution evidence and remaining implementation.
The user directed source completion before another long validation run. Do not interpret this
implementation progress as an accepted gate or permission for staging.

## Why the switch has to cover a whole Run

Encounter commands, bound-token movement, GM tools and Character play state all write the same Convex records. Moving one command family to the room while the others still commit in Convex would create two writers.

So the slices build independently testable parts first (S1–S5), then switch a Run's authority and delete the per-command Convex path in one slice (S6). The Sheet (S7) and the pages outside the room (S8) follow.

The largest piece of work is moving the Convex write code behind a store interface so the room can run it. That code applies each command's result through the Convex database handle (`ctx.db`), about 8–10k lines.

## Historical baseline code mapped to the target — 2026-09-27

- **Room at the baseline** (`apps/session-worker/src/nativeLiveSessionRoom.ts`)
  - There is one command chain. Each socket's admission is captured from Convex, and actor control is not cached.
  - Encounter commands go through `nativeRoomEncounterCommand.ts` to the planners. The planners capture their inputs from Convex, with a per-room cache in `nativeCaptureCache.ts`, and commit through about 15 per-command HTTP routes.
  - Only the initiator hears the result. Everyone else sees Convex subscriptions: `activeReads`, `projectionReads`, `pendingReads`, `timelineReads`, `actionChoices` and `evidenceRolls.latest`.
- **Scene lanes**
  - (a) Standalone moves, doors and undo commit to SQLite, then publish in order through `state:publish`, which advances `campaignLiveAuthorities.persistedSequence` one step at a time.
  - (b) The Convex-first lane (`nativeExternalSceneCommit.ts`, D27/D52) carries bound moves, fog, movement decisions and binding.
- **Durability:** `durableCommandJournal.ts` stores the whole state as JSON per commit, in 128K chunks. Today that state is only the Scene.
- **Change hooks:** triggers in `apps/apis/convex/lib/mutations.ts` bump the SYSTEM, CAMPAIGN, CHARACTER and PLAY revision rows. These become the room's invalidation source.
- **Character play state** is spread across four places, all versioned by the Character's `streamVersion`:
  - `characters.documentJson.state`
  - `sheetState.resourceUsage`
  - `campaignCharacterStates`
  - `characterActiveRuleEffects`

**What happens to the code**

- **Deleted by the end**
  - Worker:
    - the capture-bundle and System-stamp caching, and `nativeRulesRevisions.ts`;
    - `nativeExternalSceneCommit.ts`, keeping its planning helpers;
    - the external-commit write-ahead and resolve in the journal;
    - `#commitExternal`, `#settleExternalCommit` and the Convex-first `#executeEncounterBinding`;
    - `#refreshMovementHold` and `isExternalSceneCommand`;
    - the per-command routes in `liveSessionRoutes.ts`.
  - Convex (`liveSessions/`):
    - the capture bundle, `encounterRoute`, and the action, turn, concentration, cleaving, disarm, basic action, void, roll, command, command-admission and movement modules;
    - `externalCommit`, the Convex-first binding, and `rulesRevisions` as a commit fence;
    - their routes in `stateHttp.ts` and `http.ts`.
  - `packages/schema`: the matching `liveSessionEncounter*`, movement commit and stage, and rules-revisions contracts.
- **Moved into a new store-agnostic package** (`packages/encounter-persistence`):
  - command admission;
  - the persistence writers: mechanics batch, action children, action economy, initiative store, timeline, command replay, occurrence void, actor removal, revert, reinforcement, reorder, initiative correction, evidence rolls, turn movement, ally advantage, and `recordEncounterCommand`;
  - the projection code: `resultPresentation`, `pendingReads`, `actionChoices`;
  - the capture builders: `encounterRulesCapture` and `characterRulesCapture`.
- **Kept**
  - the rules planners, now reading from a new capture source;
  - `rules-runtime`;
  - ticket issue, bootstrap, activate, drain and release;
  - presentation control, eviction and closure;
  - Run create and delete-PREPARED, and Blueprints;
  - the reads outside play, over the checkpoint;
  - Sheet mutations outside live play.
- **New**
  - Worker:
    - `roomEncounterStore.ts`
    - `roomInputs.ts`
    - `roomAuthorization.ts`
    - `roomCheckpoint.ts`
    - `roomEncounterExecutor.ts`
    - `roomCaptureSource.ts`
    - `roomEncounterFanout.ts`
    - `roomCharacterPlay.ts`
  - Convex:
    - `liveSessions/checkpoint.ts`
    - `liveSessions/roomInputs.ts`
    - the `assertConvexOwnsEncounterRun` and `assertConvexOwnsCharacterPlayState` fences
    - a `liveCharacterHolds` table
    - the room-notification trigger
  - Web: room-sourced Encounter views, and a Sheet route for held Characters.

## Slices

| Slice                                                                                                    | Goal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Key tests first                                                                                                                                                                                                                                                                                                                                                                            | Acceptance affected                                                        |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **S0** Decision gate                                                                                     | Approve the amendments and the acceptance rewordings. Spike room CPU in `wrangler dev` (an 11-actor action, a 100-actor hydrate, a wake from hibernation), model Durable Object rows, requests and duration for V15, and measure delta checkpoint size at 11 and 100 actors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | –                                                                                                                                                                                                                                                                                                                                                                                          | Approval record only                                                       |
| **S1** Extract the writers                                                                               | Move the writers, admission, projection and capture builders behind an `EncounterStore` interface: the subset of `ctx.db` they use, over the same table and index names. The Convex adapter is `ctx.db`. Add the `liveSessionCheckpoint`, `characterPlayState` and `liveRoomEncounterView` contracts, and the `INVALIDATE_INPUTS` control.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Every existing Encounter suite still green; a conformance suite running the same fixtures on the Convex and in-memory adapters, with golden outputs; a split/merge property test for play state                                                                                                                                                                                            | None                                                                       |
| **S1b** Encounter record shapes (Amendment 12)                                                           | Done locally: the Run stores no projection (built on read from the Run state, actors, initiative and Characters); `encounterRunCommands` stores a replay receipt (roll and occurrence) instead of the whole result; initiative and occurrence updates patch only changed fields; Character actors keep `frozenState` when the Run stops reading them. See [Encounter record shapes](../architecture/persistence.md#encounter-record-shapes-adr-0035-amendment-12) and the [record](../validation/phase-08-2/adr-0035-s1b-record-shapes-2026-09-28.md). Follow-ups, done locally: (a) projections read small per-actor projection facts (and one stat block and Feature set per identical Creature source) written with each actor, not the actor documents (a 100-actor read is 218 KB, was 691 KB); (b) a pending occurrence's sealed snapshot is stored as a base and one delta per update, so a tied-initiative order choice writes about 3 KB, not 339 KB (a tied 100-actor START writes 0.82 MB, was 17.2 MB); (c) `projectionReads:list` returns Run summaries, one document per Run, and the web renders the selected Run through `get`. The Character play-state split is done locally too: see [Character play state](../architecture/character.md#character-play-state-adr-0035-amendment-12--local-implementation) and [S1c below](#s1c-character-play-state-implemented). | Replay byte-identity while the Run is at the command's version; GM and player projections equal the pre-change goldens on the conformance corpus, and the stored projection facts project what the actor documents do; write-set sizes at 11 and 100 actors, a 100-actor projection read of at most 250 KB, a tied 100-actor START of at most 2 MB, and a Run list of one document per Run | None                                                                       |
| **S2** Room store                                                                                        | Hydrate and rehydrate. SQLite holds snapshot chunks plus a log of each command's writes (one row per command), with an all-or-nothing overlay per command and compaction at each checkpoint. The state checksum is a chain over each command's write set. A new paged Convex `roomInputs` query, authorized by the Worker secret and the `DO_ACTIVE` epoch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Hydrate parity; crash and rehydrate, including a log row torn mid-write; compaction equivalence; 100-actor size and CPU; rows written per command; room-scope authorization                                                                                                                                                                                                                | None                                                                       |
| **S3** Checkpoint                                                                                        | One idempotent, fenced checkpoint replaces `state:publish`, and the Scene outbox folds into it. The alarm gains a checkpoint deadline. Drain and release need the final checkpoint. Checkpoint-originated writes do not trigger notifications. Commands, rule receipts and occurrences reach Convex packed as one ledger document per checkpoint (Amendment 12, not done in S1b). A checkpoint carries only changed fields, as S1b's patches do, and a pending snapshot's new delta part rather than the whole snapshot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Idempotent replay; every fence refusal (wrong epoch, sequence gap, stale checksum, past drain, after release); atomic rollback; no notification loop; staged atomic commit; presentation A → B → A                                                                                                                                                                                         | V05.5, V07.1                                                               |
| **S4** Authorization cache (implemented 2026-09-28, see [S4 below](#s4-authorization-cache-implemented)) | Membership, roles, assignments, controllers, auto-roll preferences, party visibility and health display are cached with a 240 s lease (Amendment 14). `INVALIDATE_INPUTS` comes from the revision triggers, coalesced per transaction. While a Run is held, departure and deletion only evict and notify (deferred to S6: nothing holds a Run yet).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Removal during live play (socket closed, queued commands refused, broadcasts stopped); a lost notification still evicts within the lease; ownership transfer; an assignment change; party-view and health-display changes apply on the next broadcast; preview privacy                                                                                                                     | V05.4, V12.2                                                               |
| **S5** Shadow parity                                                                                     | Re-scoped by D77 (2026-10-01): the room already commits natively, so a convex-test suite drives one command sequence through the room-native path and the protected Convex comparators from the same hydrated state, comparing after every command. Development only; deleted with the comparators in S6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Zero differences across all planners and GM tools                                                                                                                                                                                                                                                                                                                                          | Evidence for R06                                                           |
| **S6** The switch                                                                                        | ACTIVE Runs become room-authoritative: authorize from cache, plan from the store, apply with the moved writers, then one SQLite transaction (write set, receipt, journal), then acknowledge, then per-recipient fan-out. Lifecycle commands wait for a synchronous checkpoint. The Convex fences go in. Bound moves, fog, decisions and binding become room commands. The web reads Encounter state from the room socket. Sheet play writes for held Characters are refused for now. The per-command Convex path is deleted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Hidden-actor privacy across results, decisions, timeline and roll cards; replay (including across a restart or release); crash before and after the commit; a direct Convex write to a held Run is refused; storage loss forces a new epoch; zero Convex calls per command; room-serialized contention                                                                                     | R06.1–R06.4, V07.1, V08.6, V13 (re-proof), V14.3–V14.5, V15.1–V15.2, R01.2 |
| **S7** Sheet through the room                                                                            | A held Character's Sheet opens the room socket. The play commands (HP, temporary HP, hit dice, conditions, exhaustion, slots, resources, usage, GM Campaign adjustments) run in the room with the pure reducer, and their receipts are written by checkpoint. Rests are refused while held. Builder edits reload at the next boundary, clamping HP and dropping usage for removed grants.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | A Builder save and a room HP change both survive; a level-up clamps HP; a direct play write to Convex is refused while held; undo is refused after a Sheet play change; party-view privacy                                                                                                                                                                                                 | R06.3, V14.5, P04.3, P08.2, P08.4, P15.4                                   |
| **S8** Pages outside the room and chat                                                                   | Pages that are not live read the last checkpoint and show when it was taken. Roll cards go live through the room, then persist to chat by checkpoint with stable IDs, de-duplicated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | No duplicate roll cards; a private GM roll is never in players' live feed                                                                                                                                                                                                                                                                                                                  | V11.5, P06.4                                                               |
| **S9** Budgets and cleanup                                                                               | Delete the shadow harness. Add Decision 9 budgets to V15 (Convex I/O, and Durable Object requests, duration, rows and CPU). Rewrite `live-sessions.md`, `persistence.md` and `rules-runtime.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Budget gates                                                                                                                                                                                                                                                                                                                                                                               | V15.2 plus new criteria                                                    |

## Write-behind flush slices (D86)

**Approved 2026-10-03** with
[ADR 0035 D86](../adr/0035-room-authoritative-live-encounters.md#d86-write-behind-state-flush-live-views-read-the-room--2026-10-03).
Runs inside VS-8 before REL-5 resumes.

**Order:** S10a → S10b → S10c → S10d → REL-5.

- The slices run one at a time because they share the checkpoint writer and the room's flush path.
- S10a comes first so later slices are measured against a delta-sized flush.
- S10d could run before S10c, since it reduces each flush, but the order does not change the end state.

### A35-S10a: delta-sized flushes (Amendment 18)

**Status:** done 2026-10-03 ([measurement](../validation/phase-08-2/a35-s10a-flush-io-2026-10-03.md)).

**Goal:**

- Instrument each checkpoint's Convex bytes read and written per section: authority fence, Campaign and roster, per-record checksums, authorization renewal, and receipt-ledger checks.
- Then remove the floor:
  - fence on the authority row and the delta's own records only;
  - filter controllers for Characters in the delta only;
  - move lease renewal to a separate call at most once per 120 s while sockets are connected;
  - drop the ledger collision and orphan reads that S10d makes moot, or narrow them to the delta.

**Key tests first:**

- A one-actor HP flush reads only the delta's records plus the authority row, whatever the Campaign's roster size (a 4-member and a 40-member Campaign read the same bytes).
- Fence refusals are unchanged: epoch, sequence, checksum, drain and release.
- The lease is renewed without a checkpoint.
- A lost eviction is still corrected within the lease.

**Acceptance affected:** V15.2 evidence.

### A35-S10b: no forced binding or admission flushes; proactive re-challenge (Amendments 17 and 23)

**Goal:**

- Token bind and unbind, AUTHENTICATE, and round change stop checkpointing before acknowledgement.
- Find the token-binding view that reads Convex. Point it at the room, or delete it if nothing reads it.
- The synchronous list becomes START, COMPLETE, DELETE, adding or removing a Character actor, and the departure reconcile. Fix LS:170's REVERT_LAST_ACTION entry.
- The room challenges each socket at admission expiry minus 60 s.

**Key tests first:**

- Bind, unbind, admission and round change make zero Convex calls.
- Lifecycle commands still wait.
- A passive socket past its JWT lifetime keeps receiving pushes after a refresh-cycle re-authentication.
- An unanswered challenge closes the socket with a reason, never silently.

**Acceptance affected:** V15.1 and V15.2 evidence.

**Status: done (2026-10-04).** The synchronous list (START, COMPLETE, Character actor removal; DELETE
and Character actor add are Convex-side, not room commands), bind, unbind and round change with zero
Convex calls, and the proactive re-challenge with a closing reason, as before. Added after the architect
rulings:

- Warm admission: the ticket (version 3) carries the Better Auth subject as `authSubject`; the room
  verifies the access token locally (RS256, cached Convex site JWKS, issuer, audience, `exp`), requires
  `sub` equal to it, and admits from the cached lease with no Convex call. Any token it cannot prove goes
  the cold path. Proven by native tests: warm re-admission, a passive socket surviving a
  challenge-driven re-authentication, a wrong `sub` closed, an expired or forged token refused.
- Token-binding view: `ACTOR_TOKEN_BINDINGS` read in `encounterReadDtoSchema`, answered by the room
  filtered to the viewer's visible tokens; `CampaignVttStage.tsx` uses it while routed (re-asking when
  the viewer's token set changes) and keeps the Convex action when unrouted. Proven by native tests: a
  player's read omits a hidden token's binding, and a bind and unbind show in the read with no Convex
  call.
- Character actor removal checkpointing: proven in `roomEncounterConcentrationResponse.test.ts` (a
  Character actor's removal sets `checkpointBeforeAcknowledgement`, a Custom actor's does not) and
  `roomEncounterTurns.test.ts` (ADVANCE_TURN does not).

### A35-S10c: dirty-only flush, live views on the room, edits stream in (Amendments 17, 19, 20 and 21)

**Goal:**

- **Flush cadence:** a dirty-only coalesced flush at N (a single constant, 30–120 s), replacing the 120 s deadline. A due flush rides the next incoming message; an alarm fires only when the room is quiet.
- **Live summary feed:**
  - List every page outside the table that shows room-owned state: HP, conditions, resources and slots, round and turn, token positions.
  - Add one privacy-projected live Campaign summary feed in the room.
  - Switch those parts of the pages to that feed while the table is running, using the Sheet's "is a table running" check, and back to Convex when it ends.
- **Sheet edits:** the Sheet shows play edits at once and reverts with the reason on a refusal. The Sheet keeps its room path from any window.
- **Eager reload:** `INVALIDATE_INPUTS` reloads at once and pushes while sockets are connected.

**Key tests first:**

- **No idle calls:** an idle table and a ping-only table make zero Convex calls.
- **Coalescing:** a burst of commands within N yields one flush.
- **Summary pages:**
  - a summary page opened in another window shows a table HP change as fast as the table does;
  - it returns to Convex, current, after the table closes;
  - hidden actors and GM-only data never reach a player's summary.
- **Sheet edits:**
  - a Sheet edit in a non-table window shows at once and applies once on retry;
  - a refusal reverts and shows its reason;
  - a pending decision does not block a Sheet edit.
- **Reload:** a GM's weapon Feature edit during a map session without an Encounter reaches the table without a command.

**Acceptance affected:** R06.3, V14.5, P04.3, P08.2 and P08.4 (re-proof); V15.

### A35-S10d: Encounter history stays in the room (Amendment 22, D85)

**Goal:**

- Checkpoints stop writing Encounter history ledgers, ledger parts and timeline-only headers.
- The room discards its timeline, command log and receipts when the Run ends.
- A compact Run-scoped replay index replaces cross-epoch receipt hydrate (`roomInputs.ts`), and is deleted when the Run ends.
- Chat and roll cards ride the regular flush.
- Remove the receipt families that have no product reader, and their readers, cleanup and tests (pre-launch, so no compatibility layer).
- Reset and reseed local data.

**Key tests first:**

- **Replay:** a retry across an epoch returns the applied version plus the current projection, with no second effect or reroll.
- **Chat:** chat and roll cards persist with stable IDs and no duplicates.
- **Run end:** nothing of the timeline stays in Convex or the room's SQLite after COMPLETE.
- **Deletion:** Campaign and account deletion are still correct.

**Acceptance affected:** V11.5 and R06 replay re-proof; persistence docs.

### REL-5 (resumes): re-measure V15 and set N

**Goal:**

- **Re-run:** run V15 on the new design with the event recorder, and diagnose the a11 reactor stall (MOVEMENT_REACTION not delivered) if it recurs.
- **Measure:** Convex I/O per session and per flush trigger, Durable Object requests, rows and duration.
- **Set N:** a value in 30–120 s that fits Q16 and Workers Free.
- **Record the budgets.**
- **Session model (product owner, 2026-10-03):** a 5-hour session with 4 fights of 8 rounds, 5 players and a GM, played weekly; assume 6 enemies per fight and about 3 hours of combat. Measure one group, report per-session costs, then the weekly groups that fit each free tier. The planning estimate (about 2,000 commands, 2.5–12 MB Convex, 1,300 Durable Object requests and 5–9k rows per session, so 10–45 weekly groups) is unverified until measured.

**Key tests first:** the V15 gate with hard budgets.

**Acceptance affected:** V15.1–V15.3.

**Docs per slice:**

- `live-sessions.md`: cadence, the live summary feed, the Sheet from any window, and re-challenge;
- `persistence.md`: history and receipts;
- `character.md`: Sheet edits show at once.

## Checkpoint contract

The contract is `liveSessions/checkpoint:commit`, an internal mutation behind the Worker-secret route `/live-sessions/checkpoint`.

- **Input**
  - Fence fields: `{campaignId, epoch, checkpointId, fromSequence, fromChecksum, toSequence, toChecksum, reason, appliedInputs}`.
  - `scene`: the ordered publications and fog changes.
  - `encounter`: changed records by public UUID. Commands, rule receipts and evidence rolls are append-only.
  - `characters[]`: play state, active-effect changes, Campaign state and receipts.
  - `chat[]`: roll cards.
- **Accepted only when:**
  - the authority is `DO_ACTIVE`, or `DRAINING` within its final sequence;
  - the `from` values equal what Convex has persisted.
- **Replay:** a retry identical to a checkpoint already in the ledger returns `REPLAYED`.
- **Structural checks only, no rules:**
  - every record belongs to this Campaign and Run;
  - every Character is held by this epoch;
  - only play-state fields change;
  - controller lists are filtered to current players;
  - sizes are bounded.
- **Commit:** it advances the persisted sequence and checksum in the same transaction. An oversized checkpoint is staged in parts and committed atomically.
- **History storage (D70, 2026-09-29):** Codex decided to pack immutable history payloads once per
  checkpoint while retaining small indexed per-command receipt headers pointing into the checksummed
  ledger. The user approved that decision. Headers preserve UUID replay, collision checks, privacy
  and complete timeline paging; they do not duplicate history bodies. Ledger/header publication is
  atomic in the checkpoint transaction. Private Character header cleanup is atomic with
  account/Character state deletion and durable purge intent. Under D71, recommended by Codex and
  approved by the user on 2026-09-30,
  unreachable private Character payloads are physically purged in bounded, retryable native mutations
  after verifying private ownership and no live headers; shared Encounter history is retained.
  See [ADR 0035 D70](../adr/0035-room-authoritative-live-encounters.md#d70-packed-history-with-indexed-receipt-headers--2026-09-29)
  and [ADR 0035 D71](../adr/0035-room-authoritative-live-encounters.md#d71-bounded-deferred-private-payload-purge--2026-09-30).
- **Response:** persisted sequence and checksum, `replayed`, the SYSTEM, CAMPAIGN, PLAY and Character revisions, and a membership digest. The response also renews the lease.

**Cost warning.** Whole-record checkpoints were estimated at 50–150 KB each, which is 25–70 MB per 4-hour session at 30 s. That alone would break the free tier. Checkpoints must carry only changed records, and the interval N is sized by the Q16 budget.

## How the room's caches are invalidated

**Existing paths that stay:**

- EVICT_USER, from departure, account deletion, transfer and auth revocation;
- CLOSE_ROOM, from archive and delete;
- presentation control.

**New: `INVALIDATE_INPUTS`, from the revision triggers.**

- CAMPAIGN scope: memberships, assignments and content shares.
- PLAY scope, which is new: `campaignPlaySettings`.
- CHARACTER scope, mapped to the Campaign through the assignment: characters, drafts, Campaign Character state and active effects.
- User preferences: auto-roll.
- SYSTEM changes are pulled on checkpoint responses and at hydrate.

The lease is the backstop for lost notifications. Since S4, an eviction retries until the room acknowledges it or releases, so the lease covers only an eviction lost that way; other control keeps five attempts.

## S4 authorization cache (implemented)

Landed 2026-09-28 on `codex/phase-08-2-convex-cutover`; [live-sessions.md](../architecture/live-sessions.md#room-authorization-cache-adr-0035-s4) is the canonical description.

- **Contract:** `packages/schema/src/api/liveSessionRoomAuthorization.ts` (revisions, sections, the room read) and `INVALIDATE_INPUTS { scopes }` in `liveSessions.ts`.
- **Convex:** `liveSessions/roomAuthorization:read` behind the Worker-secret route `/live-sessions/room-authorization`, authorized by the `DO_ACTIVE` epoch. It always reads the revisions (CAMPAIGN, PLAY, each assigned Character, a digest of the members' auto-roll preferences) and returns only the sections whose revision differs from the room's `known` revisions.
- **Triggers:** `lib/mutations.ts` records CAMPAIGN and CHARACTER revision bumps, `campaignPlaySettings` (now also a PLAY revision source) and auto-roll changes per transaction, maps Characters to their Campaign through the assignment, and schedules one `INVALIDATE_INPUTS` per Campaign from the mutation's `onSuccess`, only while that Campaign's authority is `DO_ACTIVE`. Encounter PLAY writes are not pushed: they come from the room's own forwarded commands, after which the room reloads its PLAY section itself.
- **Room:** `apps/session-worker/src/roomAuthorization.ts`. Commands and Scene synchronization reload a stale or expired cache first; previews and pings are refused while it is stale or expired and start one background read. Each (re-)authentication renews the lease; `RoomAuthorization.renew` is the hook for S3 checkpoint responses. The per-player 30 s AUTHORITY capture lease and the `/live-sessions/vision-revisions` route are deleted.
- **Eviction delivery:** `liveSessions/control.ts` retries an eviction with backoff capped at 60 s while `liveSessions/authority:held` reports a room.
- **Held Runs:** nothing depends on the held-Run concept yet (no `liveCharacterHolds`, and Encounter state is still Convex-owned), so `membershipDeparture.ts` and `accountDeparture.helper.ts` keep removing assignments and actor controllers in Convex. S6 must switch them to evict and notify only while a Run is held, with the room filtering controllers and checkpoints filtering controller lists.
- **Consumers still to come:** party visibility, health display and auto-roll preferences are cached and reloaded, but nothing in the room reads them until the S6 fan-out (`EncounterPlayerHealthViewer`) and S7 Sheet. Their tests prove the cache refuses use after a notice and serves the new values after one read.
- **Cost notes:** party visibility is read from the Character's small play record (S1c), only when that Character's revision changes. Until S6, Encounter commands the room forwards still write Characters in Convex, so they send CHARACTER notices back to the room.

## S1c Character play state (implemented)

Landed locally 2026-09-29; [character.md](../architecture/character.md#character-play-state-adr-0035-amendment-12--local-implementation) is canonical and the [record](../validation/phase-08-2/adr-0035-s1c-character-play-state-2026-09-29.md) has the method.

- **Contract (S2's record shape).** `packages/schema/src/projections/characterPlayState.ts` (`characterPlayStateSchema`, `splitCharacterPlayState`, `mergeCharacterPlayState`, round-trip property test) and `characterStoredState.ts` (the joined `characterStoredRowSchema`, `readCharacterRecord`, `encodeCharacterRecord`). The room holds `characterPlayStates` rows opaquely and checkpoints them as they are.
- **Tables.** `characters` holds structure, clocked by `updatedAt`. `characterPlayStates` holds typed `state`, its canonical checksum, `maximumHitPoints` and `walkingSpeed`, clocked by `streamVersion`. The 2026-09-29 completion work replaces the original `playJson` column and resets development data. `campaignCharacterStates` and `characterActiveRuleEffects` stay per Campaign: one record per Character per Campaign would fan a Character out across contexts.
- **Concurrency.** Play commands check the play `streamVersion`; Builder commits check `characters.updatedAt`, overlay live play onto the draft and bump the play stream only if the commit changes play content or clamps HP. Both survive when they overlap. Full rule in character.md.
- **INPUTS wire.** `liveSessionCharacterInputsResponseSchema` carries one joined `owner` row (with `sheetState`, `system`, `campaign`), replacing `character`, `movementOwner`, `characterChecksum`, `updatedAt` and `streamVersion`. `MAINTENANCE_OWNER` responses carry a joined `character` row. The Worker reads them with `readCharacterRecord`.
- **Measured.** Sheet HP change 8.2 KB to 1.1 KB written; Encounter damage 8.3 KB to 1.2 KB.
- **Follow-ups.** Inventory, currency, companion hit points and class-spell state are still structure. Rules evaluation still reads the joined row, so reads are not smaller. The Builder clamp uses the Character-only maximum. The local codegen push (AGENTS.md) was not run in this slice (no Docker).

## S2 room store: hydrate and rehydrate (implemented)

Landed 2026-09-29 on `codex/phase-08-2-convex-cutover`; [live-sessions.md](../architecture/live-sessions.md) is the canonical description.

- **Store:** `apps/session-worker/src/roomEncounterStore.ts` is an `EncounterStore` over Durable Object SQLite. Two tables: `room_snapshot_chunks` (the folded state, chunked at 96,000 characters) and `room_writeset_log` (one row per command: its write set, counters and a state checksum chained as `sha256(previous:writeSetChecksum)`). Reads come from an in-memory index; a command runs against a per-command overlay and commits as exactly one log row (a command that changes nothing writes none). Compaction folds the log into a fresh snapshot in one `transactionSync`.
- **Durability:** only the log-row INSERT (or a snapshot transaction) touches SQLite, so a crash before it loses the whole command and a crash after it leaves a row that alone reproduces the command. A torn or invalid last row is dropped on rehydrate. Mid-log damage or a broken snapshot leaves the store empty with `corruption` set; S6 must treat that as "start a new epoch from Convex". Write-set replay is checked against Convex through the shared conformance suite.
- **Hydrate:** `apps/session-worker/src/roomInputs.ts` reads the Run aggregate, its Characters in batches (opaque per-Character records, keyed by Character id; a departed Character reads as unassigned and uses its actor's frozen state), the Campaign play scope and the System with vocabulary through the Worker-secret route `/live-sessions/room-inputs` (`liveSessions/roomInputs`, authorized by the `DO_ACTIVE` epoch; contract in `packages/schema/src/api/liveRoomInputs.ts`). Within an epoch the room rebuilds from its own SQLite; across epochs it hydrates from Convex (Amendment 2). The rules inputs are cached by scope and revision, reused while the S4 revisions match, and read again on a miss.
- **Wiring:** hydrate runs at the end of room activation; a hydrate failure fails activation. Nothing routes commands to the room yet (S6), so the SQLite copy is not read by play.
- **Measured (workerd, real cursors, synthetic fixtures):** 1 row written per command. Hydrate wrote 20 rows for 11 actors (269 KB aggregate) and 124 for 100 actors (1.9 MB). Rehydrate after 40 commands read 51 rows at 11 actors and 103 at 100. Compaction after 40 commands wrote 68 and 226 rows. CPU cannot be measured in workerd (time is frozen); Node (JIT, ratios only) put hydrate at 48 ms (11) and 201 ms (100) and a command at 0.1-0.3 ms.
- **Risks carried to S6:** the 1.8M-character write-set cap; a corrupt store must force a new epoch; the replay index after a Run completes; the SQLite copy going stale against Convex-first commits until S6; hydrate takes at most ten subrequests for 100 actors with 12 Characters (the route batches pages to 2048 documents or 2 MiB per call) against the Free-plan 50, and one more call per 2 MiB beyond that; the Durable Object's CPU limit is 30 s per request on Workers Free (Amendment 9; an earlier 10 ms claim was wrong); a departed Character reads as `UNASSIGNED` and its actor's `frozenState` stands in for it, so hydrate fails only when an actor is unassigned yet not frozen; run-history tables can be pruned from the hydrate later; the Character inputs fixture and `characterRulesCapture.ts` may need updating when the A12b play-state split lands.

## Open measurements (S0)

Measured 2026-09-27 in the [S0 validation record](../validation/phase-08-2/adr-0035-s0-2026-09-27.md), except the Worker bundle growth after the move. Its recommendations (the checkpoint record shapes, N = 120 s, a 240 s lease and memory-only previews) need architect approval.

- Room CPU per command, and the cost of waking a hibernated room.
- Checkpoint delta size at 11 and 100 actors.
- Convex transaction limits for a checkpoint.
- The access-token lifetime, which affects the lease.
- The Worker bundle growth after the move (4.38 MB, 0.75 MB gzipped, on 2026-09-26).
- **Existing problem:** transient preview samples upsert one SQLite row at about 31 Hz (`nativeSocketTransientState.ts`). That would exhaust the free plan's 100,000 rows written a day in minutes, so it has to change regardless.

## Acceptance rewordings (need approval)

| Case                       | Proposed wording                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R06.1                      | "The room evaluates rules, prepares facts and commits state, receipts and replay evidence to its SQLite in one transaction before acknowledging; Convex receives idempotent epoch/sequence-fenced checkpoints." |
| R06.2                      | "Encounter-bound movement and its decisions are room commands."                                                                                                                                                 |
| R06.3                      | "While a Character is in the live ACTIVE Run, its play state is room-owned and the Sheet acts through the room; otherwise Sheet writes stay in Convex."                                                         |
| R06.4                      | Add "…and the room owns ACTIVE Runs and their Characters' play state."                                                                                                                                          |
| V14.5                      | "The room holds Character play state; outside edits reload at the next command boundary without losing play state."                                                                                             |
| V05.5                      | "…commits its final checkpoint and releases…"                                                                                                                                                                   |
| V07.1                      | "…commit in the room and reach Convex by checkpoint…"                                                                                                                                                           |
| V15.1, V15.2               | Add zero Convex calls per command, and read/write budgets per session.                                                                                                                                          |
| R01.2                      | "Convex is the durable record; live Encounter state reaches it by checkpoint."                                                                                                                                  |
| P04.3, P08.2, P08.4, P15.4 | Add "outside live play".                                                                                                                                                                                        |
| F12.3, F12.4               | Add "including held Runs".                                                                                                                                                                                      |
| V13                        | Its evidence becomes historical; re-prove it.                                                                                                                                                                   |
