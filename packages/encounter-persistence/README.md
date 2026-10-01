# Encounter Persistence

`@artificer-toolkit/encounter-persistence` owns the Encounter code that reads and writes live
Encounter state through a document store rather than through Convex directly, so the Session room
can run the same code against its own store ([ADR 0035](../../docs/adr/0035-room-authoritative-live-encounters.md)).

- `store` defines `EncounterStore`: the subset of Convex's transaction database handle the
  Encounter code uses (`get`, `query().withIndex()` with `collect`, `take`, `first`, `unique`,
  `order` and async iteration, `insert`, `patch`, `replace`, `delete`), over the same table and
  index names. Convex binds its explicit logical store adapter; immutable history inserts use the
  existing packed receipt writer in that same transaction.
- `storeTables` exposes the table schemas, stored types and indexes owned by
  `packages/schema/src/projections/encounterStore.ts`. Room replay and checkpoint validation reuse
  those contracts. Any drift from the Convex schema is a compile error wherever `ctx.db` is passed
  as the store.
- `memoryEncounterStore` is the in-memory reference store with Convex's read and write semantics.
  The conformance suite in `apps/apis` checks Convex against it, and checks that replaying a
  command's captured write set (`transaction.writes()`, `apply`) rebuilds the same state. That
  write set is what the room's SQLite log stores, one row per command
  (`apps/session-worker/src/roomEncounterStore.ts`). `counters` and `restoreCounters` carry the id
  and clock counters across a snapshot.

The package imports only the `IndexRange` type from `convex` (a dev dependency), which lets Convex's
handle satisfy the interface without a cast; it has no Convex runtime dependency. `rejectDomain`
throws the package's `EncounterDomainRejection`. Each host translates it once at its function
boundary: Convex's query and mutation builders (`apps/apis/convex/lib/queries.ts` and
`lib/mutations.ts`) rethrow it as a `ConvexError` with the same data.

`transactionReads` memoizes identical reads and derivations within one transaction over any store.

Current source also shares the turn admission, pending and terminal transaction algorithms:
`turnCommandAdmission`, `turnPendingPersistence`, `turnSettlement`, `turnCommitPersistence`,
`initiativeTerminalCompletion`, `turnEffectsPersistence` and `turnResourcesPersistence`.
The Convex adapters supply their actual revision fence, definition reader, mechanics writer and
concentration callbacks. `concentrationChildrenPersistence`, `concentrationCleanupPersistence`
and `maintenanceOwnerPersistence` retain concentration ordering, exact dependent deletion, Character
play clocks and actor mirrors. `turnCapture` and `maintenanceCapture` share native input guards;
the host supplies Scene reads and its dependent-effect pagination. Convex retains its native cursors.
Current room source binds START/ADVANCE and stored turn-owned resolution to those planners and
writers in its SQLite transaction. [basicActionPersistence](src/basicActionPersistence.ts) shares
the basic-action commit with real revision and platform-definition callbacks. Integrated execution
proof remains pending. See the [source batch record](../../docs/validation/phase-08-2/room-command-source-batch-2026-09-30.md).

Current source also shares [liveActionAdmission](src/liveActionAdmission.ts),
[actionPendingPersistence](src/actionPendingPersistence.ts), [actionCommitPersistence](src/actionCommitPersistence.ts)
and [actionEvidenceReceipt](src/actionEvidenceReceipt.ts), plus the action effect/child writers and
[Concentration](src/concentrationResponsePersistence.ts)/[Cleaving](src/cleavingResponsePersistence.ts)
response transactions. The extractions substitute only typed stores and real owning callbacks,
preserving guards, replay, clocks, receipt evidence and write order. The room binds these algorithms
to one SQLite transaction; Convex retains the protected comparators and packed receipt adapter.
Retained-evidence routing selects a planner before canonical admission runs again. Existing
`occurrenceVoid` supplies GM cancellation/refusal and TURN/CLEAVING declines. Native Disarm now
binds its existing planner to shared pending/terminal settlement. Movement integrated proof, general chat/public/TABLE/evidence
rolls and held Sheet frontend/lifecycle integration remain open. Complete paged `DEFINITIONS` hydration now serves first-use,
unpublished and missing IDs from SQLite under SYSTEM/CAMPAIGN pins; PLAY revisions are independent.
These are source-only claims;
no integrated runtime gate is accepted.

[characterSheetReceipts](src/characterSheetReceipts.ts) shares canonical replay fingerprints, private
history integrity, summaries and compact acknowledgements through real read/insert callbacks.
Convex retains packed-ledger receipt storage; the room uses its actual logical indexed receipt rows
inside the same transaction as typed Character play and the journal commit. Native `CHARACTER_SHEET`
dispatch now accepts the nineteen schema-owned play commands, with current owner/GM/assignment and
active unfrozen Run checks, canonical reducer/resource helpers and active-effect projection.
Maximum overrides, rests, notes and structural/customization commands stay outside that lane.
Epoch-fenced Character holds preserve complete checkpoint play during external structural edits.
Socket replay also revalidates the actual checksummed ACTIVE Run/unfrozen Character actor and
current Campaign/System/play ownership. Noninitiators receive required `delta: null`; a pending
Sheet command settles only with its CHARACTER_SHEET delta. The backend/room source is unverified;
frontend routing/views and lifecycle integration remain open.
The host's focused `sheetSlices.liveAuthority` routing read uses only head/holds/typed play for the
owner/GM, returning null for party readers. Direct Convex Encounter commands now fence all command
types under live authority; epoch-fenced transitional `liveSessions` endpoints remain. Native
Encounter/Sheet receipts advance browser room sequence without Scene deltas. Optional authority
`checkpointedAt` changes only on actual acknowledged publication, survives exact retry/drain and is
absent on activation/new recovery; routing metadata returns null before the first acknowledgement.
The web session workspace shows that checkpoint time through `campaigns/queries.liveAuthority`; no
execution proof exists yet for this source provenance.

`conversationPersistence` shares conversation lookup, opening, current access and paired entry writes.
`campaignMemberships` preserves bounded active-roster validation; `rulesChatPersistence` posts rules
messages through the caller's transaction. Convex and the room bind the same algorithms to their
stores and current Campaign authorization. Compact chat metadata hydrates without old message bodies;
general native chat and TABLE roll dispatch remain pending. [tableRollPersistence](src/tableRollPersistence.ts)
and [conversationPresentation](src/conversationPresentation.ts) now share the exact API algorithms;
native general/public/evidence routing still awaits the per-room versus global rate-scope decision.
Canonical author names are supplied from leased room authorization preferences, whose digest changes
with the name; BetterAuth user updates schedule preference invalidation rather than requiring warm
per-command identity reads.
[concentrationRollPersistence](src/concentrationRollPersistence.ts) uses the same paired TABLE
writer and an owning private-roll callback. Native checkpoint appends merge immutable evidence into
the owner's global twenty-roll history without replacing another Campaign's records. This is source
implementation, with integrated execution proof pending.

The pure Scene helpers are implemented in source; integrated execution proof remains pending.
[sceneGeometryValues](src/sceneGeometryValues.ts) owns native geometry normalization and target
values, [sceneGeometryDocuments](src/sceneGeometryDocuments.ts) validates saved movement/spatial
evidence and geometry saves/receipts, and [sceneLiveState](src/sceneLiveState.ts) advances native
live heads while retaining entity/fog counters and setting versions. Convex and the room share these
storage semantics without Convex runtime, generated bindings, database reads or authorization in
the helpers. Convex remains the product persistence boundary; the room authority switch is transitional.
Immutable `SCENE_DEFINITION` hydration supplies the retained base header/entities to the same
canonical current-entity algorithm as Convex; current overrides stay separate checkpoint rows.

Shared movement source now also includes [liveMovementAdmission](src/liveMovementAdmission.ts),
[spatialSceneGeometry](src/spatialSceneGeometry.ts), pending/terminal spatial publication,
movement resolution documents/reads/publication, spatial/reaction/Concentration persistence,
[liveMovementTargetState](src/liveMovementTargetState.ts) and
[movementSettlementPersistence](src/movementSettlementPersistence.ts). Backend adapters retain
their exact signatures and bind actual owning reads/writes. Room geometry reader/staging/capture
and publication now feed `executeRoomSceneGeometry` through `NativeLiveSessionRoom.#commitRoomGeometry`:
planned moves/doors and MOVEMENT responses use the real SQLite store transaction and journal commit,
replacing this branch's per-command Convex Scene commit route. Movement replay and local Character
vision composition are now wired in source; geometry, native Encounter commands and binding compose
vision before journal commit. [sceneBindingPersistence](src/sceneBindingPersistence.ts) shares the
native binding algorithm, now used inside the room's SQLite transaction without external binding
publication. [sceneUndoPublication](src/sceneUndoPublication.ts) preserves staged fog/movement undo;
the room now binds it to persisted command/token/fog/save rows, current Character vision and the
journal transaction before acknowledgement. Shared `parseSceneReferencedFogChunk` validates restored
fog chunks. The asynchronous fast Scene writer delegates undo to the same helper. Native row helpers
are separated in `roomSceneRecords`; retained-history selection scans O(N) rows and has no V15/Q16
measurement proof. Old fast-only undo journal/planner and external recovery/comparators remain for
retirement. General chat/public/TABLE/evidence, held Sheet frontend/rest/live-view
and lifecycle/deletion/recovery cleanup remain transitional or open. Old external recovery and
comparators await final retirement. These extractions have mechanical source comparison
and formatting evidence, with no current integrated execution gate or acceptance advancement.
The [Claude handoff](../../docs/handoffs/phase-08-2-claude-source-first.md) records implementation work
and the unapproved proposals.

`receiptLedger` is the local D70 codec foundation. It packs validated immutable history in canonical
UTF-8, inline for a small ledger or in bounded binary parts for a larger one. It verifies hashes,
public identities and referenced slots; null tombstones preserve surviving pointer indexes. Callers
decode a head's payload before resolving its pointers and retain authorization and held-Character
ownership checks. Convex enters through its explicit native store adapter, which hydrates indexed
receipt headers and atomically publishes or cleans ledger bodies. Checkpoint publication and
integrated native acceptance remain completion work.

The Run stores no projection and a command stores no result (ADR 0035 Amendment 12).
`nativeProjection` builds every projection from the Run's records, `replayReceipts` stores and
replays each command's receipt, and `documents.changedFields` keeps updates to the fields that
changed.

Callers own authentication, authorization and every other guard; functions here receive what the
guards resolved. See the [persistence guide](../../docs/architecture/persistence.md#encounter-persistence-package).

Use `yarn workspace @artificer-toolkit/encounter-persistence typecheck` and `... test` for focused
changes. Build the package before Convex tests or codegen; they import its `dist` output.
