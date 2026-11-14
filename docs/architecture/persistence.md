# Persistence and Convex

> Status: canonical current persistence guide. Target and decision-record material is labeled.
>
> Scope: Convex documents, indexed ownership, authenticated authority, transactions, the room checkpoint path, receipt ledgers, durable cleanup and content snapshot bookkeeping
>
> Update when: `apps/apis/convex/schema.ts` or a table module, Session authority or checkpoint semantics, authorization, transaction boundaries, cleanup jobs or crons, or content snapshot storage changes
>
> Verification: `apps/apis/convex/schema.ts` and the `schema` modules beside it, `apps/apis/convex/lib/identity.ts`, `apps/apis/convex/liveSessions/`, `apps/apis/convex/contentSnapshots/`, `apps/apis/convex/crons.ts`, `packages/encounter-persistence` and the validators under `packages/schema`

Convex is the durable cross-session product store. Public handlers derive the application user UUID from the
current Better Auth identity through `userProfiles.by_authUserId`; callers cannot choose another user.
Domain authorization then reads indexed ownership and membership documents. Validators protect every public
and persisted boundary, and each mutation enforces relationships, cleanup order, optimistic versions,
checksums and replay behavior. Convex has no foreign keys or cascades, so a mutation either commits a
complete valid result or leaves prior state unchanged. Work that cannot fit one transaction uses a durable,
fenced, resumable job (see [Durable jobs and crons](#durable-jobs-and-crons)).

`userProfiles.userId` is the public application identity; Better Auth component IDs stay private.
`campaigns.ownerUserId` and `campaignMemberships` are the Campaign authority records. A downstream document
never widens access merely because it contains a public UUID. The Session Durable Object room owns live play
state while it holds authority; live room, authority and replay semantics are in
[live sessions](live-sessions.md), and rules execution in [rules runtime](rules-runtime.md).

```mermaid
erDiagram
  BETTER_AUTH_USER ||--|| USER_PROFILE : maps_by_authUserId
  USER_PROFILE ||--o{ CAMPAIGN : owns_by_ownerUserId
  USER_PROFILE ||--o{ CAMPAIGN_MEMBERSHIP : joins_by_userId
  CAMPAIGN ||--o{ CAMPAIGN_MEMBERSHIP : contains_by_campaignId
  CAMPAIGN ||--o{ CHARACTER_ASSIGNMENT : admits
  USER_PROFILE ||--o{ CHARACTER_ASSIGNMENT : controls
```

## Live room and checkpoints

While a Campaign has a live authority epoch, the room commits every live command in its own SQLite
journal. Convex receives fenced checkpoints. The per-command Convex Encounter and Scene write path is
deleted ([ADR 0035](../adr/0035-room-authoritative-live-encounters.md), [ADR 0033](../adr/0033-campaign-owned-play-and-session-log.md)).
No Convex function executes an Encounter command, including outside a live session, so the room is the
only writer of command receipts (`apps/apis/convex/encounters/commandBoundary.test.ts` guards this).

**Authority.** `campaignLiveAuthorities` holds one row per Campaign: the phase (`ACTIVATING`, `DO_ACTIVE`,
`DRAINING`), `persistedSequence`, `persistedStateChecksum`, `lastCheckpoint`, `checkpointedAt` and, while
draining, `finalSequence` and `finalStateChecksum`. `liveCharacterHolds` pins a Character to its active Run
and room epoch (D81); direct Convex play, preference and rest writers reject a held Character, and the
central Character writer preserves the held play row across structural edits. Holds are reconciled when a
checkpoint changes Runs or actors and are deleted at final authority release.

**Checkpoint request.** A checkpoint reaches Convex in one request, whatever its size: Convex accepts
function arguments up to 16 MiB, and nothing is staged (ADR 0035 Amendment 31). `checkpoint.ts` validates
the payload against `LIVE_SESSION_CHECKPOINT_MAX_BYTES` (1 MiB) and its checksum.

**Checkpoint size (REL-5).** Convex validates and applies one checkpoint in one mutation under its 1 s
user-code limit, and that work grows with the payload. Geometry saves once cost the most per byte, because
the commit re-read their retained movement evidence: about 720 KB of them timed out locally. Movement
evidence now stays in the room, and the commit reads each record once before it writes (ADR 0035
Amendments 26 and 27). The room folds commands into one checkpoint up to the 1 MiB bound
(`roomCheckpoints.ts`). Commands that approach it alone are fog-heavy: a
fog layer has one cell per map pixel, up to 512 on the long side, so a full layer is 256 chunks and a
per-player vision move rewrites one layer and save per player (about 110 KB each). The room refuses a
command whose write set exceeds three quarters of the bound (`RoomWriteSetTooLargeError`), which leaves
room for record keys and checksums. Journal reads for a checkpoint use separate 4 MiB pages
(`LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES`), because write sets hold whole documents that fold into
much smaller deltas (about 16:1 in REL-5 combat, about 35 KB of write set per command). The room
streams consecutive pages into one fold, so a page bounds memory for one read, never a checkpoint: a
checkpoint is the longest prefix whose folded records fit 1 MiB, so a save folds the whole unsaved
journal in one checkpoint wherever the folded records fit, and rows a Run creates and drops within it
never reach Convex (ADR 0035 Amendments 29 and 31). The room builds a checkpoint synchronously, so
`buildRoomCheckpointRecords` validates and decodes only the base rows a page touches: the base is the
store's acknowledged snapshot, validated at hydration or replay and checksummed at rest, and it grows
with the Run's retained history. Revalidating all of it per page took about as long as the page itself
and stalled previews in REL-5.

**When the room saves (ADR 0035 Amendment 25).** No timer saves it. The room checkpoints at save points
(a Run's START and COMPLETE, removing a Character actor, a Scene presentation, a departure reconcile that
removes Characters, admission, drain and close; see [live-sessions.md](live-sessions.md), "Timing") and at
a backlog bound: when the unsaved log holds as many chat entries and roll cards as the chat push window
(`LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT`, 200). `RoomEncounterStore.unsavedChatEntries` keeps that as a
running count, so the check costs no storage read. The bound exists so Convex chat paging never has a
gap. There is no bytes bound: a checkpoint splits into pages, so one save never exceeds a page however
large the backlog, and a raw sum of write sets overcounts the coalesced state a checkpoint carries
(about 5:1 in REL-5 combat), which fired about every 8 combat commands and recreated an interval.

**Trigger and metrics (D85).** The transport request (`liveSessionCheckpointRequestSchema`) carries a required
`reason` naming what triggered the send. It is measurement only: Convex discards it before the fence,
and the room's retained retry input
never stores it. The response carries `io`, the mutation's own `ctx.meta.getTransactionMetrics()`
(bytes and documents read and written), split by section with `liveSessions/checkpointIo.ts`
(`fence`, `records`, `scopes`, `holds`, `scenes`, `history`, `privateRolls`, `remainder`). See [live-sessions.md](live-sessions.md#checkpoint-triggers-and-the-room-meter-d85).

**Fence.** `commitCampaignLiveCheckpoint` (`liveSessions/authority.ts`) requires a non-empty sequence range and
a non-`ACTIVATING` authority, answers an exact repeat of `lastCheckpoint` as `REPLAYED`, and otherwise requires
`fromSequence` and `fromChecksum` to continue the persisted sequence and checksum. A `DRAINING` epoch cannot
pass `finalSequence`. It applies the records and patches the authority row in the same mutation.

**Records** (`liveSessions/checkpointRecords.ts`, `checkpointScenes.ts`, `checkpointPrivateRolls.ts`):

- Mutable `changes` are JSON deltas with previous and next checksums, keyed by a complete existing index
  (`liveSessionCheckpointKeyFields`; a checkpoint never scans a table). Tables: the `encounter*` Run, actor,
  projection-fact, binding, initiative, occurrence, pending-snapshot, movement and skip tables,
  `characterActiveRuleEffects`, `encounterActiveRuleEffects`, `encounterMaintainedEffectStates`,
  `encounterSpatialRuleEffects`, `characterPlayStates`, and the four `campaignConversation*` tables.
  Ownership fields are immutable, `characterPlayStates.streamVersion` must advance, conversation history cannot
  be deleted, a Campaign has at most one ACTIVE Run, and a departed controller is rejected (D74).
  Validation reads only what the delta names (Amendment 18): the Campaign once and lazily, an assignment
  per Character and an active membership per controller by point read, and each Run it touches. It
  never loads `characters` (assignment fixes owner and System), validates the written rows in memory, and
  reconciles holds only when a Run status or a Character actor's frozen state changes. A new ACTIVE Run
  is checked for a second one. The response's `adopted` returns the PLAY and delta-Character revisions
  the write bumped when the room held them before it, and no authorization is read.
- Append-only `history` entries are only Sheet `characterCommandReceipts`, packed into one `CHARACTER`
  `receiptLedgers` row per Character per checkpoint. Encounter history never reaches Convex by checkpoint
  (ADR 0035 Amendment 22, D88; see [Encounter Run storage](#encounter-run-storage)); the contract rejects it.
- `encounterReplayIndex` rows are insert-only `changes`, one per room Encounter command. A checkpoint that
  completes a Run deletes that Run's index rows, any Convex-held Encounter history and every other Run
  child row a finished Run no longer reads (`encounters/campaignDeletion.ts` `removeFinishedRunRows`;
  ADR 0035 Amendment 30). A Run that completes in the same
  page as its commands writes no index rows at all: `buildRoomCheckpointRecords` folds an insert and its
  later delete in one page to no change. A save before COMPLETE (a backlog, Scene presentation or
  departure save) still inserts the rows, and COMPLETE then deletes them. The same checkpoint carries the
  completed Run's Character grants onto the Campaign clock (`encounters/runGrantCarryOver.ts`, D99): it
  rewrites their lifecycles after the room released the Characters and leaves those Characters out of the
  revisions the room may adopt, so the room reloads them instead of adopting a revision it did not write.
- Scene rows (`sceneLiveStates`, `sceneLiveEntities`, `sceneFogLayers`, `sceneFogSaves`, `sceneFogChunks`)
  are written only by the checkpoint, plus Scene definition, presentation and deletion flows. Scene command
  receipts and geometry saves are not Convex rows: the room keeps them (below).
- **No post-write re-reads (ADR 0035 Amendment 27).** `checkpointScenes.ts` and `checkpointRecords.ts` read
  each record once before they write it, for the checksum fence (Amendment 18) and append-only checks, and
  never read it back afterwards. Invariants that used to run on the stored row run on the incoming `next`
  value before the write: ordinal uniqueness is checked on the final state (a claim set within the batch plus a
  holder check that ignores rows the batch rewrites), and fog saves and chunks written in the same checkpoint
  are validated from the batch, with only earlier-checkpoint rows read from the database.
- `retainedRolls` merge into the owner's `userRollHistory`, and into a Campaign member's own history for
  a hidden creature that member controls (ATTACK-17.5); the member's copy has `gmCampaignRoll: null`.

**Receipt ledgers** (D70, D71; `lib/receiptLedgers.ts`, `lib/receiptLedgerSchema.ts`,
`packages/schema/src/projections/receiptLedgerPersistence.ts`). Immutable history payloads are packed once
per checkpoint; small indexed per-command headers keep the command-ID collision checks, public UUID cursors
and replay, and point into the ledger as `{ledgerId, entryIndex, entryChecksum}`. `receiptLedgers` holds the
metadata (scope `CAMPAIGN` or `CHARACTER`; `scopeId`; `epoch` and `checkpointId`, both null or both
set; `createdAt`; `entryCount`; `byteLength`; `checksum`; `partCount`) and an inline `payload` or, above the
inline size, `receiptLedgerParts`. A ledger is at most 4 MiB, 16,000 entries and 18 parts. Cleanup tombstones
selected entries without renumbering and deletes the body when the last header goes. Each Character's private
receipts are packed separately from shared Campaign and Encounter receipts, so account cleanup never reads
shared history. On account deletion the Character state and private receipt headers are deleted with a durable
`characterReceiptPurgeJobs` row, and unreachable private payloads are purged in bounded retryable mutations
(D71). Receipt pages validate summed distinct-ledger bytes against the 4 MiB read budget before hydrating.

**Scene command evidence (ADR 0035 Amendment 26).** Scene command receipts and geometry saves live only in
the room's SQLite, as opaque `SCENE_EVIDENCE_ROW` records (`sceneLiveCommands`, `sceneGeometrySaves`,
`sceneConcealmentPrunes`, the observers a bound token move dropped from concealments, keyed by Scene and move command so the GM's
undo of that move restores them) stamped
with their write time in `revision`. They survive reloads, release and new epochs: `RoomInputs.hydrate` carries
them across like the held Encounter history, across every Scene. Undo and replay by command ID read only this
copy. The room enforces the 30 day retention (`SCENE_COMMAND_RETENTION_MS`) without an alarm: a hydrate drops
evidence older than the cutoff, so the purge happens at the next load. `buildRoomCheckpointRecords` ignores the
kind, so no checkpoint, journal delta or Convex row carries it, and it is never a chat entry, so it never counts toward the backlog bound. A fog save keeps
`geometrySaveId` as an opaque back-reference to a save the room may have dropped; Convex never resolves it.
A geometry command an Encounter action wrote (a push or pull, D139) names that action in `actionOrigin`
(`{encounterId, commandId}`; `null` for a user's move, the parse default for older records). It is the one
record of the move: the action's `RESOLVE_ACTION` receipt keeps only references (`forcedMovements`:
`{sceneId, sceneCommandId}[]`, default `[]`), the GM's `UNDO_LAST_SCENE_MOVE` refuses a latest move whose
origin is an action, and the action's `REVERT_LAST_ACTION` undoes each referenced move through
`publishSceneUndo`, refused (`REVERT_UNAVAILABLE`) once the token has moved since.
A creature an action conjures (D187b, SUMMON) is a Scene token created in the cast's own room transaction, so the
Scene rows and the Encounter commit or roll back together (Option A). `persistRoomSceneTokenCreate` writes it
directly, the sibling of the forced-movement write and not the staged geometry publication: a token without
vision derives no fog, so the direct write needs no staged preparation, and it carries the same `actionOrigin`.
The cast's `RESOLVE_ACTION` receipt keeps `summonedTokens` (`{sceneId, sceneCommandId, tokenId, actorId}[]`,
default `[]`) and the Encounter binds the token to the actor in `encounterActorTokenBindings`. Current
(SPELLS-4.T2v2a2c1): the area planner builds the owned actor with the token (`buildEncounterSummon`), the persister
inserts the actor (`insertRunActor`) and appends its id to the Run's `actorIds` before the Scene write, and the
receipt carries the actor id. Current (SPELLS-4.T2v2a2c2): `removeConjuredActors` (encounter-persistence) is the one
removal: it asks the room's `removeSummonTokens` port to take each Scene token off (`persistRoomSceneTokenRemove`, a
direct tombstone write that names the ending command as its `actionOrigin`), then deletes the binding and the actor
row. `REVERT_LAST_ACTION` of a summoning cast calls it for the receipt's `summonedTokens` and drops the ids from the
Run's `actorIds` through the state it returns, replacing the old refusal. Current (SPELLS-4.T2v2a2c3): the cast leaves a carrier effect on the caster (the
summon's duration, and its Concentration through the cast's maintained state), named by the actor's `owner.sourceEffectId`;
the area root's `sourceGrantTransition` receipts it, as it does a zone's placer grant, and a revert deletes it with the
actor. Every other end (expiry, Concentration, recast, dispel) reaches `endOrphanedConjuredActors`, one stateless sweep
the room runs after a command's other writes: it reads only actors that name a `sourceEffectId`, looks each carrier
up directly on its caster, and removes the actors whose carrier is gone through `removeConjuredActors`, in the same
transaction, recording the removed ids as one system `SUMMONS_ENDED` Run command. The sweep runs after Encounter
commands and standalone Sheet commands; a path it does not reach (voluntary movement, an actor departure) leaves the
creature for the next command's sweep.
Current (SPELLS-35.T3b, D200): a creature with its own initiative (`OWN_INITIATIVE`) holds a place in the round, so
`removeConjuredActors` also removes its participant rows through `removeActorInitiative` and returns the round's new
initiative state (null when no removed creature took initiative turns). `SUMMONS_ENDED` and `REVERT_LAST_ACTION` record it as
the nullable `initiativeStateJson` and `initiativeStateChecksum` pair, which `commandTimelineMetadata` validates on insert and
read (both or neither, the checksum, the Encounter id, and no removed creature left in a `SUMMONS_ENDED` receipt). The one
creature `removeConjuredActors` refuses is the current actor, which has no valid cursor to leave behind: the sweep leaves it
standing, returns `{ ended, currentActorOrphaned }`, and the room (`advanceRoomPastEndedSummon`) runs a system `ADVANCE_TURN`
as the campaign owner, keyed by `summonEndAdvanceCommandId(originating command, Run version)`, which ends that turn and lets
the next sweep remove the creature. Between the two commits the Run is valid and a GM `ADVANCE_TURN` recovers it; a repeat
stops on a pending decision, a Run that is not active, no creature left to end, or after one pass per actor. Standalone
Sheet commands ignore the flag, so a current orphan there waits for the next Encounter command. Undoing the end means
undoing the cast; `SUMMONS_ENDED` has no revert of its own.
A drag (D105) writes the mover's and each dragged token's live row at the move's version; publication refuses it
unless every dragged token still stands at its recorded `from` and moves by the mover's displacement.
`publishSceneUndo` restores the mover and every token in the preparation's `draggedTokens`, refusing when any of
them has moved since.

## Encounter persistence package

`packages/encounter-persistence` holds the Encounter code that reads and writes Run state, so Convex and the
room run the same code. It depends on `packages/schema`, `packages/shared` and `packages/rules-runtime` and
only takes the `IndexRange` type from `convex`. Its README documents the store surface. Convex binds it
through `lib/convexEncounterStore.ts`, `encounters/encounterReadPorts.ts` (queries) and
`encounters/encounterPorts.ts` (mutations); the room store is `RoomEncounterStore`
(`apps/session-worker/src/roomEncounterStore.ts`). Reads only commands make (authored sources, a
Character's initiative, optional-combat policies to pin) are `EncounterCommandReadPorts`, so a query
file never reaches the Sheet or authored-source graphs. Self-hosted Convex evaluates a query's whole
module graph on every run; `encounters/readModuleBoundary.test.ts` keeps command-only modules out of the
re-running subscriptions (RELIABILITY-21).
Document derivations (Zod parse plus checksum verification) go through `deriveOnce` (`transactionReads.ts`).
A derivation is cached only while its document is shared by identity. In Convex that means a query that
wraps its `db` in `memoizeTransactionReads`, which serves each identical read once per transaction, deeply frozen. The
session read (`encounters/activeReads` `readActiveEncounterSession`) does this because its ports each re-check the
Campaign, memberships, assignments and Character play, so most of its reads repeat (PERF-6.T9). A mutation must not
wrap its `db` in it, because a cached read would go stale after its own writes. The room's in-memory store is
created with `sharedReads`: it serves its stored documents deeply frozen instead of copying them, and never
changes one in place, so a derivation lasts as long as the document is unchanged across commands and pushes.
The room's records follow the same rule: `recordValue` parses a record's JSON once per stored record and serves
it frozen, so a Scene row's derivations (`readRoomSceneRow`, `parseGeometrySave` and the movement evidence it
verifies) are not repeated on every movement admission and publication.
Derivations shared by identity are dropped at every commit to bound them. Callers never mutate a read document
or a derived value. Without this the room re-parsed every document on every read, which saturated its CPU
under the V15 workload (REL-5). `rejectDomain` throws `EncounterDomainRejection`, which
`lib/domainRejectionTransport.ts` rethrows as a `ConvexError` with the same data for the builders in
`lib/queries.ts` and `lib/mutations.ts`. `characterRulesCapture` (`liveSessions/roomInputs.ts`), `actionChoices`
and the action-preparation helpers stay in Convex because they assemble Character and System content the room
receives as hydrated input. `encounters/runs` exposes `create` and `deletePrepared`.
`encounters/encounterStoreConformance.test.ts` runs one corpus against Convex and the in-memory store.
The session read model (`sessionReads.ts`: the presented Run, session state, prepared pending decisions,
GM actor sides and decision settlement; `timelinePages.ts`: one timeline page) lives here too. Convex's
`activeReads` and `projectionReads` and the room's pushed `ENCOUNTER_SESSION` frame
([Held Encounter session](live-sessions.md#held-encounter-session)) call the same readers, so they cannot
drift; Convex keeps authorization, receipt-ledger loading and read budgets. Convex's Campaign-conditions
port checks a Character's assignment from its head and verifies its play record and build checksum
(`requireIntactAssignedActiveCharacter`, `readVerifiedCharacterBuild`) but never hydrates the
Builder-owned collections or draft, so a session read does not grow with a Character's inventory or
spells (RELIABILITY-21.T4, `encounters/activeReadBudget.test.ts`).

### Terminal action commit skeleton (current, QUALITY-13.T2a)

The four terminal action commits (`persistEncounterActionCommit`, `persistEncounterAreaCommit`,
`persistEncounterCounteredCastCommit`, `persistEncounterGatedActionCommit`) share one skeleton; each keeps
only the checks and writes that are its own between the steps.

- Head (`actionCommitFences.ts`): `admitActionCommit` admits the command and returns a lost response's
  stored result already presented for its member; `requireRuleOutputScope` checks the room's rule output
  covers exactly the Run's non-Character actors and names the commit in its error by label;
  `requireActionCommitFence` runs the read fence and refuses an occurrence id already used by any
  occurrence other than the pending one the commit resumes.
- Source spend (`actionSourceSpend.ts`): `applyActionSpendMechanics` makes the one
  `DIRECT_ACTION_RESOURCE` mechanics batch an actor's own spend needs (the source's); `requireSourceSpendReceipt` compares it with
  the receipt the room planned. The single-target commit checks its source inside its own mechanics
  receipt check, because a source that targets itself spends in the target's batch.
- Target outcome (`actionTargetOutcomeSettlement.ts`, QUALITY-13.T2b): `settleActionTargetOutcome` settles
  one target's outcome for the single-target commit and for each child of the area commit. It makes the
  target's one mechanics batch (the planned applications, the source's spend when the source is the target,
  the slot of a reaction the target used against the outcome, and the reaction the target spent before
  it), checks it against the room's receipt, and then spends the target's Legendary Resistance charge and
  reaction allowance. Each caller still checks the receipts of what only it plans on that batch. On-hit
  use spends (`spendEffectUses`) and the D219 children (`persistActionChildren`) stay in the
  single-target commit: they run after the action's effects and its settled occurrence, and the area
  commit settles Concentration once across all its children.
- Tail (`actionCommitRecords.ts`): `completeActionOccurrence` settles the root occurrence, and
  `recordActionCommit` builds the command result, advances the Run, stores the root's receipt and its one
  `RESOLVE_ACTION` command, writes the evidence receipt of the answer that resumed it, and presents the
  result for the member.

### Rule-raised (SYSTEM) action admission (current, SPELLS-33.T6e1, D161 candidate)

A rule, not a player, can raise an action: a defeated creature's passive `HP_ZERO` area (Balor Death Throes).
The room raises it as a `RESOLVE_ACTION` carrying `systemTrigger: { parentCommandId }` right after the
command that defeated the holder commits. `readNativeEncounterActionAdmission` admits it through
`requireSystemTriggerAdmission` (`systemTriggerAdmission.ts`) instead of the player checks, and proves it
from the stored record alone: the command id must equal `systemTriggerCommandId(parent, holder, actionId)`
(uuidv5, `rules-runtime/encounterSystemTrigger`), the target must be `CASTER_CENTERED`, the parent must be a
committed Run command or rule receipt of the same Encounter, and a fresh root must name the parent's version
and a defeated holder. A replay of the same id returns the stored result. The SYSTEM root skips the
current-actor and control checks (the holder is defeated and it is nobody's turn), and every other check, the
save requests and the settlement run unchanged.

Undo and void. The parent and its system root are one change to the GM: `REVERT_LAST_ACTION` of the
system root reads the parent's group from the stored `systemTrigger` link and inverts both in one commit
(system group first, then the parent, shared actor and Character accumulators). A pending manual save on
the death area refuses the undo like any pending decision; the GM voids it, then undoes.

Rule arm (current, ATTACK-16.T1c2b). An optional combat rule's failed save raises the rule's own action
(`systemTrigger.trigger: RULE`). The parent is the save's `encounterRuleReceipts` row, read by command id
(an answered save also has a Run command row, so receipts alone are read): it must record a COMPLETE
massive-damage `DAMAGE_SAVE_CHECK` with `SAVE_FAILURE` for this holder under the Run's pinned rule
(`ruleSaveFailedEvent`, the `SAVE_FAILED` event the rule's raise-action hook subscribes to), and the command must be the holder's self-targeted `ACTOR` root naming
`encounterRuleActionId(holder, rule, failedSaveEffectId)`. A fresh root needs a standing holder. One
command can fail several holders' saves, and each raised root advances the version, so the rule arm
refines D161's version equality to a window: the parent's version must lie between the version of the
Run's last command that is not an answer, a void or a rule-raised root (`ruleTriggerWindowStart`) and the
current version; the general expected-version check still applies. A later player command closes the
window, so a stale failed save never raises. A RULE root reverts with the action that raised it, as the
defeat arm does; two rule roots raised from one action refuse the undo (adjust manually).

Reaction arm (current, QUALITY-8.T1a1 and T1a2, D219). A reaction its holder chose against a pending action is the holder's own action
(`systemTrigger.trigger: REACTION`, built by `systemTriggerReactionCommand`): an `ACTOR` root whose id is
`systemTriggerCommandId(parent, holder, actionId)`. Its parent is the pending action's root command, which is
not committed, so the proof is the pending action's own record instead: `reactionChildren` in the
`ENCOUNTER_ACTION` pending context lists the command id of each reaction chosen against it
(`readReactionChildParent`, `reactionChildren.ts`). An open offer alone admits nothing. A fresh child runs on
the Run version the pending occurrence is pinned to (`expectedEncounterVersion`), for a holder that still
stands, and is the one root admitted while that occurrence is pending. Its commit (`recordActionCommit`)
advances the Run one version and re-pins the pending occurrence to it in the same transaction
(`repinReactionChildParent`). The parent, a held action or a paused Scene move alike, takes the new pin and
stays SUSPENDED (QUALITY-18.T3c for a move, QUALITY-18.T3d for an action): a child is not complete until its
own check chain is (QUALITY-18.T2b2, ruling 17), nor until the roots its commit raises in the room's
after-commit settlement have run (the effect of a creature the child dropped to 0 hit points, say). Those
roots need a Run that waits on nothing, so they run, and take their own answers, while the parent is
SUSPENDED. They name the child command as their parent; under a move, whose option answer records no Run
command or rule receipt, the settlement reads that child from the Run (`readLastCommittedReactionChild`).
The room's after-commit settlement returns the parent to PENDING on the Run's version
(`resumeSettledReactionChildParent`) once nothing else is PENDING. Only then does the room resume it: a
held action by a `RESUME_ACTION` the room command runs after that settlement, settling again after it; a
paused move by its `REACTION_CHILD_RESUME`. Each rule-raised root advanced the Run one version, which
`countRunSettlementVersions` counts beside the child's own descendants. While a parent is SUSPENDED the
turn does not end under it: the delegated Legendary Action continuation and the summon advance both wait
(`readRoomTurnEndableRun`), and a GM undo is refused `PENDING_DECISION`, whether or not anything is PENDING
(a void's own undo of the occurrence it released excepted). A held action resumed from a child under which
its target reacted goes on against that target as the child's tree left it, defeated or not, with no new
`TARGET_DEFEATED` warning.
The fences read as follows:

- A resumed answer or the parent's own commit is fenced on the occurrence's pin, not on the root command's
  `expectedVersion`; the live answer scope compares the answer's version, not the stored root's.
- `readNativeActionPending` accepts a pin at most one version past the root for each recorded child, plus
  one for each reaction that committed under one of its children, plus one for each version a settled
  decision made since the root (`countRunSettlementVersions`: an answered check of a child, a GM void, and
  the undo it ran). The area read
  (`readNativeAreaActionPending`) applies the same rule (`heldRootVersionAccounted`, `reactionChildren.ts`)
  with no recorded child of its own: an aggregate reached from a cast window sits past the root by the
  reactions committed in the root's tree.
- A replay of the parent root expects its commit at the root's version plus the committed reactions of its
  tree plus those settlement versions plus one. Both are read from `encounterRunCommands`
  (`readCommittedReactionDescendants`, `countRunSettlementVersions`); no counter is stored.

Reactions to a held reaction child (current, QUALITY-9.T1c1; raised by a single-target cast's counters since
QUALITY-9.T1c2). A held child is itself a pending action, so it records the reactions chosen against it in
its own `reactionChildren`, and the rules above apply to it as the parent. When such a nested child pauses,
the held child is suspended like any parent; the action above it is already suspended. The tree is read
from the commands: a reaction commits before the action it answers, so `readCommittedReactionDescendants`
closes the tree from the root down rather than in Run order, and finds the reactions under a held child the
GM voided (which has no command) through the void's occurrence. Every commit or void in the tree moves the
Run, so `repinReactionChildParent` and `releaseReactionChildParent` also move the pin of each suspended
action above the one they return to `PENDING`.

A Scene move as the parent (current, QUALITY-18.T1a to T2b2). A paused move's
`ENCOUNTER_MOVEMENT_REACTION` pending context can record reaction children too: `reactionChildren` on its
`CHOICE` phase, the same child shape as the action's (`encounterReactionChildrenDtoSchema`), and on no other
phase. `reactionChildren.ts` reads either parent: a recorded child is admitted against the move
(`readReactionChildParent`), its ancestors name the mover (the moving actor of the open reaction choice, with
no cast slot and no cast level), and `suspendReactionChildParent`, `repinReactionChildParent` and
`awaitsReactionChild` treat the move as they treat an action.

The inline movement reaction engine is gone (QUALITY-18.T2c). A move's pending context phases are
`SPATIAL_EVIDENCE`, `CHOICE` and the spatial-only `CONCENTRATION_EVIDENCE`, `REPEAT_SAVE_EVIDENCE` and
`MASSIVE_DAMAGE_SAVE_EVIDENCE` (their `damageSource` is `{ executionOrdinal }`; a spatial contact execution
keeps its effect repeat saves as `repeatSaves` and its massive-damage saves as `massiveDamageSaves` beside
`concentrationChecks`, QUALITY-14.T2c and T2d; D196: additive optional fields on a held move's pending
context and its receipts, so existing local rows still parse); the context and the optional-combat passage continuation carry no
`completedReactionExecutions`, the move receipts (`MOVEMENT_COMPLETE` and the spatial batch) carry no
`reactionExecutions`, and `LiveSessionMovementSettlement` has no `REACTION` kind, so `persistMovementSettlements`
persists spatial, Concentration, repeat-save (`REPEAT_SAVE`), massive-damage save (`MASSIVE_DAMAGE_SAVE`),
passage and release settlements only. The reaction's own mechanics persist
through its child action. D196: these are removed shapes of a held move's pending context and of move receipts;
a local Run held on an old inline reaction is finished or cleared before use. QUALITY-18.T6 also removed the
`MOVEMENT_REACTION` pending summary kind (a move's reaction offer is the `REACTION_CHOICE` summary); no stored
document carries a summary, so it is a transport-only removal.

A member's `OPTION` answer to a move's choice records the child (`recordMovementReactionChild`,
`movementReactionChild.ts`): it appends the `OPTION` entry to the move's history, one occurrence version on,
sets `reactionChildren` to the one child and leaves the Run version alone. The child's command id
(`movementReactionChildCommandId`) names the move's command, the option and that occurrence version, so a
reaction chosen again after a release never reuses an id. The room runs the child's action in the same
transaction (`executeRoomMovementReactionChild`), so a refused child takes the record back with it and the
choice stays open. While a child is recorded the choice is answered: the decision summary shows no choice, so
nobody is asked again and no timeout declines it, and `readMovementResponseAuthority` admits only the campaign
owner's `REACTION_CHILD_RESUME` naming that child. The option the child came from is the last `OPTION` entry
of the history, which also names the allowance the option was offered under when one contact offers the same
action twice (`readReactionChildTrigger`).

The move's fence on the Run is its pin, not a count (QUALITY-18.T2a). `readMovementResponseAuthority` takes
an answer only while the move is `PENDING` and `expectedEncounterVersion` equals the Run version. A move's own
answers advance the Run and re-pin it, so the action's count of descendants and voids past the root
(`heldRootVersionAccounted`) does not describe a move. The child seam moves the pin instead: a child's commit
and a reaction that commits under a held child re-pin the move (`repinReactionChildParent`), and a GM void of
the held child, with the undo of what committed under it, releases the move on the void's version. A Run that
moved any other way leaves the pin behind, and the move takes no answer. The root command's replay at version
0 (`spatialPendingPublication.ts`) still requires the publication version: a child is recorded by an answer,
which is version 1 or later.

A move's occurrence version must equal its `root.resolutionCommands` count, so what a reaction child does to
the move is an entry of that history (`movementReactionChildCommandDtoSchema`): kind `REACTION_CHILD_RELEASE`
or `REACTION_CHILD_RESUME`, with the `childCommandId` and the fields every history entry has. No client
sends one. Its command id is derived (`reactionChildMoveCommandId`: the move's command, the child's, the
kind and the occurrence version it is recorded at), its fingerprint is the checksum of the kind and the two
command ids, and its `correlationId` is null. `releaseReactionChildParent` (QUALITY-18.T1b1) appends the
release entry when the GM voids the held child, with the GM as `actorUserId`: it drops the child from the
`CHOICE` phase, returns the move to `PENDING` one version on and pins it to the Run version the void
produced, so the next answer is fenced on that version like any other. The resume is carried by a
`RESOLVE_RULE_OCCURRENCE` resolution of kind `REACTION_CHILD_RESUME` with the `childCommandId`
(QUALITY-18.T2a): the live-session command frame refuses it from every client. The room raises it
(QUALITY-18.T2b2): after any commit, and from its alarm, the reaction-timeout sweep
(`settleRoomReactionTimeouts`) reads a move whose recorded child has a committed Run command
(`readMovementReactionChildResume`) and sends the resume through the Scene geometry response path as the
campaign owner, with the owner as the entry's `actorUserId`. A resume that fails is logged and tried again
after the alarm's retry delay, because nobody else can send it. The child may have changed the Scene, so the
resume's staging first moves the move's `root.currentSceneVersion` to the Scene's version
(`repinMovementReactionChildScene`); the mover's token must still stand at `root.currentPosition`. The resume
continues the Kernel choice with the option the child came from, or ends the move at `root.currentPosition`
when the child stops it or the mover is at 0 Hit Points. The field and the two kinds are additive, so stored
rows stay valid (D196: no local refresh).

The room runs the choice, the child and the resume in one room turn. The choice answer keeps the parent
paused on the answered offer and records the child's command id; the child's commit is the one spend of the
reaction (its own economy charge; the parent records no used reaction for it); the room's `RESUME_ACTION`
(`ACTION_RESUME` admission, room-internal) then reads the committed child and records what it imposes on its
parent as `reactionChildren[].resumeOutcome`: `null` for nothing, `{ kind: 'ROLL_MODE', rollMode }` for a
roll mode on the triggering roll (`imposesRollModeOnTriggeringRoll`), or `{ kind: 'STOP' }` for a move ended
at its contact (`stopsTriggeringMovement`; a move's own resume reads the adapter directly and records no
`resumeOutcome`). The System adapter
resolves each. A child without `resumeOutcome` is unresolved (`awaitsReactionChild`), and
until it resolves the parent takes no other answer. The rename from `rollMode` (QUALITY-18.T2a) changes the
JSON of a held decision's pending snapshot only (`encounterPendingSnapshotParts`), not a Convex validator or
source data (D196: no reseed; a local Run held on a resumed child is finished or cleared before use). The child command names the Scene tokens the reaction
was offered on (the holder's and the acting creature's), so its range is judged there like any action's.

The cast a child answers (current, QUALITY-9.T1b1, D219). A pending action that casts a spell records the
level it is cast at as `castLevel` in the same pending context, beside `reactionChildren`: present only while
a child is recorded, never rewritten while one is (`reactionChildrenKept`), and dropped with the last child a
GM void releases. A child reads the cast it answers from there, not from its own command: the action capture
returns it as `triggerCastLevel` on the child's `ACTION_COMMAND` and `ACTION_RESPONSE` admissions
(`readReactionChildTrigger`, the one read of what a child answers; see "The hit a child answers"), null for
any other command and for a parent that casts no spell.
This is a persisted pending-context shape change; refresh local data when next used (D196).

The held actions above a child (current, QUALITY-9.T1c2, D219). The same pending context records the slot the
cast spends at its commit as `castSlotKey`, under `castLevel`'s rules (only beside a child, never rewritten
while one is recorded, dropped with the last child a void releases). `readReactionChildAncestors` walks from
a child's command up through the pending contexts that record it, nearest first, and returns each held
action's actor, whether that action is itself a reaction, and its `castSlotKey`; the capture carries the list
as `reactionAncestors` on the child's `ACTION_COMMAND` and `ACTION_RESPONSE` admissions and on the
`ACTION_RESUME` of a held child (with that child's own `triggerCastLevel`), empty for any other command. The
Worker reads it to keep those creatures out of the child's own offers and to count their unspent slots (see
rules-runtime.md, "Counter as the holder's own action"); persistence does not fence either. The walk stops at
a parent that is not a pending action (a post-commit offer's child has no held action above it); no
single-target cast reaches that stop, so it has no room test. `castSlotKey` is a persisted pending-context
shape change; refresh local data when next used (D196).

Currentness across a nested child (current, QUALITY-9.T1c2). A resumed parent's commit is compared with the
facts sealed before its child ran. `readCommittedReactionChildren` returns, beside each unresolved child's
reactor, the reactors of the reactions committed under that child (`descendantReactorActorIds`), and the
pending fence (`actionPendingPersistence.ts`) excuses the comparison when the source or the target of the
resumed action is one of them: a counter of a counter is cast by, or at, a creature of the action two levels
down. A resume from a child whose tree holds neither creature keeps the full comparison. The Worker's planner
applies the same rule (rules-runtime.md, "Currentness across a reaction child"); both call
`reactedUnderAwaitedChild` (`encounterActionPendingSnapshot.ts`), and both pending inserts go through
`heldActionContinues` (`actionPending.ts`).

Area and chosen-list hosts (current, QUALITY-9.T1b3a). The cast window of an area or a chosen list is an
`ENCOUNTER_ACTION` pending on the cast's root, so it records children, takes the room's resume and is fenced
as a single-target cast's is. The endpoints of the currentness rule differ by what the checksum sealed: a
chosen list's are its caster and its chosen creatures; an area's are its caster and whichever creature it
caught first, which persistence does not read, so any creature of the Run that reacted in the awaited child's
tree excuses that one resume (the Worker compares the caught creature itself). From a child's resume the
window may be followed by another offer, by the aggregate pending (`ENCOUNTER_AREA_ACTION`, which records no
children), by the area's commit, including one that catches nobody or places no area, or by the countered
cast.

Void, removal and undo over those hosts (current, QUALITY-9.T1b3b). A GM void of the aggregate pending
(`prepareRuleOccurrenceVoid`, `occurrenceVoid.ts`) reads the root's committed reaction children from the
Run's commands (`readCommittedReactionDescendants`, from the root command's own version), because the
aggregate records none, and takes them back with the same undo a single-target void uses. That undo
(`revertLastEncounterAction`) is told which occurrence the void cancelled: the answers that occurrence took
before the void and their evidence receipts applied nothing, so they are not "a later rule result" and do
not refuse it. A void of the cast window or of a later offer on the root reads `reactionChildren` as before.
The GM's removal of the last creature an area waits on commits the area's stored root command, whose version
each committed child left behind, so `readLiveEncounterActionAdmission` fences the removal's own version,
as it does an answer's or a resume's; the removal admission pins that version to the Run and the occurrence.
One undo of an area commit or a countered area cast restores the root and every child (`actionRevertGroups.ts`).

The die a child rolls against a rolled attack (current, QUALITY-9.T1e1 to T1e3, D219 "Roll-window reaction
die"). The window reaction die it replaced is deleted: `spentReaction`, `windowReactions`,
`targetReactorSpend`, `answeredReactorActorIds` and `usedReactionSpend` no longer exist (D196: refresh local
data when next used). Four contracts carry a reaction chosen after the attack d20 is rolled:

- The offer. The `CAST_REACTION` pause's offer gains the kind `ATTACK_ROLL_BY_OTHER` and, for that kind
  only, `rolled`: the action's TEST as it froze with the roll (`test`: the paused continuation, its bound
  facts checksum and the settled d20, the shape a reactor window keeps) and the app roll it settled with. The
  pending context holds such an offer on `twoPhase.phase === 'TEST'`; every other cast offer is still held
  before any phase.
- The fence. `castPendingContinues` lets a rolled offer be followed only by an offer of the same roll or by
  the roll's settlement, and lets a reaction chosen from it leave the pause only by recording a child: it is
  never answered in place. Child recording, the room's resume
  and the reactor's decline follow the rules of any cast offer. The first rolled offer is a new moment, as a
  hit's is: it follows whatever offer the action left, on a decline, with no reactor heard from yet, and never
  follows a hit's offer.
- The resolved child. `reactionChildren[].rolledDie` records the die the committed child rolled, with its
  faces, written by the same resume that writes `resumeOutcome` (a die on an unresolved child is refused, and so
  is a die that names a held effect or a window reaction as its spender: the child spent it).
  `reactionChildrenKept` keeps a resolved child's die as recorded, so a replay of the action reads the die
  and does not roll it again; a GM void that releases a later child keeps an earlier child's die.
- The committed read. `readCommittedReactionChildren` returns `triggeringRollSubtraction` (the size and
  faces of the die the child's own graph rolled, or null) and `stopsTriggeringMovement` (QUALITY-18.T2a)
  beside `imposesRollMode` and `cancelsTriggeringEvent`, read by the System adapter from the child's stored
  execution. The child rolls its die as evidence of its own action, so a manually entered die is asked of the
  reactor there and the held action never asks for it.

The reactor's decision is authorized as any cast offer's (the reactor is the pending's roller), and its
`REACTION_CHOICE` summary names the roll it decides on as `attackRoll` (the attacker, the kept face and the
total less the dice earlier children rolled against it). The child is the reactor's action at the attacker;
it spends its own reaction and resource. One undo reverts the action and its children, a GM void of the held
action releases them, and a GM void of a child paused on its die returns the action to the same rolled offer.
The offer's `rolled`, its kind, `reactionChildren[].rolledDie` and the committed read are persisted or
published shape changes (a subtract action's graph now rolls its die); refresh local data when next used
(D196).

The hit a child answers (current, QUALITY-8.T1d1 to T1d2b, D219). The Worker makes this offer for every
reaction to a hit, whatever its trigger (`ATTACKED_SELF`, `DAMAGE_TAKEN`), holder (a Character, or a creature
the GM answers for) and payment (a spell slot or none; a pool- or charge-paid reaction is still not offered).
QUALITY-8.T1d3 deleted the inline on-hit settlement and its `REACTION` pause kind. The pending fence admits the reactor of a creature's pin (`characterId: null`) as the creature
actor itself, and a Character's pin as that Character's actor. On a use the Worker records the child
on the pending action and launches it; once it commits, the attack resumes with no stored roll result: it
rebuilds its TEST from the roll the offer keeps and binds it again to the target as the child left it
(`REBIND_TEST`), so the raised armor class is the sealed d20's `defenseOrDc` and the attack's own batch
carries no `reaction` receipt (the field is gone). A decline rebuilds the same TEST against the unchanged target and proves it equal
to the held one. Three contracts carry a reaction chosen by the creature an attack hit:

- The offer. The `CAST_REACTION` pause's offer gains the kind `HIT_BY_ATTACK` and, for that kind only, `hit`:
  the settled hit (the completed execution, its d20 and policy, and the two
  checksums) and `damageTypeIds`, the damage types the hit deals. It is the one kind whose menu holds two
  triggers, `ATTACKED_SELF` and `DAMAGE_TAKEN`; every other kind still holds one. The pending context holds it
  on `twoPhase.phase === 'TEST'`, as it holds a rolled offer.
- The fence. `castPendingContinues` treats the hit as a new moment: its offer may follow the action's own roll,
  a declined earlier offer or a child's resume, with no reactor yet declined and no child
  added. Once held, the hit is kept unchanged; a decline leaves it only for the outcome, never for another
  offer (it is made to the one creature hit), and a chosen reaction leaves it only by recording a child.
- The child's read. The action capture returns the offer's `damageTypeIds` as `triggerDamageTypeIds` on the
  child's `ACTION_COMMAND` and `ACTION_RESPONSE` admissions and on the `ACTION_RESUME` of a held child
  (`readReactionChildTrigger`), null for any other command and for a parent that holds no hit.

One read of the trigger (current, QUALITY-8.T1d2b). `readReactionChildTrigger` (`reactionChildren.ts`) reads
the parent that records the child once and returns one shape, `{ triggerCastLevel, triggerDamageTypeIds,
triggerMovement }`, which the capture spreads onto the three admissions; a fact the parent does not hold is
null.

The hit of one ray of a list (current, QUALITY-13.T1c2b, D219). A list its caster rolls one attack at a time
(`ENCOUNTER_AREA_ACTION` with `resolution: 'ATTACK'`) holds the same offer per ray: the ray that hit keeps the
`CAST_REACTION`/`HIT_BY_ATTACK` snapshot as its own sealed snapshot, unanswered, and no later ray is asked while
it is held (`encounterAreaSaveAwaiting` returns `'DECISION'` for it, and nothing for it while its child is
awaited). The held ray's own context records the child, so every D219 read and write goes through
`readRecordingParent`, which returns that ray's context and seals a changed one back into the list's snapshot:
the child's trigger read, its ancestors, suspend, re-pin and the GM-void release need no list-specific path.

- Admission. A reactor's `DECLINE` or `OPTION` names the held ray's request; the response admission offers it
  the options of that ray's pause. `ACTION_RESUME` on a list returns the held ray's snapshot as `snapshot` and
  the list as `areaSnapshot` (nullable, transport only).
- The fence. `requireAreaActionAnswer` hands a step about a ray's hit offer to `requireAreaActionRayHit`:
  a roll may leave its ray held; a decline answers the ray with the d20 its offer kept and changes nothing else
  of it; a chosen reaction keeps it held and records one child (`heldActionContinues` on the ray's contexts);
  the resume answers it and writes the child's outcome. Only a ray behind one that left its offer may go on,
  an answer is written once, and only the resume, which follows a committed child, seals rays again.
- `testBindingJson` (additive, optional, per target). When a reaction is chosen, every ray answered so far
  keeps the binding its roll was sealed against. The commit replays those rays with it as their test binding,
  so a hit rolled before the reaction stays a hit though its creature's armor class rose afterwards. It is
  written once, only at that step, and never rewritten.
- The resume re-seals every unanswered ray against the creatures as the child left them and refreshes each
  ray's `currentnessChecksum`; until then `revalidateAreaTarget` tolerates a changed creature only while it
  reacted under an awaited child (`reactedUnderAwaitedChild`).
- Projection. While a ray is held on its offer, the list's one decision is the reactor's reaction choice
  (`projectNativeAreaActionPending`), as its damage window and push pick are.

The on-hit rider of one ray of a list (current, QUALITY-13.T1c4, D123, D219). A ray that hits also holds for
its caster's optional on-hit riders, after its creature's reaction: the ray keeps the `ON_HIT` snapshot an
attack at one creature holds, as its own sealed snapshot, unanswered, and no later ray is asked meanwhile
(`encounterAreaSaveAwaiting` returns `'DECISION'`; the list's one decision is the caster's `ON_HIT_CHOICE`).

- `onHit` (additive, optional, per target). The caster's answer is kept with the ray as the audit an attack
  at one creature seals into its OUTCOME (`EncounterOnHitAuditDto`: `DECLINE`, or `USE` with the option).
  The schema accepts it only on an answered ray whose own snapshot holds the offer, for that offer's hit and,
  when used, one of that offer's options. The ray's snapshot keeps the offer, so the commit and every later
  ray at the same creature replay the hit from the offer's retained TEST and the audit, rolling no attack
  again. The field is optional and absent on every stored list, so no reset or migration is needed (D196).
- The fence (`requireAreaActionRayHit`). A roll, a declined reaction or a resumed reaction may leave the ray
  held on the rider offer for the same hit (the d20 the reaction offer kept); a ray never returns from the
  rider offer to a reaction offer. The caster's `DECLINE` or `OPTION` answers the ray with the d20 the offer
  kept, writes `onHit` matching that response and changes nothing else of the ray; no other step writes
  `onHit`, and an unanswered ray never carries it.
- One slot and one pool per cast. A rider that spends a slot or a pool is not offered at a ray once an earlier
  ray of the list chose such a one (`onHitCandidates` with `chosenBefore`), nor a slot rider when the cast
  spends a slot itself. The commit folds the chosen riders' costs into the cast's one Character spend
  (`settledCharacterActionSpend`), so nothing is spent before the last ray is answered and a GM void spends
  nothing.

The move a child answers (current contract, QUALITY-18.T2b1 and T2b2, D219). The same three admissions return
`triggerMovement`, null unless a held Scene move records the child: `readReactionChildTrigger` finds the option
the move's history last recorded as chosen, requires it to be the child's reactor's for the child's action, and
returns its attack occasion and `policy.allowanceDefinitionId`, and throws when the move
offers that reactor no such action. The child's economy transition (`encounterActionEconomyTransitionDtoSchema`)
gains optional `turnSequence`, set when the spent allowance refreshes `EACH_TURN`; the undo
(`returnSpentActionEconomy`) returns such a spend to that turn's `turnUsage` entry and refuses once the turn
has passed. The field is additive, so stored receipts stay valid (D196: no refresh needed).
`REVERT_LAST_ACTION` of a committed child is refused while its move is held: the move is the Run's pending
decision (`PENDING_DECISION`).

The move's spatial receipt across a child (current contract, QUALITY-18.T2b2, D219). A move's resume keeps
no execution of its reaction child, so the spatial batch result (`ENCOUNTER_SPATIAL_MOVEMENT`) cannot chain a
target's state across the child's commit. The resume records on the applied prefix how many spatial executions
had settled (`reactionChildBoundaries`), and the batch's timeline proof starts again at the execution with that
ordinal; the child's own receipt proves what it changed. A resume also plans the remaining contacts against the
Run as the child left it, so it compares neither the frozen contact suffix nor the frozen currentness checksum.
The field is additive and optional, so stored receipts stay valid (D196: no refresh needed).

The resolved child records nothing new: the parent keeps its TEST and the kept d20, so its resume tests that
d20 again against the committed state. The offer's `hit` and kind are persisted pending-context shape changes;
refresh local data when next used (D196).

A ray's incoming gate (current, QUALITY-13.T1c5a). A ray of a chosen list may be held on an `INCOMING_GATE`
pause in its own snapshot, keep a `passedIncomingGate`, or be answered as lost (`lost: { gate }` beside the
gate d20 in `testedJson`); the schema admits these only on a ray its caster rolls, for the ward of the creature
it is aimed at. `requireAreaActionAnswer` routes a gate-held ray's answer to `requireAreaActionRayGate`: a fail
marks exactly that ray lost on the gate it was offered, a pass seals it again with that gate
(`castPendingContinues`), and the rays behind an answered ray go on in order (`withRaysBehindOpened`: lost by an
auto-rolled gate, held on a fresh gate or aim, or sealed past a passed gate). The area commit input carries
`lostRays`; `persistEncounterAreaCommit` rebuilds each receipt from the stored list
(`buildEncounterLostRayStoredExecution`) and refuses any other, computes ray occurrence ids over the whole
caught order so a kept ray's id does not shift when an earlier ray is lost, and writes each lost ray as a
completed child of the list (`ENCOUNTER_GATED_ACTION.parentOccurrenceId`), which the list's undo collects. A
root gated action never carries `parentOccurrenceId`. The `lost` marker, the ray-level gate fields,
`parentOccurrenceId` and `lostRays` are persisted-shape changes; refresh local data when next used (D196).

A ray's retarget (current, QUALITY-13.T1c5b). A ray whose gate failed may instead be held on an
`ATTACK_RETARGET` pause in its own snapshot (the schema admits it only there, on a ray its caster rolls), and
an entry its caster turned carries `retargeted`: the failed ward saves that turned it, oldest first, the first
one's holder being the creature the list named for that entry (`encounterAreaNamedActorId`).
`requireAreaActionRayGate` accepts a failed roll that holds the ray on the offer for the same gate.
`requireAreaActionAnswer` routes a retarget-held ray's answer to `requireAreaActionRayRetarget`: a `DECLINE`
marks exactly that ray lost on the offer's gate; an `OPTION` must name a creature the stored offer lists, and
the entry is rebuilt with `turnEncounterAreaRay` (same place and occurrence, the option's creature and token,
`retargeted` extended, the caught set sealed again), begun afresh as one retargeted attack is
(`castPendingContinues`). Since the caster's choice is the one answer an auto-rolling caster gives a list, the
turned ray and the rays behind it may be answered in the same step by rolls made for them
(`withRaysBehindOpened` with `rolledForCaster`). The live admission keeps the list's root command for a ray's
retarget (only a single-creature action is replayed as the retargeted command) and still requires the member
to see the chosen creature. `requireAreaActionPendingRoot`, the area commit and `persistEncounterAreaCommit`
count entries by named creature, so a turned ray keeps its occurrence id and its receipt names the creature it
hit. `retargeted` on a list entry is an additive persisted-shape change; refresh local data when next used
(D196).

The check a child owes (current, QUALITY-9.T1b2, D219 "Trigger-check gate"). A child whose authored
`reactionTrigger` asks a check against a higher-level cast owes it as its incoming gate, read against
`triggerCastLevel` (`owedNativeTriggerCheck`, `advanceNativeIncomingGate`). A gate carries a discriminated
`origin`: `WARD` (`effectId`, `holderActorId`) or `TRIGGER` (`triggerLevel`). The `INCOMING_GATE` pause payload,
the `ATTACK_RETARGET` pause's `gate` (always a ward's), the pending context's `passedIncomingGate` (the settled
gate: origin, check, DC and d20, no longer a ward id) and `ENCOUNTER_GATED_ACTION.gate` all carry it, and the
pending fences compare gates by origin (`sameGate`, `passedGateAfter` in `actionPending.ts`). A `TRIGGER` gate is
admitted only on a command whose `systemTrigger` is `REACTION`. A pass lets the child go on: its mechanics batch
records the settled check as `passedGate` (TRIGGER origin only; a passed ward's record stays its immunity
grant), checked against the pending gate at the commit (`persistEncounterActionCommit`). A fail commits the
child as `ENCOUNTER_GATED_ACTION` (`lost: 'SPELL'`), spending its slot and reaction; the parent's resume reads a
gated child as one that did not cancel, so the cast goes on. Either way the check is carded once, as the
reactor's `Counter` check on the child's occurrence (`recordIncomingGateRollCards`, the one card path of every
incoming gate: a ward's save is carded the same way as a `Ward` save, from the attacker or the caster, for a single
attack at its commit and for each ray of a list, passed, lost or turned, at the area commit; a single attack turned
to another creature carries the saves that turned it in the optional `retargeted` list of its `ENCOUNTER_ACTION`
pending context, as a turned ray does, and `failedWardsBehind` is the one rule that reads it, for the carry, its
integrity check and the cards), and the cancelled cast
records no counter: its child (`systemTrigger.parentCommandId`) holds the check. Every host's counter
runs as a child since QUALITY-9.T1b3a (area and chosen-list casts) and QUALITY-9.T1c2 (single-target casts).
QUALITY-9.T1b3c deleted the inline check on the parent: the `CAST_REACTION` offer carries no `check` and its
pause takes only a decline or a chosen reaction (`castPendingContinues`). QUALITY-9.T1c3 deleted the inline
chain: the offer carries no `chain`, a used reaction no `check`, and `ENCOUNTER_COUNTERED_CAST` no `counter`
(the countered-cast commit input no `reactionSpellConsumption`). These are persisted pending-context and
receipt shape changes; refresh local data when next used (D196). QUALITY-9.T1d2 then removed the pending
context's, area snapshot's, commit inputs' and stored receipt's `usedReactions` field outright (D196: clear the stored
Encounter run command and pending-occurrence rows when next used). QUALITY-8.T1d3 removed the on-hit `REACTION`
pause kind, the OUTCOME phase's and on-hit offer's `reaction`, the action batch's `reaction` and
`reactionEffectTransitions`, and the commit input's `reactionSpellConsumption` (D196: clear the same rows when
next used).

A child that cancels its parent (current, QUALITY-9.T1a, D219 amendment). The resume also reads whether the
committed child cancelled the event it answered (`cancelsTriggeringEvent`, from the child's stored execution).
A cast held at a `COUNTER` offer whose unresolved child cancelled it commits through
`persistEncounterCounteredCastCommit` from the resume, with no response: no reactor is spent and no evidence
receipt is written (`castCancelledByReactionChild`). This is the only way a cast commits as countered: an answer
never does (QUALITY-9.T1c3).

A child that pauses (current, QUALITY-8.T1b, D219 amendment). A reaction's own action may need evidence of
its own, such as a save its target makes. The transaction that stores the child's pending decision also
moves the parent occurrence to the stored state `SUSPENDED` (`suspendReactionChildParent`,
`actionPendingPersistence.ts`), so the Run still has at most one `PENDING` occurrence: the child's. A
suspended occurrence keeps its sealed snapshot under PENDING's rules and takes no answer. `SUSPENDED` is a
stored state only; the public occurrence summary does not carry it. The child's final commit re-pins the
parent, which stays `SUSPENDED` (`repinReactionChildParent`) until the room's after-commit settlement of
that commit has run what it raised and returns the parent to `PENDING`
(`resumeSettledReactionChildParent`); the room then resumes the parent in the same room command, whoever's
answer produced the commit. A child that never pauses suspends its parent only from its commit to that
settlement. The System decides what a reaction's own test may propose: the dnd5e compiler admits, on a
result path of that test, the outcome its reaction trigger resumes by (`dnd5eTestPathResumeOutcome`), gated
to the path, so a failed save imposes it and a passed one imposes nothing. Recovery after a crash between
the child's commit and the resume is the GM's void.

Post-commit reaction offer (D219; current: planned, queued and raised since QUALITY-8.T1c2b1, answered and
run by the room since QUALITY-8.T1c2b2). A reaction that answers an attack's
outcome is planned with the attack and raised after it has committed. The trigger is checked at plan time:
the attack's planner (`planNativeResolvedAttackOffers`, Session Worker) asks the event table whether the
resolved attack meets a reaction the attacked Character holds, and prepares each such reaction against the
attacker; an attack made off a Scene plans none. The plan carries one offer per reactor
(`reactionOffers` on the commit input), and the attack's own commit stores each as a rule occurrence in
state `QUEUED` (`queueReactionOffer`, `reactionOffer.ts`): an `AGGREGATE_CHOICE` snapshot whose context kind
is `ENCOUNTER_REACTION_OFFER`, naming the committed attack command and its occurrence, the reactor, the
attacker, the reactor's reaction allowance as planned, and the reactor's options with their labels. Its id
is derived from the attack command and the reactor (`reactionOfferOccurrenceId`), so an attack offers a
reactor once and a chain of reactions ends. A `QUEUED` occurrence is no pending decision: nothing shows it
or answers it. Liveness is checked at raise: after each room command, `raiseQueuedReactionOffer` raises the
next queued offer (earliest attack first, reactors in actor-id order) as `PENDING`, pinned to the Run as it
stands, only while the Run has no pending decision, so several reactors are offered one at a time. It reads
committed state alone and voids an offer whose reactor or attacker has left the Run, whose reactor has
departed or is at 0 hit points, whose reactor has used its reaction since the attack, or whose reactor
cannot take a reaction now (the one action-economy rule, `evaluateEncounterActionEconomy`, asked for one
reaction; it judges nothing in a MANUAL Run); staleness between the commit and the raise beyond that is
refused by the chosen reaction's own prepare. Undo voids the queued
offers of the attacks it takes back (`voidQueuedReactionOffers`), and a finished Run deletes them with its
other occurrences. A raised offer is shown to the reactor's controllers, the GM among them
(`projectReactionOfferPending`), whatever they see of the attacker: only the authored trigger hides an
offer. It has no timer: an offer whose reactor does not answer waits until the GM voids it, and the void settles it as a
decline (`classifyRuleOccurrenceVoid`). The answer (`persistReactionOfferAnswer`, `reactionOfferAnswer.ts`)
closes the offer first: one command completes the occurrence, moves the Run on one version, changes no
creature, and stores a receipt (transition `REACTION_OFFER`, output `REACTION_OFFER_ANSWER`) that records
the chosen option and the one child command id that runs it, or no child for a decline. The chosen action
then runs as its own `REACTION` root. No parent is pending, so `requireSystemTriggerAdmission` proves it by
that receipt (`readReactionOfferChild`): the offer must be `COMPLETED`, the receipt must record this child
id, and the child must target the recorded attacker; anything else is `COMMAND_ID_REUSED`. A fresh child
runs only on the Run version the answer produced, so the record admits one run and none once the Run has
moved (`VERSION_STALE`). Its commit suspends, re-pins and releases no parent. The room runs both in one
command (`executeRoomReactionOfferAnswer`, `roomEncounterReactionOffers.ts`, response route
`REACTION_OFFER`): it stores the answer and, for a chosen option, sends the child as the reactor's own
action against the attacker, judged on the Scene where both tokens stand now (an offer is raised only on a
Scene, so tokens that no longer share one refuse it). The command is one transaction, so there is no state
between the answer and the child to recover from: a child that is refused (a Sheet edit left the reactor
unable to react while the offer waited) takes the answer back with it and the offer stays `PENDING`, to be
declined or voided. A child that needs evidence of its own (its attack roll, its damage dice) commits
paused in that same command and settles from that evidence's answer on the action route; with no pending
parent to resume, its commit ends there (`readReactionOfferChild`). A retried answer replays its stored
result and runs no second child. The option's action is an ordinary action of the reactor: it spends the
reaction through its own commit, and no pool-spend exclusion applies to it. For undo, the answer's receipt
names the attack's occurrence, so `planRevertRoot` reads it as the attack's own and the group goes back
child, then attack with the answer, in one `REVERT_LAST_ACTION`; an attack whose offer was declined goes
back with its answer the same way. The web drawer (`CampaignTabletopDecisionDrawer`) shows the projected
`REACTION_OFFER` to whoever it is projected to (the reactor's controllers, the GM among them): the attacker and
the reactor by name, one "Use <option label>" button per reaction and "Decline", answered through the ordinary
`RESOLVE_RULE_OCCURRENCE` command with an `OPTION` or `DECLINE` resolution. It shows no timer and answers no
key press, since the offer waits. The SRD Hunter's Giant Killer (SPELLS-31.T4k1c, D217) is the first consumer:
its `ATTACK_RESOLVED_ON_SELF` trigger is authored data, the offer has one option per wielded weapon, and it
adds no pending record, timer or rule of its own.

Undo and void of a reacted action. One undo rule: a receipt belongs to the occurrence that recorded it, so
`REVERT_LAST_ACTION` groups a root with the REACTION children raised against it and inverts them as one
step, attributing each receipt by occurrence instead of by a version range (`actionRevert.ts`). The group
(`revertGroupRoots` in `actionRevertGroups.ts`) is the run of commands, back from the Run's last action,
that are one action and the REACTION children of its tree (its own, and those chosen against them in
turn), whichever of them is last: a child chosen while the action
was held committed before it, and a child chosen from a post-commit offer (D219, QUALITY-8.T1c1; raised
and run by the room since QUALITY-8.T1c2b2) follows it and goes back child-then-parent. A last REACTION
child whose parent has no command answered a voided parent and goes back with its siblings alone. A void of
the pending parent (`prepareRuleOccurrenceVoid`) stages nothing of the parent's own; its committed
reactions are what the cancel takes back, so it runs `REVERT_LAST_ACTION` for them in the same transaction
(command id derived from the void's) and then records the void, two timeline rows. The reaction is
refunded with the child's other changes. When the children are not among the Run's latest commands, which
must all be reactions of the voided action's tree (`readTrailingReactionDescendants`), or their undo is
unavailable, the void is refused whole (`REVERT_UNAVAILABLE`). A suspended parent cannot be voided
while its child is pending. Voiding the paused child cancels it (it has spent nothing yet) and releases the
parent in the same transaction (`releaseReactionChildParent`): back to `PENDING`, pinned to the Run version
the void produced, with that child dropped from `reactionChildren`, so the offer it answered stands open
again. Undo stays refused while anything is pending.

### Encounter record shapes (ADR 0035 Amendment 12)

- **Character play state.** A Character is a `characters` row (structure, clocked by `updatedAt`) and a
  `characterPlayStates` row (hit points, resources, slots, conditions, exhaustion, inspiration, item-use state,
  party visibility, `maximumHitPoints`, `speeds`, `classSummary`, `totalLevel`, Sheet spell summons (`spellSummons`, D190), clocked by `streamVersion`). `writeCharacterRecord` is
  the only writer and rewrites only the record whose checksum changed, so a play change never writes the
  document. See [Character play state](character.md#character-play-state-adr-0035-amendment-12--local-implementation).
- **No stored projection.** `encounterRuns` holds Run state only. Projections are built on read
  (`readEncounterGmProjection` in `nativeProjection.ts`) from the Run, the actors' stored records
  (`readRunProjectionFacts`), the current initiative round and each Character. Creature stat blocks shared by
  identical Creatures are held once per checksum in `encounterSourceProjectionFacts`.
- **Spell pins (D163).** `encounterSpellPins` holds one row per Spell a Run's Creatures name, keyed by
  `(encounterId, spellId)`: the stored compilation of the version read when the Run first needed it (run
  creation, reinforcement or entering a Creature form; `ensureEncounterSpellPins`). A pinned Spell is never
  read or recompiled again, so editing or deleting the source cannot change what the Run's actors cast.
  Actors hold Spell ids only. Pins live for the whole Run and are deleted with it (completion, Campaign
  deletion, development removal). `readEncounterSpellPins` hydrates them and fails closed on a superseded
  compiler version or a stale or corrupt compilation. Current: written and released on every path, and
  every discovery caller reads them: Convex through `readEncounterSpellPins`, the room through the
  `SPELL_PINS` capture (`readNativeLiveSpellPins` hydrates the stored rows with `hydrateSpellPins`; no
  compile, no source read). `spells` is required on `discoverEncounterFeatureActions`; a caller that needs
  no casts passes an explicit `new Map()`, and a pinned Run whose pins omit a Spell its Creature names
  throws instead of dropping the cast.
- **Actor storage (ADR 0035 Amendment 29).** An actor's source `snapshot` is static, so it is stored apart from
  its play state. `encounterRunActors.stateJson` holds the play state, the projection facts evaluated when the
  actor was written, and `snapshotChecksum`, which names an immutable, content-addressed
  `encounterActorSnapshots` row of the Run (`encounterId` + `checksum`). `stateChecksum` covers the actor
  without its snapshot, so a guard never hashes the snapshot. A snapshot row is written once when an actor
  names it, deleted with the last actor that names it, and never mutated: a command that changes a snapshot
  (equipment replacement, disarm) writes a new row and repoints the actor. The one function that rebuilds the
  full actor is `composeRunActorState` (`rules-runtime/encounterActorStorage`); `readRunActors` and
  `readRunActorWithRow` call it. Every actor write goes through `insertRunActor`, `writeRunActor` or
  `deleteRunActor`, which keep the snapshot and source rows in step in the same transaction. Convex validates
  an actor change from the stored record and does not read the snapshot row. The finished-Encounter GM view
  reads only the actor rows' stored records and the source rows.
- **Character actors** keep no hit point or condition copy. Reads load the current Character while it is assigned
  to the Campaign; `frozenState` holds hit points and conditions for a Character the Run stops reading (the
  COMPLETE command and assignment removal freeze it).
- **Replay receipts.** A Run command's ledger entry stores `replayReceiptJson`, a few hundred bytes. Exact replay
  rebuilds the projection from current records and adds the receipt.
- **Pending snapshots.** An occurrence keeps only `pendingSnapshotChecksum`; the sealed snapshot lives in
  `encounterPendingSnapshotParts` as a base plus structural deltas (a delta at least half the base, or a chain of
  128 parts, starts a new base).
- **Changed fields only.** Round, participant, side and occurrence updates patch only changed fields, which is
  what a checkpoint carries.
- Byte costs are recorded in the [record-shapes evidence](../validation/phase-08-2/adr-0035-s1b-record-shapes-2026-09-28.md).

### Encounter Run storage

`encounterRuns`, `encounterRunActors` (one document per actor with its validated snapshot and `kind`-discriminated
state), `encounterSceneBindings`, `encounterActorTokenBindings`, `encounterInitiativeRounds`,
`encounterInitiativeParticipants`, `encounterInitiativeSides`, `encounterRuleOccurrences`,
`encounterTurnMovements` (also the once-per-turn record, `usedOncePerTurn`, D119 f; a capped granted-action offer counts its uses there as `granted:<effectId>:<offerIndex>:<use>`, spent by the commit and restored by an undo, SPELLS-4.T2lb; and the start-of-turn marker, `startedByCommandId`, the first command that began the turn, so a GM Previous Turn then Next does not raise its start-of-turn stages again: Recharge, the death save, effects, zones and grant ticks, SPELLS-33.T4i1c, T4i1e), `encounterDecisionSkips`, `encounterRunCommands`, `encounterRuleReceipts`
and `encounterReplayIndex` carry Run state and history in Convex. The Convex `encounterEvidenceRolls`
table is removed (current): evidence rolls are room-only since D88, written and read only in the room's
store.

**Encounter history lives in the room for the Run (ADR 0035 Amendment 22, D85, D88).**

- **Why the room keeps it whole:** command rows, rule receipts and evidence rolls are live rules state, not
  only a timeline. Pending decisions (Concentration chains, Cleaving, movement reactions, turn responses),
  the GM's void, undo and replay read them.
- **Carry-over:** the room keeps them in its SQLite store for the whole Run. Every hydrate, a same-epoch
  reload or a new epoch after release, carries the store's rows for every Run it holds, bound to the
  presented Scene or not, and unions them with the rows Convex holds, deduplicated by ledger key
  (`apps/session-worker/src/roomInputs.ts`). A Run loaded lazily later does not restore a row the store
  already holds.
- **What Convex holds:**
  - only the history its own writers record while no room holds the Run: Run creation, and the
    departure, release and account reconciles. `encounterRunCommands` and `encounterRuleReceipts` remain
    as this Convex-side inbox (Run CREATE and REMOVE_ACTOR departure writes) that the room merges at
    hydrate; Convex has no evidence-roll table;
  - `encounterReplayIndex`: one row per room command (Campaign, Run, command ID, actor, fingerprint,
    resulting version, roll card ID).
- **Storage recovery** carries nothing. A retry the index knows answers "applied at version V" with the
  current projection and no roll (the roll card stays in chat); a reused ID with other input is refused.
  Undo of earlier actions is refused, and the timeline restarts. Open decisions stay resolvable or voidable,
  and COMPLETE still needs them settled.
- **Run end (ADR 0035 Amendment 30):** COMPLETE keeps only `encounterRuns`, `encounterRunActors` and the
  `encounterSourceProjectionFacts` rows those actors name, which is all the finished GM view reads
  (stored actor records, Character `frozenState`, Run state). It deletes every other child row in the
  same save, in the room and, through the checkpoint, in Convex: snapshots, Spell pins, Scene and token bindings,
  initiative rounds, participants and sides, rule occurrences, pending snapshot parts, replay index,
  turn movements, decision skips, effect and maintained-effect rows, spatial effects, and the command,
  rule receipt and evidence histories (`removeFinishedRunRowsPage` in `packages/encounter-persistence`).
  It also deletes the Character effects the Run sourced (`endCompletedRunCharacterEffects`, D99); a
  Character's own timed grants stay and carry over to the Campaign clock. A Concentration grant a
  Character holds is detached from the Run's maintained state (both Run links nulled) and stamped with its
  caster in `lifecycle.concentrationCasterCharacterId` rather than deleted (SPELLS-5.7). The caster's
  next Concentration ends such grants on Run Characters in the room (maintenance receipt
  `endedCarriedGrants`). For Characters outside the Run, the room appends each Character that starts a
  Concentration to the Run row's `concentrationCasterCharacterIds` (append-only, at most
  `MAX_ENCOUNTER_ACTORS`; Convex creates it empty and only the room adds to it). The one exception is the
  GM's undo of the command that added the id: that `RESOLVE_ACTION` row stores
  `addedConcentrationCasterId` (null when the Character was already in the set), and its undo removes
  exactly that id, so an undone Concentration never ends outside grants. Every checkpoint
  (`checkpointRecords`) compares the previous and next Run row and `endOutsideCarriedGrants` ends the
  stamped grants of the newly added ids on Characters outside any ACTIVE Run (D99).
  A placed zone records the maintained state it depends on (`maintainedEffectStateId`, index
  `by_state_encounter`) and counts as a dependent: ending, dropping or replacing the state deletes its zones
  in the same transaction (`maintainedStateZones.ts`; the Concentration cleanup carries `removedZoneIds`),
  and `deleteMaintainedStateCas` refuses a state a zone still depends on (D135).
  The caster stamp is also a top-level column of `characterActiveRuleEffects`
  (`concentrationCasterCharacterId`, index `by_concentrationCaster`), written with the lifecycle and
  checked against it on read, so a caster's carried grants are found without scanning Characters
  (SPELLS-5.11, D101). A carried grant relinked to its caster's reinstated Concentration (D151,
  SPELLS-5.12) stores the later Run as `sourceEncounterId` beside its `maintainedEffectStateId`, while its
  definition keeps the earlier Run's origin; `readCharacterEffect` accepts that pair only on a stamped row.
  An actor may hold several states per maintenance definition (Concentration capacity, SPELLS-12.T1);
  `readMaintainedStatesByDefinition` (the store's `findMaintainedStates`) lists them oldest first and the
  single-state reader returns the oldest. The damage-save chain binds and verifies every held state, not the
  oldest (`bindEncounterDamageSaveChain` through `planDamageSaveChain`, `concentrationResponsePersistence`); only the movement
  chain still reads the oldest.
  A maintained state's descriptor records the `spellLevel` it was cast at when a spell started it (gates per-cast Concentration capacity, SPELLS-12.T2a) and names its `provenance` (`ACTION` with the creating action and
  occurrence, or `CARRIED` with the caster); `rules/maintainedProvenanceMigration:run` moved stored
  descriptors' top-level action ids into it. `endCarriedGrantsOfConcentratingCasters` is the one ending path for both the
  checkpoint and the caster's own `END_CONCENTRATION`; `listCarriedActiveRuleEffects` is bounded by
  `.take(64 + 1)` and throws beyond it. A caster outside an ACTIVE Run ends in one user action that
  sends Convex `END_CONCENTRATION` (the caster's own and every holder outside an ACTIVE Run; a held
  holder is skipped) and then the room's `endOutsideCasterConcentration` (the held holders; same
  command id, both idempotent). The room end also writes the Run command row
  `RETURNED_TO_PLAY` (room-authored, GM-only: a creature came back from `REMOVE_FROM_PLAY` onto an occupied space, `RETURN_SPACE_OCCUPIED`, D184; written by `appendSystemRunEntry` like the next one),
  `CONCENTRATION_DROPPED_OUTSIDE` (stored input `encounterConcentrationDroppedOutsideInputSchema`,
  `label` the GM notice "<caster> dropped Concentration: <label> ends on <holders>", Run version +1).
  Like every Run command except a public enemy roll it is `PRIVATE`, so `readEncounterTimelinePage`
  gives it to the GM only. The checkpoint remains the safety net for the caster set.
  A completed Run has no Scene binding, so bind commands on it are refused with `ENCOUNTER_NOT_ACTIVE`
  and lookups by Scene never resolve it. Several PREPARED or ACTIVE Runs may bind one Scene, so the
  binding table has no Scene index and no lookup ranks Runs: the fight played on a Scene is the
  Campaign's single ACTIVE Run (`by_campaignId_status`) when its binding names that Scene
  (`readActiveSceneEncounter`, `packages/encounter-persistence`); a PREPARED Run never plays or lends
  Scene vision. `encounterRuns` carries the creation key (`createCommandId`,
  `createCommandFingerprint`, index `by_campaignId_createCommandId`) so a `runs.create` retry returns
  the same Run after COMPLETE. Run deletion and Campaign deletion delete the remaining rows too.
- **Contest commands (D152):** every contest commits through the one contest path
  (`contestPersistence.ts`). A Disarm or basic action contest is a `RESOLVE_ACTION` row rooted in its
  `RULE_OCCURRENCE`; a contested escape keeps the existing `ESCAPE` row, whose `receipt.checkOccurrenceId`
  is the contest occurrence and whose rule receipt's `commandType` is `ESCAPE`. Replay and resume
  (`actionContestReplay.ts`, `contestAdmission.ts`) read either root through `ContestRootCommand`.
- **Stored end triggers (SPELLS-27.T6):** an Active Rule Effect's `recurrence.endTriggers` is the one list of what ends or uses it up: the
  `LIFECYCLE` arm (`{ event, timing: 'CONSUME' | 'END', code }`) and the qualified arms, unique and sorted by their serialized form
  (`canonicalActiveEffectEndTriggers`), required on read with no default. Rows of the earlier consume and end event lists are not migrated;
  local data is reset and reseeded (D196).
- **Ended grants and undo (D113):** state-bound grants the engine ends (incapacitation or defeat for grants with a `LIFECYCLE` `END` `ON_INCAPACITATED` trigger, a named Condition for `endOnConditionIds`) are deleted in
  the same commit. A `RESOLVE_ACTION`, area or cleaving root keeps them in `consumedGrants` (`receiptConsumedGrants`,
  `addResponseChangesToRoot`), so `REVERT_LAST_ACTION` restores them with the consumed grants. The commit validates every
  `endedGrants` record against the stored effect and the holder's state, not the client's claim
  (`concentrationChildrenPersistence.ts`: `damagedActorIds` names the holders the commit damaged, and a commit that omits a grant such a
  holder's state ends is refused). A grant ended by a movement pass or an actor or Sheet edit is deleted without a receipt
  (`endHolderStateGrants`, `endConcentrationAfterEdit`; D99: no undo of an ended grant), and every path posts a chat notice per grant
  (`postGrantEndMessages`, entry id `grantEndNoticeId(occurrence, grant)`, so a replay adds nothing; a private GM holder posts none). A turn advance is not an undo root, so its
  ended grants carry no receipt. An `ON_IDLE_TURN` grant is ended by that turn commit (`persistEncounterIdleTurnCheck`, which reads an armed Character's rules through the commit's `readCharacterRules` for its `END_EVENT_EXEMPTION` grants); its
  `idleTurnMark` lives in the actor's `resources` (hashed with the actor state), and the `RESOLVE_ACTION` root's `idleTurnMarkChanges`
  lists each actor whose mark that action changed with its previous value so `REVERT_LAST_ACTION` restores exactly those (`rules-runtime.md`, Idle turns). A moved effect (D160) is the stored Run command `MOVE_HELD_EFFECT`: its receipt keeps `{ actorId, actionEconomy, effectId, fromActorId, toActorId, before, afterVersion }`, where `before` is the whole record as the old holder kept it and `afterVersion` the version the new holder's copy was created with. `REVERT_LAST_ACTION` deletes the new holder's copy only while its version is still `afterVersion` and recreates `before` at the old holder with `restoredFrom` (exact ordinal, version and timestamps); it is a root command, so anything committed after it makes the undo unavailable. A holder-ended grant is the stored Run command `END_HELD_GRANT`; like any costed
  Run command it blocks undo of the prior action (D99). A repeat offer (D166, `REPEAT_SOURCE_PATH`) is stored on the carrier's `MODIFIER_GRANT` contribution (`storedEffectOffer.ts`): the frozen authored Effect (`effectDtoSchema`) with a `FIXED_DC` save and a sibling `castLevel`; the carrier is bound to the item and ends through the shared release seam, and its repeat is a plain `RESOLVE_ACTION` (no new pending kind). The Sheet end of a holder-end grant is free in a MANUAL Run
  (`economyEnforced: false`).
- **Creature rest:** `CREATURE_REST { restKind: SHORT | LONG, actorIds }` (GM only, ACTIVE Run) is one undoable stored Run command. For
  each creature actor it resets the `actor.resources.featureCharges` entries whose feature charge or spell slot table `resetKind` the
  rest recovers (SHORT recovers `SHORT_REST`; LONG also `LONG_REST`; the trigger set is `getRestRecoveryTriggers`, shared with the
  Character Sheet rest), keyed by feature id and slot `levels[].id`. A Character id, a duplicate id, or a rest that recovers nothing is
  refused; a Character rests through its Sheet. The receipt keeps `{ restKind, actors: [{ actorId, resets: [{ key, beforeUsed }] }] }`
  for exactly the rows it touched, and `REVERT_LAST_ACTION` spends them again only while each row is still `0` (root command, as
  `MOVE_HELD_EFFECT`). Not yet: hit point and hit dice recovery on a long rest.
- **No Convex timeline:** the timeline and latest evidence roll are read only from the room. Encounter
  commands write no Character receipts, and the Character history API is removed.

A Run retains its exact Blueprint version and checksum,
Campaign policy snapshots and ordered sides. Catalogue removal checks the initiative and optional-combat source
pins held by PREPARED and ACTIVE Runs and rejects with the Run UUID. `encounterBlueprints` and
`encounterBlueprintUpdates` store owned Blueprints (setup plus a receipt per update); creation checks the owned
count against tier capacity, and snapshots pin Creature and Equipment revisions and checksums. Run creation
(`encounters/runs:create`) requires the Campaign owner and an open Session and stores a Campaign-scoped command
receipt; a matching replay returns the stored projection before loading sources. Effects are stored in
`characterActiveRuleEffects`, `encounterActiveRuleEffects`, `encounterMaintainedEffectStates` and
`encounterSpatialRuleEffects` (`rules/schema.ts`) through the same Encounter store port.

A placed zone (SPELLS-17) is one `encounterSpatialRuleEffects` row written by the area commit
(`persistEncounterAreaCommit` takes it as `placedZone` on its input). Its `placement` carries `label` (one shared
rule, `spatialZoneLabelSchema`), `visibility`, `activation`, `movementKinds`, `triggerModes` and
`bypassAtHalfSpeed` (the zone may be crossed carefully at double cost) and, when the caster designated creatures at cast (SPELLS-20 T4c), `unaffectedActorIds` (a non-empty Encounter actor list the zone never catches; omitted when empty, immutable with the placement checksum) and, when authored (SPELLS-20 T4b1), `maxApplicationsPerTurn` (a positive integer; also immutable). The count of applications lives on the Encounter run state, never on the placement: `zoneApplications` (optional, keyed `effectId:actorId`, each entry `{ turnSequence, count }`, bounded by `MAX_ENCOUNTER_ACTORS * MAX_SPATIAL_RULE_EFFECTS_PER_SCENE`). An entry whose `turnSequence` differs from the run's current `turnSequence` counts as unspent; no step clears it on a turn change, and `recordZoneApplications` prunes stale entries whenever it writes the map. The terminal movement publications (`publishSpatialTerminal`, the movement-response terminal) write it from the settled executions; `recurrence.endTriggers` stays empty, and a
creature's lingering grant takes its end events from the grant template. The area receipt names the row as
`placedSpatialEffectIds` (one per zone component), so GM undo deletes them with the commit. The Scene holds at most
`MAX_SPATIAL_RULE_EFFECTS_PER_SCENE` rows; the next placement is refused with `TARGET_UNAVAILABLE`.

A zone that depends on a Concentration (SPELLS-20.T2a, D135) records `maintainedEffectStateId` on its row. A cast
whose only Concentration holder is the zone has no creature outcome to carry the state: the area root carries
`maintenanceTransition` instead, and the area commit replaces the caster's prior state and creates the new one
(`prepareMaintenanceReplacement`, `applyMaintenanceReplacement`) before it writes the zone. GM undo deletes the
created state with the zone; undoing a cast that replaced a state stays unsupported. Ending the Concentration
removes the zone in the same transaction in T2b (current: the link exists, cleanup does not yet act on it).

Initiative restores (current, SPELLS-31.T5o). When a turn commit settles initiative (`root.initiative` is non-null:
encounter start, or an EACH_ROUND re-roll), `persistEncounterInitiativeRestores` runs once after the START zones and
grant ticks and before the Run state is written. For each Character in `orderedActorIds` it reads the Character's
rule evaluation through the same `readCharacterRules` callback as passive zones, plans the restores
(`planCharacterInitiativeRestores`) and, when there are any, applies one Character mechanics batch with event phase
`INITIATIVE_RESTORE` and `forceVersionAdvance: false`. The batch's command id comes from the occurrence, the root
command, the phase and the actor's place in the order, so a replayed commit applies nothing twice. It runs after the
sealed turn plans because it bumps the Character's stream version. `actionRevert` does not undo it: a turn commit is
not reverted.

Zones act at turn boundaries (SPELLS-20.T4b2b, ADR 0034). The room plans each boundary's zone batch against the
live Scene (`prepareEncounterTurnZoneEffects`) and keeps it in the turn result (`outgoingZoneTurn` on the root,
`incomingZoneTurn` on the commit input; absent when no zone caught the creature). The terminal transaction
(`persistEncounterTurnCommit`) runs, per boundary, the active-effect batch and then
`persistEncounterTurnZoneEffects`, the only zone-specific persistence function: it reads the Encounter's Scene
binding and the creature's token binding, derives the contacts and the per-turn counter again with the shared
`selectTurnZoneContacts` (the same function the room used) from the locked effect rows and the room's Scene
tokens, and refuses a plan whose selection checksum (which covers each zone's version and placement, D138: a placed
zone is fixed at placement) or Character target pin differs. It applies one `TURN_ZONE_EFFECT` mechanics batch and returns the zone phase evidence
that `completeNativeInitiativeOccurrence` stores as `outgoingZoneEffects` / `incomingZoneEffects` on
`INITIATIVE_COMPLETE`, `BATCH_COMPLETE (ENCOUNTER_TURN_ACTIVE_EFFECTS)` and `TURN_LIFECYCLE_COMPLETE` results; a turn
without zones stores a result without those fields. The new turn's catches are recorded in the Run state's
`zoneApplications` (`recordZoneApplications`, keyed by effect and actor, kept for the current turn sequence
only). Turn zones neither consume nor reveal a spatial effect, so persistence applies no spatial lifecycle
transition. The pending kind `ENCOUNTER_TURN_ZONE_EFFECTS` rides the same pending, admission, owner and
replay seams as the other turn kinds.

### Owned Run actors (current, SPELLS-4.T2v2a1)

An actor may carry `owner: { ownerActorId, sourceEffectId? }`: the Run actor that commands it (a summon, pet,
companion or minion), and the effect that created it when one did. Control of an owned actor is never copied onto
it: `controllerUserIds` stays the GM's per-Run grant. One walk, `actorOwnerChain`
(`packages/shared/src/domains/campaign/actorOwnership.ts`: nearest owner first, stopping at a missing owner, a
repeat or depth 4), finds the actors whose control counts, and each reader applies the same rule to it: the
persistence reads (`actorController.ts`) load the owner rows of the same Encounter by `by_encounterId_id`; the
player projection (`playerControlsActor`, `playerSeesActor`) and the room's authorization cache
(`roomBoundTokenControl`) walk the Encounter's actor list they already hold. The cache's actor pick therefore
carries `owner`. A departed owner's player stops controlling the owned actor because they stop controlling the
owner; nothing is rewritten. A summoning cast sets `owner` on the actor it creates (SPELLS-4.T2v2a2c1).

An owned actor takes no initiative turn by default: it acts on its owner's turn (D190a). Two predicates in
`packages/rules-runtime/src/encounterInitiativeCursor.ts` split the cohort: `rollsInitiative` (unowned, or
`OWN_INITIATIVE`) names who rolls, and `takesInitiativeTurns` (unowned, or any explicit `turnTiming`) names who holds a
place in the order and so is what `validateInitiativeCursor` expects. An owner link may carry `turnTiming`
(`AFTER_OWNER` or `OWN_INITIATIVE`, D200); absence means the owner's turn. The field is
optional on the stored `owner`, so existing Runs are unchanged and need no migration. Initiative staging, reinforcement, removal,
reorder, correction and turn settlement pass the actors they already read in the same transaction, owners
included, and the cursor leaves the owned ones out; no caller adds a read for it. `stableActors` lists each owned
actor right after its owner (SPELLS-4.T2v2a3d).
Current (SPELLS-35.T4, D200): an `AFTER_OWNER` summon is seated at cast time by `insertReinforcementInitiative` with
`anchorActorId` (the nearest owner in the chain that holds a place, `followedActorId`): it takes the anchor's score and
side, the place behind it, and `ACTED` or `READY` by whether that place is at or before the cursor, which does not move.
`RESOLVE_ACTION` records the resulting round state as the nullable `initiativeStateJson` and `initiativeStateChecksum`
pair, validated like the `SUMMONS_ENDED` one, so `REVERT_LAST_ACTION` restores it through `removeConjuredActors`. Each
later round is seated by `anchorOwnedActors` in rules-runtime.
Current (SPELLS-35.T5, D200): an `OWN_INITIATIVE` summon cast into an ACTIVE Run carries the roll `rollSummonInitiative` made
(`initiativeRoll` on the summoned token). `persistEncounterAreaCommit` passes its score (`face + modifier`) to
`insertReinforcementInitiative` without an anchor, so the participant row is sorted in by score, and posts the Initiative
roll card (`persistSummonInitiativeRollCard`) once the Run actor is stored. With no roll (a manual Run or an unscorable
policy) it is anchored behind its owner as an `AFTER_OWNER` summon is. The same `initiativeStateJson` receipt restores the
round on `REVERT_LAST_ACTION`; the roll card stays in the conversation like any other roll.

## Scene storage

`sceneDefinitions` holds the current settings and save ID of a Scene definition. An owner save uploads typed
entities through begin, append and publish (`sceneDefinitionSaves`, immutable `sceneDefinitionEntities`) and
publication installs the header atomically and creates one initial `campaignScenes` live snapshot reference.
Token and Barrier IDs (every Scene entity ID, `sceneEntityIdSchema` in
`packages/schema/src/api/vttScenes.ts`) must be lowercase UUIDs; uppercase IDs are rejected.
Abandoned uploads expire after 24 hours and scheduled cleanup removes unreferenced entities. Owner reads page a
definition pinned to its save ID. `campaignScenePresentations` stores one versioned Scene selection per
Campaign, with exact replay through the Campaign event receipt; finishing a Session clears the derived active
map reference but not the selection.

`lootTables` holds one GM-only row per loot owner (a discriminated `owner` union: `SCENE`, or `ENCOUNTER_ACTOR` for a non-Character actor of an Encounter Run, never an authored creature), indexed `by_scene`, `by_actor` and `by_campaignId`. An actor's loot goes with the actor: the live checkpoint that deletes an `encounterRunActors` row deletes its loot (the room removes actors, so Convex cannot do it in the command), and `removeEncounterRunChildren` deletes a Run's loot with its actors; the row is a versioned list of loot tables (name, optional
System skill id, exclusive inclusive-integer roll ranges whose top range may be open, and per-range item, coin
and note entries). It sits outside the definition save protocol on purpose, because the definition seeds the
player-readable live Scene; `loot/tables.ts` (`get`, `save`, `live`) serves only the Campaign `OWNER`. `live` is the reactive read behind the GM-only live Loot panel and the token loot marker: the live Scene's document plus the rows of the Encounter's creatures that have tables; the web asks for it only in the GM's own full view, and the panel matches a typed roll with `findLootRangeForRoll`. Overlap and
`min > max` refusal is `findLootRangeRefusal` in `packages/shared/src/domains/vtt/lootTable.ts`, and saves check
the skill, coin denomination and `EQUIPMENT` item references against the Campaign's System and the owner's
catalogue. The tables are reference only: the app never resolves a check against them or grants an item.
Deleting the Scene definition or the Campaign removes the row.

Live Scene rows (see [Live room and checkpoints](#live-room-and-checkpoints)) are checkpoint-written.
`sceneLiveStates` holds the version, settings (including the versioned `fogMode` of `OFF`, `SHARED_PARTY` or
`PER_PLAYER`, ADR 0034), counts and ordinals; `sceneLiveEntities` holds collection-qualified overrides and
tombstones over the immutable base. Fog layers reference immutable `sceneFogChunks` through `sceneFogSaves`
manifests; superseded chunks are retained because layers reference them. The Scene's `daylight` flag (D189: the
Scene is lit by the sun; sunlight at a square is `daylight` and BRIGHT illumination there, see
`resolveSceneDaylightAt`) lives in the `ambientIllumination` live setting beside the illumination value, so the one
`SET_SCENE_AMBIENT_ILLUMINATION` command changes both under one version. Staging uploads for fog never reach
Convex. The room's Scene command receipts and geometry saves are described under Scene command evidence. Recipient
reads (`scenes/recipientReads`, `recipientActions`) and `fogReads` page current entities and fog pinned to one
Scene version and filter to the viewer's layers.

`sceneVisionRevisions` stores one marker per scope and UUID. Database triggers in `lib/mutations.ts` advance
the affected System, Campaign, Session or Character marker in the same transaction as the relevant write, once
per transaction. Draft and play-only Character writes leave unrelated markers unchanged. Markers never replace
authorization or exact Scene, Run and Character version checks. All native mutation builders import from
`lib/mutations`; lint rejects raw builder imports elsewhere. A Map's `hasSceneReferences` flag on `mediaAssets`
is updated with definition and live Scene references and is checked by account deletion (see
[media](media.md#native-vtt-map-upload--partial-implementation)).

## Characters

### Character operational records

Mutable Character data is split by the reads and writes that use it, and a complete Character is assembled at
Builder, rules, import and capture boundaries (`characters/stateDocuments.ts`). Heads store identity and clocks only;
Build and play values are typed and each owned collection has one checksummed row per instance with its array
position. The complete structure and Sheet-state checksums are derived when the records are assembled
(`assembleCharacterStructure`, `packages/schema/src/projections/characterOperationalState.ts`), so a write that
changes one collection never rewrites an aggregate hash on the head.

| Table                                                                                   | Contents                                                                                                                                |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `characters`                                                                            | UUID, owner, System, status, label, portrait metadata and the structure clock                                                           |
| `characterBuildStates`                                                                  | Profile and Builder intent, with per-family counts that prove collection completeness                                                   |
| `characterPlayStates`                                                                   | HP, hit dice, inspiration, resources, slots, conditions, exhaustion, equipped and attuned IDs, usage, party visibility, `streamVersion` |
| `characterInventoryItems`, `characterCurrencyGroups`, `characterExtraEquipment`         | One row per item, currency group or extra-equipment link                                                                                |
| `characterClassSpellStates`, `characterSpellCustomizations`                             | Class spell selections and source-specific customizations                                                                               |
| `characterCreatureInstances`, `characterVehicleInstances`                               | One Creature or Vehicle instance with its state and equipment links                                                                     |
| `characterNotes`, `characterNoteGroups`                                                 | One note or group, preserving owner privacy and order                                                                                   |
| `characterCommandReceipts`                                                              | Private Character command receipt headers (bodies are in ledgers)                                                                       |
| `characterSheetDerivations`, `characterSheetSectionChecksums`, `characterSheetSections` | Derived Sheet sections per viewer, their checksums and their input fingerprint (ADR 0041); rewritten by Character writes                |
| `characterSheetPendingStores`                                                           | The one queued Sheet derivation per Character (ADR 0041); a newer write cancels and replaces it                                         |

Campaign adjustments and conditions stay Campaign-scoped (`campaignCharacterStates`). Authored versions, drafts,
snapshots and capture artifacts may keep validated checksummed JSON; normalization does not apply to authored
mechanics. Sheet command responses are compact acknowledgements and subscribed queries deliver state. Validation
lives in `packages/schema`, independent of the full mechanics graph.

### Stored maximum hit points and speeds

`characters/characterWrites.ts` owns every Character record write. `writeCharacterRecord` writes a complete
Character; `writeCharacterNoteRecords` writes a note edit through only the note and note-group rows, the Build
counts, the structure clock and, outside live play, the play clock (SHEET-7). A note never changes rules
inputs, so it keeps the stored stats. In the same transaction `writeCharacterRecord` evaluates the written
Character (`resolveCharacterPlayRecordStats`, `packages/rules-runtime/src/character/characterRecordStats.ts`) and
stores on the play record `maximumHitPoints` (the Sheet's effective maximum before Encounter reductions),
`speeds` (every typed speed in feet, `{speedId, amount, unit: FEET}`, the Encounter movement allowances, D38 and SPELLS-5.6; the room and Convex compare them structurally),
and the Sheet identity's `classSummary` and `totalLevel`, which the party roster serves without a derivation (PERF-6.T2). Builder commit, source loss and the room's reconciliation of a Builder commit made while the table held the Character are the writers that change them. Callers keep authority, replay, receipts and the one-stream-advance rule. A DRAFT Character keeps
its last stored stats. Campaign-owned inputs (GM adjustments, attunement override, assignment, departure) refresh
the stats without advancing the stream. Rules never read the stored values; projections display them. A
published-content change reaches a Character's stored stats on its next write while the Sheet always shows the
live value.

### Character draft payloads (ADR 0036 S8)

A draft is a head (`characterDrafts`: owner, System, mode, generation `id`, base revision, label, checksum,
`payloadId`, `payloadDocumentId`) and one payload document (`characterDraftPayloads`). Payload JSON stays inline
up to `CHARACTER_DRAFT_PAYLOAD_INLINE_MAX_BYTES` (960 KiB, under the 1 MiB document limit); above it the document
holds chunk metadata and `characterDraftPayloadChunks` hold 240 KiB chunks. Create inserts the payload then the
head. Save replaces the payload document in place under a new `payloadId` (`replaceCharacterDraftPayload`) and
deletes old chunks only when the old payload was chunked. Reads, commit, discard and account deletion load the
document by `payloadDocumentId` and verify its identity and checksum against the head. Draft tables are not Scene
vision dependencies. See [Character](character.md#draft-autosave-adr-0036-s8--local-implementation).

### Held Character authority

See [Live room and checkpoints](#live-room-and-checkpoints) for `liveCharacterHolds`. `sheetLive.liveAuthority`
reads head, holds and typed play only, exposing routing metadata to the owner and GM and null to party readers;
`campaigns/queries.liveAuthority` serves Campaign-level pages. `checkpointedAt` records the last acknowledged
checkpoint. Membership, controller and account-deletion departures reconcile in the room (D74).

### Oversized inventory cleanup

Inventory and Vehicle cargo are uncapped. Ordinary transfers and cleanup are atomic. Oversized deletion,
departure and source-loss cleanup use a durable job under [ADR 0031](../adr/0031-oversized-inventory-cleanup.md):
`campaignVehicleCleanupJobs`, `campaignVehicleCleanupTotals` and `campaignVehicleCleanupSegments` record a grant
and per-segment markers, and the affected bag, cargo, currency group or destination slice is locked while the
scheduled continuation converges. Unrelated inventory stays usable; continuation rechecks the grant, authority
capture, checksums and markers and is idempotent.

## Authored content

`authoredRoots` is the stable identity of an authored item and points at its current version
(`currentVersionId` and the denormalized `currentVersionPublicId`). `authoredVersions` holds each published
version's document (`documentJson`, or `documentChunkCount` and `documentByteLength` with
`authoredVersionPayloadChunks` when large). `authoredDrafts`, `authoredDraftPayloads` and
`authoredDraftPayloadChunks` hold working drafts; `reusableDefinitions` and `reusableDefinitionDrafts` hold
reusable definitions; `authoredRouteIds` and `authoredRouteSequence` reserve public route handles;
`authoredImageSlots`, `authoredImportRefs`, `contentSources`, `rulesCatalogues` and `systems` hold sources,
catalogues and Systems; `systemVocabularySnapshots` holds an immutable, checksummed System vocabulary snapshot
created at canonical bootstrap and reused on replay, which Encounter compilation checks for provenance. `systemChecksums` holds one `{ systemId, checksum }`
row per System (`by_systemId`), written only by the bootstrap's System upsert, so a Sheet fingerprint reads the
checksum with one index point lookup instead of the System document (ADR 0041 Amendment 2).

**Public version identity (D42).** Persisted contracts and checksums pin a version by its public `versionId`
UUID, never a Convex `_id`. Every writer that moves the current version sets `currentVersionId` and
`currentVersionPublicId` together.

**Compilations (D84).** A version's compilation lives in `authoredVersionCompilations` (one row per version,
`by_versionId`, fields `subjectId`, `systemId`, `versionId`, `compilation`) and not on `authoredVersions`, so
readers that do not compile, such as Builder commit, do not pay for it. Deleting a version deletes its
compilation. Parent publication refreshes descendant projections and compilations in the same transaction.
The compiler version is `subject-compiler-v2` (PLATFORM-21.T1a, D163): it carries every rules field and label
the Builder reads, stores Equipment in its resolved shape (variant parents applied, `parentEquipmentIds`), and
carries no prose; views read prose from the authored payload by id. `content/compilationMigration` recompiles a
superseded row from its version's stored document (Race and Equipment against their current parents), and
`readAuthoredVersionCompilation` refuses a superseded row. Import stores the compilation of base Equipment
(with its builder facts) and of a base Race at once; a variant, a subrace and every Class compile in the seed's
derived step (`syncEquipmentDerived`, `raceRelationships.syncDerived`, `syncClassDerived`) once their parents exist.
Tests import canonical subjects the same way through `importSeededSubjects` (`tests/fixtures/publication.ts`). The seed's derived
syncs replace a superseded compilation of a canonical row (`syncCanonicalCompilation`), because the seed is the
source of truth for canonical content; an authored row's superseded compilation is left to the migration. The table
validator still admits `subject-compiler-v1` rows so the migration can read them; readers reject them as stale.
Read paths never compile (PLATFORM-21.T1b, D163): Convex Builder and Sheet preparation, commit, the browser Builder
(format 3 snapshot `compilations`) and the room hydrate the stored row, checked against the root checksum. Only
publish, import, the seed and the migration call a subject compiler (`readPathCompilation.test.ts`), and publish
compiles before it stores, so a compile failure stores no version or compilation. That guard is per file, so a
read path that needs only the effective Equipment calls `resolveCurrentEquipment`, never
`compileCurrentEquipment` (party inventory commands, the snapshot builder projection, the search backfill check).

**Equipment projection.** `authoredRoots.equipmentOptions.builder` is an optional checksum-bound projection of
the Equipment selector fields. Builder reads preserve the complete authorized set and validate the parent graph;
a missing or stale projection is rejected; there is no payload fallback. Spell selector facts live in
`authoredRoots.catalogue.spell` (`selectionVersion: 1`); current readers reject an absent marker or stale checksum.

**Root catalogue facts (D163).** Every root's `catalogue.publishedActive` is true unless its current payload's
status is `DRAFT` (canonical documents carry no status and are active; publication always writes `ACTIVE`); every write that stores a version sets it (`rootCatalogueFacts.test.ts` walks import,
replacement and publication). RACE, CLASS and BACKGROUND roots also hold `catalogue.race`, `.class` or
`.background`: the picker facts `toContentSnapshotIndexEntry` derives once at publish; EQUIPMENT roots hold
`catalogue.equipment.quote`, and a base (non-variant) EQUIPMENT root holds `catalogue.equipment.container` (whether
it has capacity; a variant reads its base's at read time, as `resolveEquipmentAuthored` takes capacity from the
base, so a base republish never leaves a variant stale). Share and parent-chain authorization, the subclass and Spell witnesses, the party
inventory Equipment picker (`equipmentOptionsReadBudget.test.ts`), the party inventory list (label and container
flag; `partyInventoryReadBudget.test.ts`), the Campaign Vehicle picker (`vehicleDefinitionOptions.test.ts`), commit and the held-item capture (`captureAcquiredEquipmentRules`, prose from the root label and catalogue) read these root rows
alone, so commit loads no authored payload (`commitReadBudget.test.ts` makes every payload unreadable before it commits). `compilationMigration:run`
backfills both on older roots.

**Normal publication** replaces and deletes the previous version atomically. Custody, Encounter snapshots and
receipts carry embedded JSON, checksums and external version provenance and do not pin the `authoredVersions`
row. Account cleanup deletes remaining versions under the validated USER content-source index only when the
stored owner, identity, System, label, kind and checksum match.

**Catalogue projection.** `authoredRoots` also carries `catalogueMetadata`, name and search indexes, and
`authoredCatalogueCounts` and `authoredCatalogueOwnerCounts` keep counters. Browser list pages no longer read
them; `catalogueItem.ts` still serves the Campaign and Character option readers and import and publication code
still writes them, with `content/catalogueSearchBackfill.ts`. Whether the remaining reads justify the write
cost is an open cleanup (see [Known gaps](#known-gaps)).

### Content snapshots

[ADR 0036](../adr/0036-versioned-content-snapshots-and-browser-builder.md) publishes content as immutable R2
objects; Convex owns only the bookkeeping (`apps/apis/convex/contentSnapshots`). The Builder and the authored
list pages read these snapshots in the browser. Delivery is in
[media](media.md#content-snapshot-delivery-adr-0036-s3--local-implementation).

#### Content snapshot heads and objects (ADR 0036 S2)

SOURCE and CAMPAIGN objects use format 2 and `v2/` keys; the document part keeps ordered original publication
identities, numeric versions and stored parent metadata, and original storage checksums stay the source pins
(object hashes do not replace them). Format 1 development rows are reset, not read.

- **Scopes.** Each content source (PLATFORM or USER) is one `SOURCE` scope holding its readable roots by the
  Builder's source rules. A `CAMPAIGN` scope holds the shares that pass `readCampaignSharedRootPublication`
  and the Builder's parent rule; a shared child whose parent is neither shared nor an enabled official root is
  excluded, not failed. No `SYSTEM` head exists yet (D67); System and vocabulary keep their room-input path.
- **`contentSnapshotHeads`** (`by_scope_scopeId`): the contract head (`revision`, `builtRevision`, per-kind
  `index`, `list` and `documents` refs) plus `buildScheduledAt`, a build lease (15 minutes) and `failedBuilds`
  to bound automatic retries.
- **`contentSnapshotObjects`** (`by_key`, `by_supersededAt`): `createdAt`, `supersededAt` once no head references
  the key, and `deletingAt` while cleanup deletes it.
- **Dirty marking.** Triggers in `lib/mutations.ts` mark a scope once per transaction, bump `revision` and
  schedule `contentSnapshots/actions:build` 2 seconds later unless a lease is live. Marking sources:
  `authoredRoots` (the root's source and every Campaign sharing it), `authoredVersions`,
  `authoredVersionCompilations` (a recompile writes only this row), `campaignContentShares`, import completion (`importJobs`), and, for existing heads only, `contentSources`, `campaigns` (System, owner,
  catalogue) and `campaignMemberships` (status, role).
- **Build.** The Node action reads `revision`, then each kind in pages that end at 15 roots or once their serialized
  sources reach 256 KiB, well under the 1 s query limit (a write between pages bumps `revision` and triggers another
  build), builds the `index`, `list` and `documents` parts and uploads gzipped objects only for keys without a row. Unchanged kinds keep their keys. A root whose current compilation is
  missing or stale (the seed compiles Classes and subraces after every root exists) makes the build wait, not
  fail. When a mark landed during the build, the action reschedules itself (2 seconds) without writing the
  head: marks keep the head hot while content is written (a seed marks it several times a second), and a head
  write from the build would lose every OCC retry to them and strand the lease. Otherwise `awaitCompilation`
  releases the lease (or reschedules if a mark beat it), so the compilation's own mark schedules the next build.
  Only other errors take `failBuild`'s backoff (1, 2, 4, 8 and 16 minutes); when `failBuild` itself cannot
  commit, the action schedules the first backoff, so a held lease always ends in a scheduled build.
- **`commitBuild`** is a compare-and-set that writes only when `revisionBuiltFrom > builtRevision`, inserts or
  revives referenced rows and supersedes the previous head's other keys. A referenced key that is being deleted
  or has vanished returns `RETRY` and reschedules after a minute. A deleted source or Campaign deletes its head
  and supersedes its objects.
- **Cleanup.** A daily cron (09:30 UTC) claims rows superseded for more than 7 days (`deletingAt`), deletes the
  objects with provider confirmation, then the rows, in batches of 100. A claimed key is never reused, a claim
  older than an hour is retried, and automatic retries stop after 5.
- **Storage.** `CONTENT_SNAPSHOT_R2_BUCKET` names a separate private bucket reached with the media endpoint and
  credentials; a missing configuration fails the build without retries. The build marks PLATFORM objects public.
- `contentSnapshots/migrations:rebuild` marks every source and every Campaign with shares; run it after an
  object-format change with `{"reset": true}`, after deleting the old head and object rows.

#### Content snapshot manifest (ADR 0036 S4)

`contentSnapshots/manifest:manifest({systemId, characterId?})` is the reactive query a Builder uses to find its
snapshots. Its scopes are exactly the Builder's: for a Character assigned to a Campaign, the Campaign's enabled
catalogue sources, the caller's USER sources and the Campaign share scope; otherwise every System catalogue
source and the caller's USER sources. It returns each source's `kind` and head, and for a Campaign its
`contentMaturity` and head. A null head has no built content; `revision > builtRevision` means a build is pending
and the head still names the previous objects. Build bookkeeping never leaves Convex. Tests assert that the roots
each scope's build reads equal `readCharacterSourceRoots`.

#### Authored-content list snapshots (ADR 0036 S11)

The eight authored list pages (Spells, Classes, Races, Equipment, Creatures, Feats, Backgrounds, Vehicles),
Guided existing-source choices, Campaign shared-content candidates and the Encounter Creature pickers read the
`list` part in the browser; Convex serves only the manifest subscription. `contentSnapshots/manifest:catalogue`
(no arguments) returns every PLATFORM source and the caller's own USER sources across Systems, at most 100
(`MAX_TOKEN_SCOPES`), without Campaign shares. Search and filters run in the browser over loaded entries. A head
with `revision > builtRevision` keeps serving its previous build. Detail pages keep one bounded document read
(`content/details`). A Spell entry carries a School label denormalized at build time, which should be removed
when the `SYSTEM` scope lands (D67); a School rename appears after the next build.

#### Builder commit budget

Builder commit database I/O (read plus write) is budgeted at 450 KB for one Class plus 200 KB for each further
distinct Class (D84, [ADR 0036](../adr/0036-versioned-content-snapshots-and-browser-builder.md)); the
single-Class budget is asserted in `characters/commitReadBudget.test.ts`.

## Campaigns

Campaign roots are `campaigns`, with `campaignMemberships` (role, status, access epoch),
`campaignCharacterAssignments` (one Character per player, one Campaign per Character), `campaignPlaySettings`
and a reserved route in `authoredRouteIds`. `shared/campaign/capabilities` is the single capability policy:
OWNER never gains PARTY access and archived Campaigns expose only read capabilities. Mutations derive authority
from the current identity and indexed ownership; roster reads use the tier maximum of twelve players plus one
owner with a sentinel row to reject overflow. Standard maturity is a presentation policy applied server-side
(masking does not rewrite stored text); see [media](media.md) and [transport](transport.md) for presentation
and wire formats.

### Campaign records

The root holds identity, settings, owner, System and status. Its hot fields live in `campaignRevisions`, one row
per Campaign (unique by `campaignId`): `version` (the optimistic-concurrency token every Campaign command
checks), `updatedAt` and `notebookRevision` (a UUID each notebook section write replaces; null until the first).
Every Campaign subscription reads the root through Campaign authority, so a departure, unshare or other version
bump and every notebook write patch only the revision row, and only the queries that return those fields rerun
(D216). A Campaign never exists without its revision row: `campaigns/create` (which copy also uses) inserts both,
and deletion custody deletes it in the transaction that deletes the root.

`campaigns/create` writes the root, revision row, ACTIVE OWNER membership, default play settings and route in one
mutation,
reading the indexed active-owned count against the entitlement (archived Campaigns do not consume host
capacity). `campaigns/archive:archive` checks OWNER authority and the expected version, closes the listing,
expires SUBMITTED applications and PENDING invitations and cancels their notifications in the same transaction;
there is no restore command. `campaigns/update:update` replaces the root, validates catalogue changes against
assigned Characters, saved drafts, shared parents, party and Vehicle Equipment (rejecting, never pruning),
evaluates assigned ACTIVE Sheets for attunement changes dynamically, and updates Social listing versions.
`campaigns/playSettings:save` validates the initiative policies and optional-combat selections against the
Campaign's enabled same-System catalogues and advances only the settings document. `campaigns/copy:copy` starts a
`campaignCopyJobs` job that stages at most eight notebook rows per transaction against a captured
`campaignRevisions.notebookRevision`, then publishes the destination atomically (ADR 0015); source changes abort the
copy and failure, cancellation or deadline cleans only validated unpublished staging.

### Campaign read gates for players — current (D87)

Campaign content is hidden from players until the GM reveals it. Two gates enforce it on Convex reads; GM
reads are never gated, and a refused read is indistinguishable from a missing one.

- **Encounters.** `encounters/readAccess.readMemberEncounter` is the one gate for reading an Encounter by ID
  (projection, timeline, pending, evidence, action choices, scene binding and similar). It reuses
  `requireCampaignAuthority` and `canMemberReadRun` (`packages/encounter-persistence/src/sessionReads.ts`):
  a player reads only the Campaign's ACTIVE Run, or a PREPARED Run paused on a START decision addressed
  to them (the pending read returns a decision only to the member it is addressed to). Prepared, completed and other
  Campaigns' Runs are refused. Actors stay player-visible once the Run is ACTIVE, with the existing
  redaction unchanged.
- **Scenes.** `scenes/liveDocuments.readSceneReveal` returns `PRESENTED`, `SHOWN` or null for a player, and
  the owner always reads everything. `PRESENTED` (the Campaign's presented Scene,
  `campaignScenePresentations`) grants every Scene read. `SHOWN` (see below) grants only the `VIEWER` scope:
  the header (never its compact snapshot), the fog layers and chunks, and the map asset. Entity reads
  (`capture`, `currentEntities`, `recipientActions`) and the transient host stay `MEMBER` scope and refuse a
  shown Scene.
- **Showing a Scene (PLT-8, current).** `campaignSceneShowings` holds at most one row per Campaign
  (`scenes/showings.ts`): the GM `show`s a live Scene as a view-only image or `stop`s it, and any member reads
  `current`. Showing the presented Scene is refused. They are plain Convex writes outside the live room, so
  the presented Scene is untouched. Deleting the Scene definition or the Campaign removes the row, and
  `media/vttMapAssets.readsCampaignMap` grants a player the map while the Campaign presents or shows a Scene
  using it. The player surface is a dismissible read-only viewer in the Tabletop window.

### Campaign content usage

`campaignContentUsage` holds one row per Campaign with `entries` and `scenes` counters (Q18). Triggers in
`lib/mutations.ts` update it on every insert and delete of `campaignNotebookSections` and
`campaignVehicles` (entries) and `sceneDefinitions` (Scenes); the row is removed when both reach zero.
`campaigns/contentUsage.assertCampaignContentAllowed` checks the hosting owner's tier before those inserts and
before a Scene begins and publishes. Copy jobs fail with the same refusal. Unlimited tiers use hidden safety
caps. Content over the limit after a downgrade stays readable and editable. Sessions, notes, chat, Encounters
and shares are not counted, and there is no backfill.

### Sessions

`campaignSessions` (UUID plus an immutable Campaign `sessionNumber`), `campaignSessionAttendance`,
`campaignSessionRsvps`, `campaignSessionNotes` and `campaignSessionReferences`. Creation reads the latest number
and inserts the next with initial attendance atomically; multiple OPEN Sessions are allowed and history is
uncapped. Metadata updates need the exact Session version; RSVP and attendance writes need an OPEN Session and an
ACTIVE Campaign and do not advance the metadata version. Finish (`sessionFinish:finish`) transitions OPEN to
FINISHED and stores a result in `campaignCommands` (Campaign-scoped command UUID with a canonical input
fingerprint, shared with the Clock commands); replay rechecks current authority first. Notes follow the
[note visibility rule](#note-visibility-d87); edits use exact versions, and the GM-only structured kinds
(everything except `NOTE`) are created by the owner and stay `PRIVATE`.
Reference pins are navigation references, not snapshots or access grants. Lists use indexed pages with
continuation cursors and no history cap.

### Campaign clock

`campaignClocks`, `campaignClockSegments`, `campaignClockRecoveries` and `campaignClockRecoveryPrompts`. One
mutation writes the clock and segments, Campaign-scoped Character recovery, history, TABLE audit events in
`campaignEvents`, once-only recovery rows and the `campaignCommands` receipt; a failed boundary rolls back the
whole command. The clock stays a GM-owned Convex record outside the room. An `encounterRuns` trigger in
`lib/mutations.ts` pauses a running clock when a Campaign's set of ACTIVE Runs changes (from a command,
checkpoint or deletion) and sets `pausedForCombat`; once no Run is ACTIVE it resumes only a clock combat paused,
and an explicit GM start or pause clears the flag. The system pause and resume write no receipt and leave the
recovery watermark alone. The resume never adds the fight's time. Right after COMPLETE, the GM's Encounter view
instead offers an ordinary `ADVANCE_CLOCK` by the elapsed rounds at ten a minute (`campaignMinutesForRounds`,
D151), and the GM may decline it. Characters in a fight are not recovered automatically when a boundary passes;
one `campaignClockRecoveryPrompts` row per Campaign, boundary and Character asks the GM, and prompts are removed
when the Character leaves or the Campaign is deleted (`campaigns/clockSegments.ts`, `clockRecovery.ts`).
The same mutation then ends the carried-over grants the new clock minute has reached (D99,
`campaigns/clockGrantExpiry.ts`) on every assigned Character not in a fight, one GM `END_ACTIVE_EFFECT` Sheet
command each, inside the clock's transaction; a fighting Character's are checked on the next advance.

### Campaign notebooks

`campaignNotebookSections` (UUID, text, `visibility`, version, `authorUserId`, `updatedBy`). Updates need the
exact version. Removal (`noteRemoval.ts`) deletes matching Session reference pins and associated attachments
(starting the media grace for the last reference, see
[media](media.md#lifecycle)).

### Note visibility (D87)

One required field, `visibility: PRIVATE | SHARED` (`campaignNoteVisibilitySchema`), covers notebook entries and
Session notes; new notes are `PRIVATE`. There is no GM-only notebook gate any more.

- **Who:** any active member creates. Only the author edits an entry or changes its visibility. The author or the
  GM deletes. An archived Campaign is read-only for every write.
- **Reads:** a `PRIVATE` note is visible to its author and the GM, a `SHARED` note to every active member. The
  rule lives in `campaigns/noteVisibility.ts` (`canViewNote`); a by-ID read, update or delete of a hidden note
  throws the same not-found error as a missing one. Player lists page the sort-order index with a visibility or
  author filter, so a page can come back short or empty while `isDone` is false; the UI loads more.
- **Attribution:** DTOs carry `authorUserId` and `authorLabel`, resolved server-side by
  `readCampaignAuthorLabels`, so a deleted account reads `Deleted user`. The web shows the author on shared notes
  and to the GM on every note.
- **Version contention** is unchanged: exact `expectedVersion`, and a stale writer gets a conflict.
- **Departure:** a leaving member's notes stay. Private ones are then readable only by the GM, and shared ones
  stay shared.
- **Account deletion** (`removeAccountCampaignMemberships`; D91 amends D87): notes the GM can read are Campaign
  history, so private and shared entries and Session notes all stay, attributed to `Deleted user` by the same
  label resolver. Nothing is purged. The GM still reads the private ones; players never do. Entries count
  against the Campaign owner's `campaignEntriesPerCampaign` cap.
- **Copy:** a Campaign copy carries only the copying owner's own entries, keeping their visibility
  (`by_campaignId_authorUserId_category_id`). Other members' entries are never copied.
- **Live room:** there is no live-room path for notebook or Session notes; the Session Durable Object neither
  reads nor writes them, so no room-side filter exists.

### Conversations and chat

`campaignConversations` (TABLE, PARTY, DIRECT), `campaignConversationMembers` (access epoch, monotonic
`lastReadAt`), `campaignConversationEntries` (header: identity, time, `kind`, nullable `rollNonceFingerprint`)
and `campaignConversationEntryPayloads` (text or roll plus identity snapshots). The two entry parts are
authoritative halves inserted together by `insertConversationEntry` (`packages/encounter-persistence/src/conversationEntryRecords.ts`),
used by Convex and the room. `conversations:open`
is an explicit mutation; queries only read existing rooms. History is unbounded and paged (D69): `chat:list`
reads one page through `by_conversationId_createdAt_id` (newest first, UUID cursor) and hydrates only that page.
`unreadCount = min(50, |visible entries newer than lastReadAt|)` is derived from the member row's `lastReadAt`
with no stored counter; 50 means "50 or more". The room commits chat and public rolls while it holds authority
and checkpoints both parts; checkpoints never delete conversation history. The nonce key is Campaign, author and
nonce: same-conversation, same-kind retries return the original entry. Edits expire after fifteen minutes and
unsend after five (a tombstone stays); roll payloads are immutable.

### Campaign rolls

Public rolls enter the TABLE (or a GM-to-player DIRECT) conversation only. Private rolls live in
`userRollHistory` (indexed `by_userId_createdAt_id`), trimmed to the caller's latest 20 on write
(`rollDocuments.ts`); Character-bound private rolls store `gmCampaignRoll` data. `consumedAt` marks hit-die
evidence consumed by a rest. Scoped rest preview and completion read the caller's exact unconsumed HIT_DIE record
from its one stored place (the TABLE or To-GM payload by `roll.id`, or the GM's retained roll). The GM can reveal
a retained roll once (FULL or NOTICE). Private GM calls carry no nonce.

### Announcements

`campaignAnnouncements` are immutable UUID rows, published with bounded `notificationDeliveryIntents` for
eligible recipients in one transaction (Campaign-scoped command UUID plus a canonical fingerprint). Notification
payloads carry fixed safe copy, never announcement text. TABLE reaches active members other than the publisher;
PARTY additionally needs player conversation membership. There is no edit or delete mutation.

### Assignment, departure and ownership

`campaignCharacterAssignments` enforces one Character per player and one Campaign per Character through indexed
reads. The row also stores the GM's Character control grants as an optional `controllerUserIds` (SCENE-5.1, D162): other
active Campaign players the GM lets act for the assigned Character. The grants are the only source for Campaign
grants, read live (never copied into a Run actor), and the assigned player always keeps control. Grant and revoke are
GM-only (`campaigns/characterControllers:setControllers`), bump the CAMPAIGN and PLAY revisions and take effect in
open rooms with the next authorization read; a departing member is stripped from every grant. Departure (`characterDeparture`) retains held
Equipment rules, returns Campaign coins to loose party custody with an OWNER audit, freezes open Runs and deletes
the assignment and the `campaignCharacterStates` overlay in one mutation. When that mutation writes the Character it
also moves an open Builder draft onto the write (retained rules, currency, rebased `baseActiveUpdatedAt`), as the
step's reconcile does, so the draft stays committable while the step is queued (PERF-6.T13). It then queues a `DEPARTED` step
(`campaigns/characterReconcileSteps:run`, PERF-6.T6). In its own transaction the step settles D81: it ends what
the Campaign or its Runs own on the Character (effects, and emptied maintained states in Runs the room does not
hold), trims attunement to the System limit, clamps HP and refreshes stats. It also reconciles personal source
access and repairs a saved draft. Until it runs, a Character that used a removed shared source is still ACTIVE but
not Sheet-ready: Sheet reads report Builder repair and its queued store stores nothing; the step's repair write
queues the store again (D81 amendment, 2026-11-09). A Character the room holds keeps its Run effects until the hold drops
(`settleDepartedCharacters`).
Member departure (`membershipDeparture:leave` and `removeMember`) is one mutation: it runs the assignment
departure, removes the member's direct shares and descendants, queues the remaining Characters' reconciles, evacuates Vehicle
cargo, advances the Campaign version once and writes an OWNER receipt binding actor, target, expected version and
epoch; the membership becomes LEFT and history is retained ([ADR 0013](../adr/0013-campaign-authority-and-collaboration.md)).
Ownership transfer keeps one `campaignOwnershipTransfers` row per Campaign (seven-day offer); acceptance moves the
root owner and both roles in one version with a shared access epoch later than every active membership epoch,
detaches the incoming owner's assignment, closes the listing and expires pending applications and invitations.

### Campaign content sharing

`campaignContentShares` holds Campaign, kind, root, author and timestamps; no document, label or version pin is
stored. Shares require current active membership, a writable Campaign, owned USER-source Homebrew in the
Campaign System and a current publication; Homebrew children need every Homebrew parent shared or an official
parent in an enabled catalogue. Lists recheck author membership and the current publication, omit missing roots
and fail closed on corrupt published data. Unshare is one active-Campaign, expected-version mutation with an
actor-bound command fingerprint: it removes the share and dependent children, retains held Equipment rules on assigned
Characters (an open draft moves with that write, as at departure) and evacuates Vehicle cargo to party custody. For each Character that held or references a lost
source it queues a step (`campaigns/characterReconcileSteps:run`), listed in the receipt's
`pendingCharacterReconcileIds`. The step prunes lost selections from the Character and its draft; an Active
Character that can no longer be prepared becomes a repair DRAFT. Each step has a `campaignCharacterReconciles`
row that its run deletes when it commits, so a duplicate or re-queued run of a settled step is a no-op. A check
(`characterReconcileSteps:verify`, the D215 Sheet store pattern) queues a run that failed or timed out again, up
to three runs; after that the row stays, marked `exhaustedAt`, and is logged once. The step drops sources shared
again or now owned (ADR 0013, 2026-11-08). The
transaction reads at most 200 documents for the largest seeded party. Deleting an authored root runs the same
per-Campaign finalization, reconciling inline. Acquired
Equipment keeps working through server-owned `retainedRulesJson` on held items, so source loss never removes held items;
new copies need current access. It is a pinned record (D163 ruling C, `acquiredEquipmentRulesSchema`): one
EQUIPMENT source for the held leaf and up to 500 SPELL sources its grants name or open, each with its version
identity, a copy of that version's stored compilation (resolved Equipment with no variant chain, or a `CompiledSpell`)
and a small `presentation` block (label, description, quote, materialDescription). The engine hydrates the
compilations as they are, with no compile call, after checking both checksums; views read the pinned prose, so a
held item keeps its description after its source is deleted, and the Sheet lists a Spell only the pinned record
supplies with its pinned prose (view only; it is never a picker option). Equipment Feature prose is not pinned.
`content/compilationMigration` repins rows stored in the earlier raw-document shape from the stored compilation of
the same pinned version.
Parsed retained rules and parsed published Equipment are memoized per module (`createContentMemo`, shared
`contentMemo`) keyed by their exact stored JSON, so only immutable content is memoized; every authorization,
catalogue-binding and scope check still runs on each read, and correctness never depends on a hit.

### Party inventory and currency

`campaignPartyInventories` (version per owner), `campaignPartyItems`, `campaignPartyCurrencyGroups` and
`campaignPartyCurrencies`; these rows optionally carry `vehicleId`, and absence means party ownership. Metadata is
created on the first write and an empty inventory reads as version zero. Owner commands
(`campaigns/partyInventoryCommands:mutate`) require OWNER authority, an ACTIVE Campaign, the expected inventory
version and an actor-bound idempotency key; rows, version and an OWNER `campaignEvents` audit commit together.
Custody transfers move a whole container with its nested items, groups and balances, advancing both owner
versions atomically; replay returns the original event after current authority checks. Currency arithmetic is
exact integer (BigInt where rescaling) across complete indexed batches and fails whole rather than partially.
`campaignCurrencySystems` and `campaignCurrencyDenominations` hold Campaign currency (at most five denominations,
exactly one scale-one base); definition changes rescale every party, Vehicle and assigned Character balance in
the same mutation. The inventory audit read is limited to the latest 180 days; stored events and replay are not
pruned.

### Campaign Vehicles

`campaignVehicles` holds Campaign, authored Vehicle definition ID, nullable label, version and timestamps; cargo
reuses the party tables filtered by `vehicleId` with an independent inventory version. The definition is a
current-source reference, not a snapshot. The owner creates, renames and removes Vehicles; populated Vehicles use
`REMOVE_RETURN_CARGO`, `REMOVE_DESTROY_CARGO` or `MAKE_UNAVAILABLE` (hidden from players, restorable), each with a
replay receipt and the relevant version checks.

### GM Character state and audit

`campaignCharacterStates` stores one Campaign and Character document with the complete adjustment and condition
set and a checksum; missing state means empty and reads never create it. `campaigns/gmWrites`
(`saveAdjustment`, `deleteAdjustment`, `saveCondition`, `deleteCondition`) requires the active Campaign owner and
an exact assignment, uses per-record versions, and writes an immutable `campaignEvents` audit event in the same
transaction (VISIBLE records emit SUBJECT events, SECRET records OWNER events). The Sheet merges Campaign slots
over player slots on every load; no overlay projection is persisted. `campaigns/events:list` checks scope before
using a UUID cursor and uses indexed, visibility-filtered history with a derived `visibleInHistory` flag; payloads
use validated JSON text (see [transport](transport.md#native-campaign-audit-transport)).

### Campaign deletion

[ADR 0032](../adr/0032-campaign-deletion-lifecycle.md). The current owner confirms DELETE against the displayed
version; one transaction validates ownership, ACTIVE OWNER membership and moderation restrictions and creates a
`campaignDeletionJobs` row. From that commit, Campaign reads, writes, admission and new activation reject. The
captured room first drains its outbox and releases authority; only publication from that exact room and epoch may
pass the fence. The job then reconciles Characters (CAMPAIGN_DELETED, assigned Characters in UUID order,
retaining personal data) and admission, removes the root and purges descendants (including `liveCharacterHolds`)
in bounded idempotent steps. The job sends the room a distinct `DELETE_ROOM` control operation, which closes the
room and then deletes its alarm and all its storage (Scene command evidence and Encounter history included);
`CLOSE_ROOM`, which archive also sends, keeps storage. `DELETE_ROOM` is idempotent. A scheduled mutation
reschedules a stalled Deleting job even if the initiating account is gone. Failed cleanup stays inaccessible and retryable. Personal Characters, authored roots, versions
and drafts, owned Blueprints and immutable Social invalidation events remain.

## Accounts

**Identity reads.** `lib/authUserReads` reads the current Better Auth session and user for query handlers;
`lib/identity` adds the stored ban, role and profile checks. `lib/authClient.helper.ts` and
`lib/authTriggers.helper.ts` own the full client and lifecycle triggers. Invitation redemption runs the password hash in a Node action and then one atomic mutation
(account, credential, profile, token consumption).

### Account deletion

Account deletion is staged ([ADR 0040](../adr/0040-staged-account-deletion.md); D199, option 1, departure
first). The HTTP handler passes only its server-derived session token to the private mutation. The mutation
rechecks the session, user, profile, email and password, then commits in one transaction: it revokes every session
and credential and creates an `accountDeletionJobs` row. Cookies expire after that commit, and the request answers
"deletion scheduled". Bounded, idempotent steps then run through `ctx.scheduler`, each in its owning module:
Campaign departure (one membership per invocation, through the existing departure code), Social preparation, media
retention, private Characters, authored content, sources, then Blueprints and user-keyed rows. The last step calls
`deleteUser`; its `auth:onDelete` hook (`lib/authTriggers.helper.ts`) atomically rechecks the gates, deletes the
profile, Social profile and job, and schedules the purges that need the profile gone. A failed step commits
nothing and is retried with backoff; privacy completion is eventual, not one rollback-able transaction. An owned
ACTIVE or ARCHIVED Campaign blocks deletion until it is transferred or deleted. Shared Campaign messages, rolls, Sessions and history remain with the author shown as
`Deleted user` (`readCampaignAuthorLabels`), and retained history grants no access. Account deletion removes the
account's Character actors from ongoing Encounters, retaining past turns and history; audit attribution is the
deleting user, except Runs a live room holds (D74), where removal receipts name the Campaign owner. Under
[ADR 0030](../adr/0030-owner-deletion-and-retained-dependencies.md) no other user's content, reference, pending
decision or retained audit can veto an owner's deletion. FINISHED Sessions never require live private Character
sources. Private Character receipt headers and state are deleted with durable purge intent (see
[Live room and checkpoints](#live-room-and-checkpoints)). Retained uploaded media transfers to the current
Campaign owner with its charge; submitted applications become withdrawn.

### Account usage and entitlements

`accountEntitlements` (server-owned tier, `by_userId`; `setTier` is an internal operator mutation) and
`accountUsageEntries` (resource plus source to owner) with five counters in `userProfiles.entitlementUsage`
and `userProfiles.mediaBytes`. Each source mutation updates its entry and counter atomically through
`syncAccountUsage`. Character and homebrew usage count the distinct union of records and drafts; Campaigns count
active owned Campaigns; public listings count OPEN PUBLIC listings of an active Campaign with the same owner,
including hidden ones; Blueprints count owned Blueprints. `userProfiles.entitlementUsageReady` gates account
reads against incomplete totals. `accountUsageBackfill.run` processes the source tables through the Migrations
component for any deployment with existing profiles (expand, backfill, tighten).

## Social Hub

Tables: `socialProfiles` (private account UUID, independent public Social UUID, adult attestation, viewing
preference, moderation status, version), `socialListings` (one per Campaign; draft, open and closed states, with
`search_discovery`), `socialApplications`, `campaignInvites`, `socialBlocks` (directional pair), `socialReports`,
`socialModerationActions` and the immutable `socialProfileInvalidations`, `socialListingInvalidations` and
`socialBlockInvalidations`. Social DTOs carry no Campaign or account IDs, email or roster; Standard prose is
always masked, and Mature originals reach only the owner or an adult-attested viewer who chose Mature.

### Social rate limits

`SOCIAL_RATE_LIMITS` (`packages/shared/src/domains/social/rateLimitPolicy.ts`) allows applications 10/hour and
30/day, invitations 20/hour, reports 5/hour and 20/day, and block/unblock 30/hour. `lib/rateLimits.ts` maps each
onto a `@convex-dev/rate-limiter` fixed UTC window keyed by user ID and consumes it inside the authorized source
mutation, so a rejected attempt consumes nothing. The same module owns the non-Social user limits (see
[live sessions](live-sessions.md#security-and-limits)); account deletion resets every user-keyed counter.

### Listings and discovery

Draft, open, close and edit mutations (`social/listingDrafts`, `social/listings`, `social/listingEdits`) require
the current Campaign OWNER and an active Social profile. Open checks the live seat tier and, for PUBLIC listings,
the owner's public-slot count over an indexed range; archival and ownership transfer close listings atomically.
Material edits (audience, System, play mode, schedule, location, expectations) expire pending admission and
cancel notifications; harmless edits refresh versions. Editing a CLOSED listing returns it to DRAFT. Discovery
(`social/discovery`, `social/discoveryLists`) reauthorizes every read against current host, symmetric blocks and
Campaign authority; search uses Convex text search over a derived `search: { version: 1, text }` that mutations
maintain, rejects an incomplete cohort until `social/searchBackfill:backfill` completes, and returns the native
split cursor for an oversized reactive range. Keywords are capped at 200 characters and 16 terms.

### Social admission

Applications require OPEN PUBLIC VISIBLE listings on ACTIVE Campaigns; invitations also reach PRIVATE listings
and default to seven days (at most thirty). Acceptance is one mutation that rechecks Campaign ownership,
participant eligibility, both block directions, listing and source versions, publication and moderation, the
invite deadline, PLAYER capacity and the owner's entitlement; it creates or reactivates PLAYER membership with a
strictly newer access epoch and assigns no Character. The four `social/admissionLists` queries page PENDING and
HISTORY groups by indexed participant, status and time; invitation reads take an ISO `asOf` horizon so due
invitations present as EXPIRED without writes (the dispatcher owns those writes). Pair, listing and profile
invalidation events (`socialBlockInvalidations`, `socialListingInvalidations`, `socialProfileInvalidations`)
snapshot a generation on pending requests; the earliest later BLOCK, HIDE or SUSPEND in Convex commit order
(`ctx.db.vars.commitTs`) logically ends the request before decisions, inbox grouping or notification handoff.
Scheduled cleanup (`blockCleanup`, `listingModerationCleanup`, `profileModerationCleanup`) pages 20 requests at a
time, cancels notifications and reschedules. Reversal never revives an invalidated request, and accepted
membership is unchanged.

### Reports and moderation

`social/reports:create` captures bounded server-side evidence and consumes the REPORT allowance in one mutation.
`social/moderation` lists a metadata-only queue by derived priority, and `open` and `review` are mutations that
append a `socialModerationActions` audit row (including a VIEWED audit on every evidence read) with optimistic
version checks. `social/listingModeration` (hide and restore) and `social/profileModeration` (suspend and
restore) change visibility, versions, audit and cleanup scheduling in one transaction. Account cleanup
(`social/accountCleanup:run`) deletes blocks and invitations in bounded pages. Retention (`social/retention`,
internal `preview` and `apply`, operator command `social:retention:convex`) scans at most eight source rows per
page, requires explicit purge confirmation and rechecks eligibility; see the
[retention runbook](../runbooks/social-retention.md).

### Notification delivery

`notificationDeliveryIntents` (one per recipient, workflow and source; the first event is preserved on replay,
and cancellation can create a tombstone before a delayed trigger) and `notificationFeedItems` (latest 25 per
user). Source mutations call enqueue and cancel helpers; intents store the recipient UUID and safe event data,
never email, rendered HTML, announcement text or application messages. The internal dispatcher
(`notifications/delivery:dispatch`, every minute) claims at most ten due intents under a five-minute lease with
at most ten action attempts and bounded backoff, writes the preference-enabled feed item in the claim
transaction, rechecks source eligibility, and renders in a Node action. An atomic mutation enqueues through the
Resend component (intent UUID as idempotency key) and saves the provider ID. `DISPATCHED` means provider
acceptance, not inbox delivery; loss of eligibility before enqueue cancels the intent, while already enqueued
email may finish after a block. Account deletion cancels queued provider messages and schedules intent cleanup.

## Durable jobs and crons

`apps/apis/convex/crons.ts` registers two crons: notification dispatch (every minute) and deletion of superseded content
snapshot objects (daily 09:30 UTC). Everything else is a scheduled mutation owned by its table: Campaign
deletion, Campaign copy, Vehicle cleanup, Character receipt purge, Social cleanup pages, notification intent
cleanup and account purges. Each job rechecks its grant or fence and is safe to run twice.

## Table inventory

Every table in `apps/apis/convex/schema.ts` belongs to a section above.

| Area                                                  | Tables                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account (inline in `schema.ts`)                       | `accountEntitlements`, `userProfiles`, `accountUsageEntries`, `notificationFeedItems`, `notificationDeliveryIntents`, `userRollHistory`, `mediaAssets`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Authored content (`content/schema.ts`)                | `systemVocabularySnapshots`, `authoredImportRefs`, `authoredImageSlots`, `systems`, `systemChecksums`, `contentSources`, `rulesCatalogues`, `authoredRoots`, `authoredSourceFacts`, `authoredSpellClasses`, `authoredCatalogueCounts`, `authoredCatalogueOwnerCounts`, `authoredDrafts`, `authoredDraftPayloads`, `authoredDraftPayloadChunks`, `authoredRouteIds`, `authoredRouteSequence`, `authoredVersions`, `authoredVersionCompilations`, `authoredVersionPayloadChunks`, `reusableDefinitions`, `reusableDefinitionDrafts`                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Content snapshots                                     | `contentSnapshotHeads`, `contentSnapshotObjects`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Imports (`imports/schema.ts`)                         | `importUploadClaims`, `importPreviewSessions`, `importJobs`, `importJobStages`, `importJobResults`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Characters (`characters/schema.ts`)                   | `characters`, `characterPlayStates`, `characterBuildStates`, `characterInventoryItems`, `characterCurrencyGroups`, `characterClassSpellStates`, `characterSpellCustomizations`, `characterCreatureInstances`, `characterVehicleInstances`, `characterNotes`, `characterNoteGroups`, `characterExtraEquipment`, `characterDrafts`, `characterDraftPayloads`, `characterDraftPayloadChunks`, `characterCommandReceipts`, `characterSheetDerivations`, `characterSheetSectionChecksums`, `characterSheetSections`, `characterSheetPendingStores`                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Campaigns (`campaigns/schema.ts`)                     | `campaigns`, `campaignMemberships`, `campaignCharacterAssignments`, `campaignPlaySettings`, `campaignInvites`, `campaignOwnershipTransfers`, `campaignDeletionJobs`, `campaignCopyJobs`, `campaignContentUsage`, `campaignContentShares`, `campaignVehicles`, `campaignCurrencySystems`, `campaignCurrencyDenominations`, `campaignPartyInventories`, `campaignPartyItems`, `campaignPartyCurrencyGroups`, `campaignPartyCurrencies`, `campaignEvents`, `campaignCharacterStates`, `campaignCommands`, `campaignClocks`, `campaignClockSegments`, `campaignClockRecoveries`, `campaignClockRecoveryPrompts`, `campaignSessions`, `campaignSessionAttendance`, `campaignSessionRsvps`, `campaignSessionNotes`, `campaignSessionReferences`, `campaignNotebookSections`, `campaignConversations`, `campaignConversationMembers`, `campaignConversationEntries`, `campaignConversationEntryPayloads`, `campaignAnnouncements`, `liveCharacterHolds`, `campaignLiveAuthorities` |
| Vehicle cleanup (`campaigns/vehicleCleanupSchema.ts`) | `campaignVehicleCleanupJobs`, `campaignVehicleCleanupTotals`, `campaignVehicleCleanupSegments`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Encounters (`encounters/schema.ts`)                   | `encounterRuns`, `encounterRunActors`, `encounterActorSnapshots`, `encounterSourceProjectionFacts`, `encounterSpellPins`, `encounterSceneBindings`, `encounterActorTokenBindings`, `encounterInitiativeRounds`, `encounterInitiativeParticipants`, `encounterInitiativeSides`, `encounterRunCommands`, `encounterRuleOccurrences`, `encounterPendingSnapshotParts`, `encounterRuleReceipts`, `encounterTurnMovements`, `encounterDecisionSkips`, `encounterBlueprints`, `encounterBlueprintUpdates`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Rule effects (`rules/schema.ts`)                      | `characterActiveRuleEffects`, `encounterActiveRuleEffects`, `encounterMaintainedEffectStates`, `encounterSpatialRuleEffects`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Scenes (`scenes/schema.ts`)                           | `sceneDefinitions`, `sceneDefinitionSaves`, `sceneDefinitionEntities`, `campaignScenes`, `campaignScenePresentations`, `sceneLiveStates`, `sceneLiveEntities`, `sceneFogLayers`, `sceneFogSaves`, `sceneFogChunks`, `sceneVisionRevisions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Receipt ledgers (`lib/receiptLedgerSchema.ts`)        | `receiptLedgers`, `receiptLedgerParts`, `characterReceiptPurgeJobs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Social (`social/schema.ts`)                           | `socialProfiles`, `socialListings`, `socialApplications`, `socialBlocks`, `socialReports`, `socialModerationActions`, `socialProfileInvalidations`, `socialListingInvalidations`, `socialBlockInvalidations`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Better Auth tables belong to the component schema (`apps/apis/convex/betterAuth/schema.ts`), not this guide.

## Known gaps

- Catalogue projection cleanup: see [Authored content](#authored-content).
- Chat edit, unsend, GM reveal and recovery lifecycle in the room are unfinished
  ([live sessions](live-sessions.md)).
- Content snapshot `SYSTEM` scope is not built (D67).
- A published-content change reaches a Character's stored stats on its next write; a publish-time recompute is a
  follow-up.
- The decisions behind this guide are recorded in [Phase 8.2 decisions](../handoffs/phase-08-2-decisions.md) and
  the ADRs above; plan slices S9 of [ADR 0035](../handoffs/adr-0035-implementation-plan.md) and
  [ADR 0036](../handoffs/adr-0036-implementation-plan.md) own this guide.
