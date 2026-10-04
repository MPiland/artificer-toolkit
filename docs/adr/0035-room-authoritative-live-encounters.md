# ADR 0035: The room is authoritative for live Encounters; Convex is the record

- **Status:** decision (approved 2026-09-27; groundwork implemented locally; authority switch and final proof pending)
- **Date:** 2026-09-27
- **Revised:** 2026-10-03 (D86)
- **Scope:** who owns live Encounter state and combat play state while a table is live, how commands are authorized and made durable, how Convex receives the result, how views outside the room see it, and the free-tier cost budget for live play
- **Update when:** live Encounter authority, checkpointing, the room's durability, outside-the-room reads or edits, or the live-play cost budget changes
- **Supersedes:**
  - The per-command Convex path for Encounter commands in [ADR 0029](0029-convex-backend-cutover.md) ("Convex independently revalidates each ordered publication", and the live rules clarification's capture and validated commit boundary).
  - The D27 Convex-first external commits, the D52 capture-then-commit chain and D64 as they apply to Encounter commands.
  - Other decisions in 0029, 0033 and 0034 stay in force except the authority and drain amendments
    listed below. Rules and dice still run in the room (D41).

## Implementation status — 2026-09-30

S0 measurements, S1 persistence extraction, S1b Encounter record changes, S1c Character play-state
separation, S2 SQLite hydrate/rehydrate and S4 authorization caching are implemented locally.
Current source commits Scene move/door/undo, binding, the shared room-local Encounter command list
and nineteen held Character Sheet play commands to SQLite before acknowledgement. Epoch-fenced
Character holds protect the Convex play base across outside Builder changes. Direct Convex Encounter
commands are fenced for every command type while live authority exists; separately fenced Worker
endpoints retain transitional commits. Focused Sheet routing metadata records actual acknowledgement
time separately from lifecycle time. Frontend held Sheet routing and subscriptions remain open.
Fenced delta checkpoints, Builder reload reconciliation and corruption recovery into a fresh epoch
are integrated in source with execution evidence pending. S3 completion and S5–S9 (shadow parity,
complete authority switch, held Sheet actions, outside views/chat, budgets and cleanup) remain.
See [the implementation plan](../handoffs/adr-0035-implementation-plan.md)
for slice evidence and [the acceptance contract](../roadmap/08-2-convex-cutover-acceptance.md) for final proof.

## Context

Phase 8.2 moved rules execution into the Session Durable Object ("the room"), but Convex stayed the per-command authority. For every combat command the room:

1. captured its inputs from Convex (about 250 KB of reads);
2. evaluated them;
3. had Convex re-read and verify them in a fenced commit (400–800 KB);
4. triggered every player's Encounter projection to re-run in Convex (about 34 KB × players).

The V15 workload measured about 1 MB of Convex reads and two Convex round trips per command. A four-hour session therefore reads about 0.3 GB.

The product has to run on free hosting tiers at launch and until paying customers justify a paid plan. A 1 GB monthly database allowance would cover about three sessions for the whole user base. The same per-command round trips also keep reaction answers at the one-second latency budget.

Foundry VTT, the play baseline, keeps the live world in one server process and persists it locally. Owlbear Rodeo also keeps the live table in a single room.

## Decision

**Convex is the record of truth. While a table is live, the room is the source of truth.**

1. **Authority.** While a Campaign's room holds live authority and an Encounter Run is ACTIVE, the room owns:
   - the Run's live state;
   - the combat play state of every actor in it: hit points, temporary hit points, maximum hit point reductions, conditions and active effects, resources and spell slots, concentration, death saves and action economy.

   Every connected client reads that state from the room, over the socket it already holds.

2. **Steady-state commands never call Convex.** Lifecycle commands wait for a synchronous checkpoint;
   the first command after an invalidation reloads stale inputs (Amendment 1).
   - An Encounter command is authorized against the room's cached membership, role and control data (ADR 0034).
   - It is evaluated by the existing rules runtime against in-memory state.
   - State, receipt and replay evidence are committed to the room's SQLite storage in one transaction before the room acknowledges.
   - The result is broadcast to each recipient through the existing privacy projection: hidden actors, GM-only rolls and redactions (D62, Q14).
   - Receipts keep commands idempotent on retry.
3. **Checkpoints to Convex.**
   - **When:** the room writes a checkpoint at each round boundary and lifecycle event, before an idle release or drain, and no later than 120 seconds after the first unsent change (Amendments 1, 4 and 13).
   - **Fencing:** a checkpoint is one idempotent Convex mutation carrying the room's authority epoch and sequence. Convex accepts only a newer sequence under the current authority, so the existing authority fencing is reused.
   - **Contents:** the checkpoint writes the Run, the actors, Character play state, timeline entries and receipts that Convex's own features need, such as history, the Sheet outside play and audits.
4. **Durability.**
   - A Durable Object's SQLite commit survives crashes and restarts, so an acknowledged command is never lost.
   - Within an authority epoch, a restarted room rehydrates from its own storage.
   - Across epochs it hydrates from Convex's acknowledged final checkpoint. Lost or corrupt storage
     within an epoch forces a new epoch and client resynchronization; it cannot silently continue the old epoch (Amendment 2).
5. **Loading inputs.**
   - When the room hydrates, or a Run starts, it loads everything once: the compiled rules inputs for each Character and Creature, the Scene and the Run.
   - System and published content come from their version-stamped snapshots (Q15 option a).
   - After that, only invalidations cause reloads.
6. **Edits made outside the room.** A Builder save, GM content edits, and membership or assignment changes still go through Convex; the live table is never locked (Foundry allows editing at any time).
   - Convex then notifies the room.
   - The room reloads the affected rules inputs at the next command boundary, keeping live play state.
   - Membership and role revocations take effect immediately through the existing eviction path.
7. **Views outside the room.**
   - A player's Character Sheet, opened for a Character in an active live Run, shows the room's live play state, and its play actions (HP, slots, conditions) go to the room as commands. The Sheet still owns play interaction, but its authority during live play is the room.
   - Pages that are not live (Campaign overview, history, admin) read the last checkpoint.
8. **Convex's role.**
   - Convex owns accounts, auth, Campaigns, authoring, the Builder, content publication, Scenes outside play, invitations, notifications and the durable record.
   - It stops subscribing players to per-command Encounter projections during live play.
9. **Cost budget (D, gated).**
   - Live play must fit the free tier.
   - V15 gains hard budgets for Convex reads per command and per session, alongside the existing latency budgets.
   - The Builder gains a budget for reads per edit.
   - Budgets derive from the free allowances and a target number of active groups per month (Q16).

## Consequences

**Benefits:**

- Steady-state combat commands need no Convex round trips, so latency is bounded by room CPU (tens of milliseconds), not two HTTP calls.
- Convex reads for live play drop from about 1 MB per command to checkpoint and input-reload traffic,
  with checkpoints at most 120 seconds after the first unsent change, plus round/lifecycle boundaries.
- Subscriber re-runs during play disappear.
- The capture bundle, fenced commit, write-ahead journal and resolve route for Encounter commands are deleted, along with their per-command checksum verification (D52, D64 and much of D27).

**Costs and risks:**

- Two copies exist during play. Convex's copy lags by up to one checkpoint, so every reader must know which copy it reads.
- The room's cache of authorization data must be invalidated correctly. Security tests cover revocation during live play.
- Room rehydration, checkpoint idempotency and replay need their own tests.
- The acceptance rewordings were approved on 2026-09-27 and recorded in the
  [acceptance contract](../roadmap/08-2-convex-cutover-acceptance.md). Reopened cases still need final-source proof.
- This is a large change late in Phase 8.2. Work already done on capture and commit is partly retired.

**Unchanged:** rules and dice run in the room (D41); privacy projection; player control and GM override (ADR 0034); Campaign-owned play and the implicit live table (ADR 0033).

## Amendments from implementation planning (2026-09-27)

Accepted after the code mapping in [the implementation plan](../handoffs/adr-0035-implementation-plan.md).

1. **Steady-state commands never call Convex. Lifecycle commands do.** START, COMPLETE, DELETE, and adding or removing a Character actor wait for a synchronous checkpoint before they acknowledge. The first command after an invalidation reloads only the stale inputs.
2. **Rehydrating.**
   - Within an authority epoch, the room rehydrates from its own storage.
   - Across epochs, for example after an idle release, it starts from Convex's acknowledged final checkpoint. That is the normal path, not an incident.
   - If storage is lost within an epoch, the room forces a new epoch and resynchronizes clients.
3. **Character play state is explicit.** The `CharacterPlayState` contract now separates play fields
   into typed `characterPlayStates.state`, with effective maximum HP and walking speed on the same small
   row. Campaign adjustments and effects remain in `campaignCharacterStates` and
   `characterActiveRuleEffects`. See [Character play state](../architecture/character.md#character-play-state-adr-0035-amendment-12--local-implementation).
   - While a Character is held by a live Run (`liveCharacterHolds`), Convex refuses writes to those fields.
   - Checkpoints merge only those fields and bump `streamVersion` once per checkpoint.
   - Rests are refused while the Character is held.
4. **Cadence.** A checkpoint is sent no later than N seconds after the first unsent change, and at every round boundary and lifecycle event.
   - Checkpoints carry only the records that changed (deltas), never whole documents.
   - N is a tunable constant sized by the Q16 budget (Convex I/O counts checkpoint bytes). The room's SQLite already makes acknowledged commands durable, so N only bounds how stale pages outside the room are.
5. **Revocation has a bound.**
   - The room holds authorization under a 240 s lease, renewed by each checkpoint response and token renewal (Amendment 14).
   - A lost `INVALIDATE_INPUTS` or eviction notification is therefore corrected within the lease.
   - Membership departure and account deletion only evict and notify while a Run is held. The room applies the change, and checkpoints filter controller lists.
6. **The Scene lane is included.**
   - Bound moves, fog changes, movement decisions and Encounter binding become room commands.
   - Scene publications fold into checkpoints, replacing per-command `state:publish` and the Convex-first external commit path (D27 and D52).
   - Transient preview samples must not write a SQLite row per sample, because the free plan's rows-written limit is 100,000 a day.
7. **Replay.** A same-sequence checkpoint retry returns `REPLAYED`. Command replay across epochs is served by a replay index loaded from Convex receipts at hydrate. D68 clarifies that a retry is byte-identical while the Run is at that command's version; after later commands it returns the receipt plus the current projection, without a second effect or reroll.
8. **The broadcast fan-out is new work.** Other members see pending decisions, timeline entries and roll cards through the room with the privacy projection, not through Convex subscriptions. D69 extends this to all live chat: messages and roll cards fan out through the room and persist to Convex by checkpoint with stable IDs. Chat outside live play keeps its bounded Convex path. See [D68 and D69](../handoffs/phase-08-2-open-questions.md).
9. **Decision 9 budgets include Cloudflare.** They cover Durable Object requests, duration, rows written and CPU per command, alongside Convex I/O. Checked 2026-09-27: Durable Objects on Workers Free get 30 s of CPU per request (the 10 ms Workers Free limit does not apply); 100,000 requests a day; 13,000 GB-s a day; 5M rows read and 100,000 rows written a day; 5 GB stored.
10. **Also superseded:**
    - ADR 0034 §4's "the Sheet is the single writer of play state" while a Character is held;
    - ADR 0029's Character authority amendment and per-publication Scene re-check for live Runs;
    - ADR 0033's per-command outbox drain, which becomes a final checkpoint.
11. **Until room snapshot consumption (ADR 0036 S10) lands,** System content is loaded through the existing capture builders at hydrate. Browser snapshots are already implemented locally.

## Amendments from the S0 measurements (2026-09-27)

Based on the [S0 record](../validation/phase-08-2/adr-0035-s0-2026-09-27.md):

- **Room CPU:** 16–26 ms warm and 125–176 ms cold per 11-actor action; 84–144 ms warm at 100 actors.
- **Durable Object cost:** about 570 requests and 2,300–3,800 rows written per session, well inside Workers Free.
- **Convex I/O:** fits only with smaller record shapes.

12. **Encounter record shapes change in S1/S3** (pre-launch, with no compatibility layer; the local data is reset):
    - The Run document stops embedding the full projection (`projectionJson`). Projections are built per viewer, from per-actor records, by the room while it is live and on read outside play.
    - `encounterRunCommands` stops storing each command's GM projection (`resultJson`). A receipt stores only what replay and history need.
    - Character play state lives in small, hot per-Character documents, separate from the large Character document.
    - Command history payloads reach Convex packed once per checkpoint. Small indexed receipt
      headers remain per command and point into the checksummed ledger; they preserve replay,
      duplicate-command checks, public UUIDs and timeline pagination without repeating history payloads.
    - Tied-initiative and other occurrence updates write only the changed occurrence fields.
13. **Checkpoint interval N = 120 s,** plus every round boundary and lifecycle event. This is provisional until S9 measures usage outside live play. It fits Q16's budget only with Amendment 12.
14. **Authorization lease: 240 s (2N),** renewed by checkpoint responses and each socket's 15-minute re-authentication. This replaces "about 60 s".
    - A lost eviction is the only case the lease covers. To keep that rare, eviction delivery retries with backoff until it is acknowledged or the room releases, instead of giving up after 5 attempts.
    - The worst-case exposure after a failed eviction is therefore one lease.
15. **Previews: an immediate fix, independent of the switch.**
    - Transient preview state is memory-only; the `native_socket_transients` rows go.
    - Pointer previews are sent only during a gesture (drag, ping or measure), at most 10 Hz.
      Q19 (2026-09-28) replaced the pointer stream with a single `PING` message per long press or
      `P` key, at most one per 500 ms per socket; there are no live cursors (see live-sessions.md).
    - A preview sample never calls Convex. Authority and vision revisions come from the room's cache.
    - The former per-sample path would exceed the Workers Free request and row limits and use most of Convex's monthly function calls.
16. **The room must hibernate between messages.** No long-lived timers or outbound sockets, because they bill wall-clock duration. Alarms schedule checkpoints.

## D70: Packed history with indexed receipt headers — 2026-09-29

**Decision maker: Codex. User approval: 2026-09-29.** Codex chose and recommended this interpretation
of Amendment 12; the user approved retaining indexed receipt headers while packing history payloads.

Store immutable command history, rule receipts and replay evidence in checksummed checkpoint ledgers.
Retain small per-command operational headers containing the identity, ownership, fingerprint, version
and visibility fields required by existing indexes, plus a pointer to the ledger entry. Readers verify
the referenced payload and its identity before replay or presentation. The headers carry no duplicate
history body or full result. Existing privacy, concurrency, complete pagination and D68 replay behavior
remain required. Oversized ledger payloads use the checkpoint's bounded parts and atomic publication.

Existing command-ID collision checks and UUID-cursor timeline reads use indexed records. Removing
those records would require a separate lookup and pagination redesign; scanning Campaign history
would increase reads and weaken the free-tier budget. Small indexed headers preserve those behaviors
using Convex's existing indexes. Their I/O and storage remain part of Q16's measured workload.

Cleanup preserves the existing ownership rules. Campaign deletion removes Encounter history while
retaining personal Character receipts; account or Character deletion removes private Character
receipts while retaining shared Encounter history. Selective cleanup within a ledger tombstones only
the selected entries, preserves surviving pointer indexes and updates its checksum atomically. Its scope records
creation provenance; current Character ownership authorizes personal history after Campaign deletion.
Delete the ledger and parts only when no live headers remain. D71 below changes physical purge of
retired private Character payloads to bounded deferred steps.

**Implementation status:** native ledger schema, writers, reader adapters and cleanup are integrated
into source. The integrated storage/cleanup suite passed 54 checks; dependency builds, Convex
TypeScript, local codegen/deploy and native maximum-size/pagination/rollback/private-retirement
proofs passed. See the [2026-09-30 validation record](../validation/phase-08-2/private-receipt-retirement-2026-09-30.md).
Checkpoint publication, the complete local lifecycle and Q16 remain pending. This implementation
has not advanced acceptance; the ledger remains 51/75.

**Approved clarification — Character ledger partitioning, 2026-09-30. Decision maker: Codex;
user approval: 2026-09-30.** Pack each Character's private `characterCommandReceipts` separately
from shared Encounter receipts. Five mixed 4 MiB ledgers could make account deletion read 20 MiB of
unrelated shared history and exceed Convex's transaction read ceiling. Preserve atomic
account/Character state and reference cleanup and shared Encounter history; D71 below governs
physical private payload purge. Character-scoped ledgers may carry
`checkpointId` and epoch; shared Campaign/Encounter ledgers must not contain private Character
command payloads. Measure any additional ledger metadata against Q16; no budget pass is implied.
Stable tombstones and complete ledger verification remain required for selective cleanup within the
approved scopes. Mixed private/shared packing is not the current target.

**Implementation choice — bounded history paging, Codex, 2026-09-30.** Character history uses a
Schema-owned chronological application cursor and indexed seeks, with one complete ledger entry
hydrated per page. Native reactive pagination can inherit an end cursor and ignore requested row
and byte limits, so a one-row request alone cannot bound body reads. This prelaunch API has no
active browser consumer; it excludes native `endCursor`/`id` and requires restarting from null for
insertions before an already-consumed key. Stateless room hydration retains native cursors and
complete page metadata, checks the distinct-ledger byte budget before body reads, and refuses an
oversized window without truncation. Existing Encounter UUID timeline paging is unchanged.

## D71: Bounded deferred private payload purge — 2026-09-30

**Decision maker: Codex. User approval: 2026-09-30.** Codex recommended atomically removing
account/Character state and private receipt headers, then physically purging unreachable private
ledger payloads in bounded steps through the existing deferred-cleanup lifecycle. The user approved
that recommendation. This amends D70's physical-payload cleanup boundary.

Native evidence showed that three private 4 MiB ledgers made the real account-deletion hook exceed
its execution limit. Fixture deletion exceeded the 16 MiB transaction read limit. The failures
rolled back; separate private packing alone cannot bound deletion over a lifetime of history.

The state/reference deletion transaction also records durable purge intent. Deferred purge verifies
the Character ownership scope and that no live receipt header references the ledger, then removes
payload storage in bounded, retryable transactions. Removed account/Character history is immediately
unavailable to product readers. Shared Encounter history is retained. No retention cap is introduced.
Payload validation remains required for publication, reads and selective cleanup of retained history.

**Status:** source integrated; focused local native deletion, rollback, retry and privacy proofs
passed with three 4 MiB ledgers. See the
[2026-09-30 validation record](../validation/phase-08-2/private-receipt-retirement-2026-09-30.md).
Final integration and the complete local lifecycle remain pending. This decision does not advance
Phase 8.2 acceptance or establish a Q16 budget pass.

## D86: write-behind state flush; live views read the room — 2026-10-03

**Decided by the product owner on 2026-10-03 (VS-8).** Recorded as D86 in the
[decisions log](../handoffs/phase-08-2-decisions.md). Not yet implemented; see the
[slice plan](../handoffs/adr-0035-implementation-plan.md#write-behind-flush-slices-d86).

**Why.** The REL-5 V15 runs showed the checkpoint path costs more than the commands it persists:

- every checkpoint reads a floor of about 250 KB, growing by about one document and 251 B per
  checkpoint: the Campaign, every assignment and active membership, the room authorization rebuilt
  to renew the lease, and receipt-ledger collision and orphan checks (A35-S10a removed this floor:
  a one-actor HP flush now reads about 8.9 KB in 11 documents, the same for a 4- and a 40-member
  Campaign, and does not grow with checkpoint count; see
  [the measurement](../validation/phase-08-2/a35-s10a-flush-io-2026-10-03.md));
- token binding, removal and every socket admission force a synchronous checkpoint, so ordinary
  table actions wait on Convex;
- pages outside the table that show room-owned state read Convex, which lags by up to 120 s;
- edits made outside the room reach the table only at its next command;
- the Encounter timeline and command history are persisted to Convex although D85 decided they need
  not outlive the Run.

**Principle.** Commands never call Convex; the room persists the state those commands changed,
coalesced and flushed on an interval and at key moments. A committed change is state that would be
lost if the room's storage were lost. Previews, pings and cursors never count. No changed state
means no flush and no Convex call.

17. **Flush cadence replaces Amendments 4 and 13.**
    - The room flushes only its dirty set, coalesced per record, no later than N after the first
      unflushed change. N is one tunable constant between 30 s and 120 s, which REL-5 sets from
      the V15 measurements. Live viewers read the room (Amendment 19), so N bounds only the
      storage-loss window and what non-live readers see.
    - A due flush is sent while the room handles its next incoming message. An alarm fires only
      when the room goes quiet, which keeps alarm-billed Durable Object requests down.
    - Synchronous key moments are the ones that change Convex-owned holds: START, COMPLETE, DELETE,
      adding or removing a Character actor (D74), and the departure reconcile (D81).
    - Drain and idle release still flush before they finish, so Convex is current once a table
      closes.
    - Round boundaries, token binding and removal, and socket admission no longer force a
      checkpoint. Their state rides the next interval flush. The token-binding view that read Convex
      reads the room, or is deleted if nothing reads it.
    - Durability is unchanged: an acknowledged command is in the room's SQLite before the
      acknowledgement.
18. **Flush cost scales with the delta, not the Campaign.**
    - A flush reads only the records in its delta, for the checksum fence, plus the authority row
      for the epoch and sequence fence. It never reads every assignment or membership.
    - Controller-list filtering reads only the Characters in the delta.
    - Lease renewal (Amendment 14) leaves the checkpoint. The room renews its authorization
      separately, at most once per half-lease (120 s) and only while sockets are connected.
      Invalidation notices and eviction retries are unchanged.
    - Each flush records its Convex bytes read and written per section (D85), so any remaining floor
      is measured, not modelled.
19. **While a table is running, every view of room-owned state reads the room. This extends
    Decision 7.**
    - The Character Sheet keeps its room path (A35-S7a) from any window. It is not limited to the
      table's window.
    - Pages outside the table that show room-owned state switch to the room for any viewer
      authorized to see the page while the Campaign's table is running. Room-owned state means
      HP, conditions, resources and slots, round and turn, and token positions.
    - They subscribe to one room feed, the live Campaign summary, not to per-page feeds. The feed
      applies exactly the visibility the viewer already has on that page and never widens it: Party
      can view, roster basics, health display levels (ADR 0034), hidden actors and GM-only map
      state, private rolls (D62, Q14), and D87's hidden-until-revealed Campaign content.
    - They return to Convex when the table ends. The switch uses the same "is a table running"
      check as the Sheet. It does not track whether the viewer has the table open.
    - Each window holds its own room connection, subscribed only to what it shows. A Sheet or
      summary window receives no map, Encounter or chat.
    - Convex's copy is read live only when no table is running. It is current then, because the
      table flushes before it closes.
20. **Sheet edits show at once.** The Sheet shows a play edit immediately and sends it to the room.
    - The room applies the edit and confirms it.
    - On a refusal (no slot left, lost permission or a conflicting edit), the Sheet reverts the
      edit and shows the reason.
    - A pending Encounter decision never blocks Sheet play edits. Pending decisions block only
      Encounter actions, turn commands and undo.
    - Rests stay refused while held.
21. **Edits made outside the room stream into the room.** Builder and GM content edits, such as a
    new weapon Feature during a map session without an Encounter, keep the `INVALIDATE_INPUTS`
    notification.
    - While table sockets are connected, the room reloads the affected inputs when the notice
      arrives, coalesced per notice, and pushes the changed projection. It no longer waits for the
      next command.
    - With no sockets connected, the room reloads lazily, as today.
22. **Encounter history stays in the room (D85; amends Decision 3 contents, Amendments 7 and 12, and
    D70 for Encounter-scoped history).**
    - The Encounter timeline, command log and rule receipts live in the room's SQLite and are
      discarded when the Run ends.
    - Checkpoints stop writing Encounter history ledgers and parts, and stop writing per-command
      headers whose only reader is the timeline.
    - Chat messages and roll cards persist by the regular flush, not at room close, with stable IDs
      (D69).
    - Cross-epoch replay (D68) keeps a compact Run-scoped replay index: command ID, actor,
      fingerprint, resulting version, and the roll card ID where one exists. The index is deleted
      when the Run ends. A retry across an epoch returns "applied at version V" plus the current
      projection; any roll result comes from its persisted roll card.
    - Character-scoped receipts produced by Encounter commands are dropped, following Foundry. The
      D70 Character history API has no browser consumer.
23. **Proactive re-authentication.** The room challenges each socket shortly before its admission
    expires, at expiry minus 60 s. The client answers with a refreshed token from its refresh cycle.
    A passive socket is never dropped silently, and nobody signs in again.

**Consequences.**

- **Convex writes scale with changed state, not with command count.** An idle or preview-only
  table makes no Convex calls.
- **Live viewers never see lag.** Everyone viewing a running table's Campaign sees the room's state:
  the table, Sheets in any window, and summary pages.
- **Flushes stay infrequent.** N bounds only the storage-loss window and what non-live readers
  see, so flushes come at most once per N.
- **One connection per open window.** The extra cost is one admission, answered from the room's
  cache with no checkpoint (Amendment 17), plus a hibernated socket.
- **Loss window.** Losing the room's storage loses at most N of changes, about one round, which
  D85 accepts.
- **Retired:**
  - flushes forced by binding, admission and round change;
  - lease renewal by checkpoint;
  - Encounter history ledgers in Convex;
  - the timeline-pagination use of receipt headers.

**Unchanged:**

- room authority, durability before acknowledgement, fencing and epochs;
- rules and dice in the room (D41);
- the privacy projection;
- `INVALIDATE_INPUTS` and eviction;
- chat and roll persistence (D69);
- player control and GM override (ADR 0034).

## Also decided with this ADR

- **Development and tests use the local backend only (Q15 option c).** Development, automated tests, load checks and agents run against the local Docker backend. Cloud deployments are touched only for a deliberate, approved staging smoke check.
- **Read budgets in the gates (Q15 option d).** See Decision 9.
