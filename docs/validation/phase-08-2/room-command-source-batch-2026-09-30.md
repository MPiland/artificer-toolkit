# Phase 8.2 room command source batch — 2026-09-30

**Owner:** Codex. **Status:** source integration; execution proof pending.

The user directed Codex to advance known implementation before further long verification runs.
This record describes source changes and source inspection only. It is not a release manifest,
an execution result, or acceptance evidence. The ledger remains **51/75 cases and 190/276 criteria
accepted**, with the frozen scope unchanged. The [Claude handoff](../../handoffs/phase-08-2-claude-source-first.md)
records active implementation and pending approval boundaries.

## Current source

Character Builder reloads preserve native play and active effects, reconcile hit dice and resource
usage, and clamp current HP only when changed Builder inputs produce a Character-only maximum below
the prior native play maximum. Reconciliation and
the command commit use one SQLite transaction. `roomEncounterMechanics` uses the existing rules
planner and typed play writer over current native Character/Creature state. Native START/ADVANCE
and stored turn-owned resolution now supply that callback within the shared SQLite transaction,
using the existing planner and shared pending/terminal writers. Native basic actions bind their
existing planner to `basicActionPersistence` with the same read fence and platform-definition gate.

Held Character Sheet backend/room source is now wired. The schema owns nineteen typed play commands
and a `CHARACTER_SHEET` envelope with Character/Run IDs; maximum overrides, rests, notes, structure
and customizations remain outside it. The room uses canonical reducer/resource helpers and real
active-effect projection, typed play writes, shared private Character receipt callbacks and an
atomic journal commit before acknowledgement. Current owner/GM/assignment and active unfrozen Run
guards precede replay/version refusal. Socket replay also checks the checksummed ACTIVE native Run,
unfrozen Character actor and current Campaign/System/play ownership, then uses current stream/maturity.
Only the initiator receives private history; other members advance the same sequence with required
`delta: null`. Pending Sheet commands settle only with their own CHARACTER_SHEET delta. Party visibility
applies locally, restores from unpublished SQLite play and composes current vision before commit.
The browser client advances Encounter/Sheet room sequences without interpreting them as Scene deltas.

Sheet journal replay now uses shared `readCharacterCommandReplay` over the actual indexed native
Character receipt after current Run/actor/Campaign/System/owner admission. Raw history checksum,
receipt identity and command fingerprint are checked, and journal/private event IDs must match.
Current maturity and native stream present that raw history; already redacted journal text is no
longer the replay source. This preserves original evidence for current privacy presentation and
remains unvalidated source.

`liveCharacterHolds` records Character/active Run pairs with Campaign/epoch fences. Claim/recovery
creates holds, changed Run/actor checkpoints reconcile them and final acknowledged release removes
them. Held direct play/preferences/rest writes reject; outside structural writes preserve the entire
checkpoint play row/clock/stats, and Builder commit returns actual persisted play/version. Campaign
deletion includes holds. Frontend Sheet dispatch remains Convex; live routing/views and
membership/controller/account-deletion hold integration remain unfinished. Lifecycle correctness and
the new schema require guarded local reset/seed/codegen and execution proof. No generated check or
S7/S8 acceptance is claimed.

Focused `sheetSlices.liveAuthority` source now reads Character head, matching holds and typed play
for owner/GM routing metadata; party readers receive null, with no mechanics/collection hydration.
Native Encounter/Sheet client receipts advance room sequence without becoming Scene deltas; old
same-sequence ACKs settle only. Direct `encounters/commands.execute` now fences all command types
under live authority, while separate epoch-fenced transitional `liveSessions` endpoints remain.
Optional authority `checkpointedAt` now records actual acknowledged delta-checkpoint or retained
per-command publication, while exact retry/drain preserve it. Activation/new recovery omits it;
routing metadata returns null before the epoch's first acknowledgement. This precise freshness
provenance is source-only; the web freshness UI remains open. No gate or acceptance change follows.

Ordinary action pending/terminal writes and evidence responses, Concentration responses and Cleaving
responses now have native production dispatch in source. Retained occurrence/receipt evidence
classifies the response owner; its selected planner then repeats canonical identity, epoch, role,
currentness and replay admission. GM voids retain the existing cancellation/refusal classifier;
TURN/CLEAVING declines use their implemented response writers. The command transaction includes
state, Character play, effects, paired rules chat, private rolls and receipts before its SQLite
journal commit. Current member projection and the final lease-revision fence remain in that path.
Disarm production dispatch now uses its existing planner, shared pending/terminal settlement and
canonical `DISARM` capture admission; retained ownership also routes its responses. This is source
integration with runtime proof pending.

Corrupt/lost storage requests an idempotent replacement epoch through the Worker-protected recovery
route. The room invalidates admissions, joins existing commands/publication, and atomically replaces
its damaged snapshot while discarding abandoned journal and checkpoint data. An unsuccessful
recovery preserves old rows. New-epoch activation hydrates acknowledged product state from Convex.
The final Scene/local Encounter durable callback rechecks socket generation and current member
authorization and matching lease revisions before it writes the journal receipt. Replay uses the
canonical current-member presenter for player projections and occurrences.

Existing Convex turn handlers now use shared turn admission, pending and terminal persistence,
initiative settlement/completion, effect/resource writes and turn capture. Concentration binding,
child persistence, exact cleanup and maintenance-owner reconciliation are shared as well. Backend
adapters retain their actual authorization/revision, Character, Scene, definition and communication
implementations. Dependent-effect pagination remains native to the host; Convex cursor behavior is
preserved instead of extending the room document-store interface speculatively.
Ordinary action admission, evidence receipts, pending/terminal, effect/child persistence and
Concentration/Cleaving responses now use the same dependency substitutions. Convex binds real
owning callbacks; logical receipt inserts still enter its packed ledger adapter atomically.

`SCENE_DEFINITION` hydration retains immutable header/entities with exact source/version pins,
counts and row checksums. Native geometry reads reuse the canonical shared current-entity algorithm
over that retained base and current overrides. Complete paged `DEFINITIONS` now includes System
PLATFORM and Campaign-owner USER roots, including unpublished roots. Identical SYSTEM/CAMPAIGN
revisions fence the pages; PLAY does not invalidate that inventory. Canonical per-root records plus
a complete marker survive SQLite eviction. Present and missing first-use IDs resolve without a
backend call; stale inventories replace roots and marker atomically, removing deleted/private roots.
Platform basic actions retain their original source gate independently of Campaign catalogue membership.

Canonical usernames now join authorization preferences and their digest. A BetterAuth user-update
trigger schedules PREFERENCES invalidation when the canonical name changes; warm commands use the
leased author name without a per-command authentication read.

Movement admission, Scene geometry reads, pending/terminal spatial publication, movement resolution
documents/reads/publication, spatial/reaction/Concentration persistence, target-state reads and
movement settlement have shared modules with exact-signature API adapters. Native geometry dispatch
now lands in source: planned moves/doors and MOVEMENT responses enter `#commitRoomGeometry`, call
`executeRoomSceneGeometry` inside the real `RoomEncounterStore.transact`, and commit the journal
receipt/chain in its durable callback before fanout. This branch has no `#commitExternal` or
per-command Scene commit route. Movement-response replay now uses the native replay path, and
`roomSceneVision` is authored and wired before geometry, native Encounter and binding journal
commits. Native binding now uses `executeRoomSceneBinding`/shared `sceneBindingPersistence` in SQLite,
with controls and composition joined before acknowledgement and no external binding commit.
Shared `sceneUndoPublication` now binds through `publishRoomSceneUndo` for planned/fog/settled moves.
The room admits GM undo and commits persisted token/fog/state, current Character vision and journal
receipt in one transaction before acknowledgement/fanout. It restores/deletes complete previous fog
layers and verifies restored chunks through shared `parseSceneReferencedFogChunk`; raw/composed cache
and recipient fog sync follow commit. The asynchronous fast Scene writer delegates undo to this same
helper with its supplied parent save/command/checksum guards. `roomSceneRecords` extraction is finished.
Retained-history target selection scans O(N) Scene rows, with sorting and unmatched-move lookup;
the `ponytail` ceiling awaits frozen workload measurements, with no V15/Q16 claim. Old fast-only undo
journal/planner and external recovery/comparator code remain for retirement. No execution or
acceptance evidence is added by this source inspection.

Chat headers now carry kind and strict roll nonce fingerprints derived by the central paired writer;
ordinary CHAT/ROLL retry semantics are preserved. Paged `CHAT_METADATA` hydration loads access/nonce
records without old bodies, validates Campaign/identity/reference boundaries, and retains them in
SQLite. Shared conversation and rules-message persistence serve Convex and native transactions.
Typed checkpoint deltas include the four conversation families, with atomic pair and scope checks.
Shared `tableRollPersistence` and `conversationPresentation` now preserve the API algorithms.
General native chat/public/TABLE/evidence-roll routing remains unfinished pending the live rate-scope
decision. The local lifecycle resets backed-up
fixtures before codegen's schema push, rather than after deployment; required header fields reject
old fixture rows. No reset or backend action was performed in this source batch.

Shared Concentration logging now stages paired TABLE entries or native private roll records in the
owning transaction. Checkpoint appends merge hidden checks into the owner's global twenty-roll
history with immutable evidence checks and no cross-Campaign identity replacement. General chat
and other public roll routing remain unfinished.

## Source inspection

Subagent extraction comparisons reverse the explicit store/callback substitutions and compare
the resulting function bodies with their saved originals. Formatting and scoped whitespace checks
are retained under the following ignored directories:

- `local-validation/shared-turn-settlement/`
- `local-validation/shared-turn-effects/`
- `local-validation/shared-turn-resources/`
- `local-validation/shared-turn-admission/`
- `local-validation/shared-turn-pending/`
- `local-validation/shared-turn-commit/`
- `local-validation/shared-turn-capture/`
- `local-validation/shared-concentration-children/`
- `local-validation/shared-concentration-cleanup/`
- `local-validation/shared-cleaving-response/`
- `local-validation/shared-action-persistence/`
- `local-validation/current-source-docs-action-batch/`
- `local-validation/room-command-implementation/`
- `local-validation/chat-nonce-headers/`
- `local-validation/chat-shared-persistence/`
- `local-validation/chat-checkpoints/`
- `local-validation/concentration-roll-persistence/`
- `local-validation/basic-action-persistence/`
- `local-validation/scene-definition-inputs/`
- `local-validation/scene-definition-worker-fixtures/`
- `local-validation/shared-live-movement-admission/`
- `local-validation/shared-spatial-scene-geometry/`
- `local-validation/shared-live-movement-persistence/`
- `local-validation/shared-live-movement-concentration/`
- `local-validation/shared-movement-settlement/`
- `local-validation/shared-movement-response/`
- `local-validation/shared-spatial-pending-publication/`
- `local-validation/shared-spatial-terminal-publication/`
- `local-validation/shared-table-roll-persistence/`
- `local-validation/shared-conversation-presentation/`
- `local-validation/room-definition-inputs/`
- `local-validation/room-definitions-inventory/`
- `local-validation/room-definition-response-fixtures/`
- `local-validation/shared-scene-binding/`
- `local-validation/shared-scene-undo/`
- `local-validation/native-character-sheet-core/`

Runnable checks were authored for Character reload/reconciliation, native mechanics,
storage recovery and admission expiry. Their source/format inspection is retained under
`character-reload-reconciliation/`, `character-builder-reload/`, `room-encounter-mechanics/`,
`room-storage-recovery/`, `native-storage-recovery/` and `room-command-admission/` beneath
`local-validation/`. No compiler, build, test, codegen, Wrangler or backend runtime gate was run
for this source batch. Earlier passing runs apply to earlier source states.

Source checks were also authored for nonce-field equivalence, metadata paging/hydration, native
rules-message rollback/SQLite recovery/checkpoint folding and paired chat checkpoint publication.
These checks have not been executed.

Native D27 SQLite commit and late-receipt rollback checks are authored without execution. Four old
Scene/binding regressions are adapted and root-reviewed as plausible source; three exact D26/D52
pending movement cases remain unaltered until real native occurrence/pending snapshot/geometry
captures are supplied. Five hold/query regressions, checkpoint-fence freshness and direct nested
UPDATE_ACTOR live-authority fence checks exist in source. Client checks cover contiguous native
Encounter sequence, same-sequence replay, gap RESUME and private Sheet null ACK/wrong-scope waiting.
All source ownership is released, with no execution result for any of these current checks.

Full native Sheet socket proof still needs retained Class/Race/Background/equipment snapshots and
pins, System inputs, an unfrozen Character Run actor, assignment/revisions and input routes. The
current native fixture only supplies Creature inputs and nearby Character preparation is mocked;
no fabricated successful fixture was added. Lifecycle source still freezes/removes Convex actors
and rewrites controllers during Character/account departure, while room EVICT_USER only closes
sockets/updates admission and cache. Checkpoint actor validation does not filter controllers. Native
eviction/notification/freeze/delete and checkpoint filtering must land together before held lifecycle
correctness can be proved. The [handoff](../../handoffs/phase-08-2-claude-source-first.md) identifies
the exact owning files; partial skipped writes without a room consumer are not a complete fix.

## Remaining integration

The equipped/attuned trace is resolved in source. Canonical `characterSourceLoss.removeEquipment`
already removes vanished inventory IDs from both lists; held structural writes intentionally
preserve native play. `prepareRoomLiveCharacterSheet` now filters current equipped/attuned lists
against prepared inventory IDs alongside HP/hit dice/usage in the same native transaction. Valid
IDs retain order and the play clock advances only on changed state. Existing real SQLite
commit/rollback/eviction/warm source checks include retained/removed equipment; preparation stays
mocked, so these are not full integration proof. The new pure shared
[Character receipt test](../../../packages/encounter-persistence/src/__tests__/characterSheetReceipts.test.ts)
covers original raw STANDARD-to-MATURE replay/current native stream and checksum/fingerprint refusals.
No check was executed and no architectural decision or acceptance status changed.

Movement/bound fog/vision/binding/undo integrated proof and legacy fixture/retirement work, general
chat/public/TABLE/evidence rolls, held Sheet frontend routing/views, rests and hold lifecycle,
deletion/membership eviction, S8 web/live-view freshness/recovery cleanup, focused HP/Common Sheet reads and
packed Scene history remain open. The current
native turn/basic-action/action/Concentration/Cleaving/Disarm source has no integrated runtime gate yet.
Complete definition hydration replaces the retired cold per-ID fetch path. The note-write
aggregate-checksum proposal remains unapproved; automatic review rejected aggregate-check removal,
the partial change was restored, and the narrow writer remains frozen. The separate live rate-scope
proposal is also unapproved and has not changed the current global counters.
S5 parity, Q16/V15 measurements and the final-source local lifecycle remain required after source
integration. Build the shared packages before runtime consumers resolve the newly added subpaths.
Each managed staging attempt, production promotion and external retirement still has its own
approval gate.
