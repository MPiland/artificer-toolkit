# Native live-session Worker

`apps/session-worker` is the Phase 8.2 WebSocket edge. One hibernatable Session Durable Object is addressed per Campaign, and the stable `LiveSessionRoom` export points to `NativeLiveSessionRoom`. While its authority epoch is active, the room owns supported Scene commands and recipient-filtered transient fanout. Encounter tools in the shared `ROOM_LOCAL_ENCOUNTER_COMMAND_TYPES` list now execute local reducers and commit through SQLite in current source; other Encounter paths retain their Convex commits. Character Sheet commands still use Convex.

[ADR 0033](../../docs/adr/0033-campaign-owned-play-and-session-log.md) (implemented locally) addresses one room per Campaign (`idFromName(campaignId)`) instead of per Campaign Session. The name "live session" is retained for this Worker and `liveSessions/*`.

The approved ADR 0035 cutover moves live commands and held Character play to atomic local SQLite commits before acknowledgement. Standalone Scene move, door and undo, native turns, basic actions and ordinary action/Concentration/Cleaving/Disarm paths now use that path in source; fenced delta checkpoints preserve the durable Convex product record. Integrated execution proof, complete S6/S7 authority and S5 shadow parity remain pending. Encounter-bound movement and fog paths still commit through Convex.

The local room-store foundation compacts only an acknowledged epoch/sequence/checksum prefix. Later
committed rows survive compaction and eviction; snapshot reads include opaque records. The
[prefix proof](../../docs/validation/phase-08-2/checkpoint-prefix-2026-09-30.md) covers real Durable
Object SQLite at 11 and 100 actors. [RoomCheckpoints](src/roomCheckpoints.ts) now retains a fixed
prefix input in bounded SQLite chunks, retries its exact checkpoint ID and pins through the existing
inline/staged publisher, and compacts the store with journal acknowledgement in one transaction.
Commands committed during publication survive as a suffix. This integrated source still needs execution proof.

Corrupt or lost SQLite storage now reserves a fresh epoch through the Worker-secret recovery route.
Convex fences the abandoned epoch before local cleanup; one SQLite transaction replaces the aggregate
and removes its old receipt/outbox/pending-upload records. Failed recovery retains old evidence.
Fresh client tickets then hydrate the acknowledged Convex product state before play. This implements
the approved new-epoch recovery path in source; integrated recovery acceptance remains pending.

Raw `SCENE` hydration loads the seven native families (head, entities, receipts, fog layers, fog saves,
geometry saves and fog chunks), preserving tombstones and allocation counters. Each indexed page
checks definition/presentation pins and Scene version; a changed read restarts before replacing the
store. [RoomInputs](src/roomInputs.ts) validates native save/receipt evidence with the shared pure
[Scene parsers](../../packages/encounter-persistence/src/sceneGeometryDocuments.ts), alongside shared
geometry/value and live-state helpers independent of Convex. Display Scene JSON has a separate
`liveRoomStoredSceneStateSchema` content checksum; the journal authority head uses the cumulative
write-set checksum chain.

`SCENE_DEFINITION` hydration also retains the immutable definition header and entities under the
same source/version pins. [Native Scene reads](src/roomSceneRead.ts) join that base with current
overrides through the canonical shared current-entity algorithm; live commands reuse SQLite inputs.

`AUTHORITY` input pages hydrate native Campaign, memberships across all statuses and assignments,
plus the IDs of members whose actual account profiles remain, including LEFT members. Initial
hydration and stale SYSTEM/CAMPAIGN revision reloads populate the shared store; warm commands use
those held inputs. Room authorization now reports the canonical SYSTEM revision, so System inputs
retain their revision-bound reuse. Cached Character Builder structure joins the current local typed
head, play and effects; a Builder refresh preserves existing room play/effects. Authorized input
`RESTORE` creates or rebases an already durable Convex base, refuses replacement of dirty mutable
state/history, and contributes no false `INSERT` history to checkpoints.

`CHAT_METADATA` now hydrates conversations, member access cutoffs and compact entry nonce headers
once per epoch, excluding historical message and roll payloads. Campaign scope, conversation references
and identity/nonce uniqueness are checked before SQLite replacement. Shared rules-message persistence
uses the enclosing command transaction and typed checkpoint deltas. General chat/TABLE roll dispatch
and integrated execution proof remain pending.

Concentration logging now shares paired TABLE entries and native private roll retention. Checkpoints
append hidden checks into the owner's global twenty-roll history, preserving immutable evidence and
refusing cross-Campaign identity replacement. This source integration does not complete general chat.

Room hydration receives private, epoch-authorized SOURCE/CAMPAIGN manifests, validates v2 R2 index and document objects with original publication pins, and keeps their readers with current inputs. Raw storage reads are shared by room hydration and HTTP delivery through `contentSnapshotStorage`. A reload verifies content before replacing stored inputs; canonically equal manifests reuse verified memory objects. System/vocabulary retain their revision-bound reads. `roomCharacterRules` prepares capture-equivalent facts from SQLite and verified snapshots for native turn/basic-action source integration; full browser/native acceptance remains pending.

`roomCharacterRules` now supplies compact snapshot Spell index entries to `nativeCharacterRules`;
only referenced Spell documents are captured and parsed for mechanics. The protected
`/live-sessions/character-rules` capture comparator remains as a fallback. Character preparation
retains each read request/checksum for atomic commit validation, including missing sources and
catalogue membership. Local command preparation joins the caller's transaction: a stale Builder
reload reconciles hit dice and removed resource usage, preserves room play, and applies the existing
level-down HP clamp using Builder maxima. It changes the play clock once only when play changes;
stats-only updates keep that clock. Full held-Sheet routing remains pending.
This source optimization awaits execution proof; publication pages
bound ordinary payload reads, while maximum-size shared parent chains still need local backend validation.

`nativeEncounterRules` uses the shared capture algorithms with room readers for current action source/target facts and Character preparation. The protected `/live-sessions/encounter-rules` capture remains a comparator/fallback. Actor reads include the first effect page; larger effect sets use bounded continuation reads. Existing action mechanics and relationship algorithms run in the Worker; the shared pending/terminal writers retain native identity, complete read-range, Scene and revision checks.

[Native turns](src/roomEncounterTurns.ts) now bind START/ADVANCE and stored turn-owned
`RESOLVE_RULE_OCCURRENCE` to the existing planner and shared pending/terminal writers within the
SQLite transaction. [Basic actions](src/roomEncounterBasicActions.ts) use the same planner and
extracted persistence reducer. `DEFINITION` inputs retain `sourceKind: PLATFORM | USER | null`, so
the platform basic-action gate does not depend on Campaign catalogue membership. Replay uses the
canonical current-member presenter for player projections and occurrences; the durable callback
rechecks lease revisions before journal commit. These are source-only implementations; integrated
execution proof remains pending.

[Ordinary actions](src/roomEncounterActions.ts), [Concentration responses](src/roomEncounterConcentrationResponse.ts)
and [Cleaving responses](src/roomEncounterCleavingResponse.ts) now bind their existing planners and
shared persistence writers in source. [Response routing](src/roomEncounterResponseRouting.ts) uses
retained occurrence ownership and receipt evidence to select an implemented planner; canonical
admission then rechecks the caller, epoch, role and replay. GM cancellation/refusal uses the existing
void classifier, and declining TURN/CLEAVING voids use their real response paths. State, Character
play, effects, paired rules chat, private rolls and receipts join the command's SQLite transaction
and journal commit. [Disarm](src/roomEncounterDisarm.ts) now binds its existing planner and shared
pending/terminal settlement through the same native path. Movement and bound fog remain transitional.

[Room Encounter commands](src/roomEncounterCommands.ts) now execute the deterministic tools in
[the shared room-local list](../../packages/schema/src/api/liveSessionEncounterCommand.ts), using
the existing reducers and blueprint enemy builder for reinforcement. Action undo (`REVERT_LAST_ACTION`)
now uses the shared local action-revert reducer. `UPDATE_ACTOR` joins this path
only without an embedded `characterCommand`; embedded Character Sheet and other rules commands remain transitional.
Initiative rolls use secure room RNG inside the native transaction. Only the initiator receives
roll evidence; other recipients receive their privacy-filtered projection with `roll: null`.
Replay retains the evidence without another random draw. `ROLL_ENEMY_ACTION` uses the same local
transaction and private replay evidence only with `visibility: 'PRIVATE'`; TABLE rolls remain
transitional until native chat ports are integrated.
Their writes and room journal receipts commit atomically, then the room
sends a projection for each admitted recipient. Character actor removal, `COMPLETE` and any actual
Run round change persist a receipt barrier that requires checkpoint publication before acknowledgement,
including after restart/replay. A retry
rechecks current admission and recipient privacy; it uses the original projection at that Run version
or the current projection after later work. Direct Convex execution of every command accepted by the shared predicate is fenced
while Campaign authority is held. The protected Convex comparator remains for S5 shadow parity and
backend fixtures; the room intercepts these commands locally, so it adds no steady-state traffic.
The comparator retires in step 6 after S5.
Recovered unpublished native actor controls and health-display permissions are rebuilt from SQLite.
An evicted checkpoint retry whose response omits required authorization sections makes a full
authorization reload before the cache can admit commands or previews.
Checkpoint responses apply their changed authorization sections and renew the lease without another
read. Unchanged Scene fog chunks retain their published references and payloads. This source
integration still awaits validation; it does not complete S6/S7, chat or the Character hold lifecycle.

## Configuration

Configure these server-only values for each Worker environment:

- `LIVE_SESSION_ALLOWED_ORIGINS`: comma-separated exact web origins;
- `CONVEX_SITE_URL`: the matching Convex HTTP Actions origin;
- `LIVE_SESSION_TICKET_SECRET`: the ticket-signing secret shared with Convex;
- `LIVE_SESSION_WORKER_SECRET`: the independent Worker-to-Convex secret shared with the protected live-session HTTP Actions;
- `RULES_CONTINUATION_SECRET`: the rules continuation sealing secret, identical in Convex and this Worker and never sent over HTTP. It is independent of Better Auth's secret.
- `CONTENT_SNAPSHOT_TOKEN_SECRET`: the content token secret, identical in Convex and this Worker and independent of every other secret. It verifies tokens for private content snapshots.

The `CONTENT_SNAPSHOTS` R2 binding (`wrangler.jsonc`, per environment) names the private content snapshot bucket that Convex's `CONTENT_SNAPSHOT_R2_BUCKET` writes. `GET /content/...` serves it: PLATFORM source objects publicly, others only with a content token in the `Authorization` header ([media](../../docs/architecture/media.md#content-snapshot-delivery-adr-0036-s3--local-implementation)).

Keep both secrets out of browser variables. The protected HTTP boundary compares `LIVE_SESSION_WORKER_SECRET` through the stable `x-artificer-live-session-secret` header. Bootstrap and Scene capture/hydration also require the signed-in user's bearer token. Internal publication and presentation control use the independent Worker secret and their authority fences.

For local development, copy `.dev.vars.example` to an ignored env file and point `CONVEX_SITE_URL` at the existing local Convex site. Then run:

```powershell
yarn workspace @artificer-toolkit/session-worker dev --local --ip 127.0.0.1 --port 8787 --env-file <absolute-path> --types=false
```

The web app uses `VITE_LIVE_SESSION_WEBSOCKET_URL=ws://127.0.0.1:8787`. The local browser gate starts Vite and Wrangler while reusing the existing local Convex backend.

The workspace development command pins `--host localhost` so Wrangler preserves a loopback request
hostname instead of rewriting it to the configured production route. Local snapshot delivery requires
that hostname. The fixture fetch uses manual redirects and refuses non-200 responses.

The local lifecycle supplies `LOCAL_CONTENT_SNAPSHOT_ORIGIN=http://127.0.0.1:8026` and loads `CONTENT_SNAPSHOT_TOKEN_SECRET` from local Convex into the Worker process in memory. This bridges snapshot reads to the same local R2 fixture bucket that Convex writes. The bridge refuses any other fixture origin or a non-loopback request host. Its fixture-only raw response preserves gzip bytes, object metadata and ETags; private reads still require the scoped content token. Omit this variable in managed environments, which use the `CONTENT_SNAPSHOTS` R2 binding.

## Validation and deployment

Run the native package checks before promotion:

```powershell
yarn workspace @artificer-toolkit/session-worker typecheck
yarn workspace @artificer-toolkit/session-worker test
yarn workspace @artificer-toolkit/session-worker build
```

Managed variables and secrets must be set for the selected staging or production deployments before the corresponding authorized deploy. No managed Convex URL is committed in `wrangler.jsonc`.

For standalone `MOVE_SCENE_TOKEN`, `SET_SCENE_DOOR_STATE` and `UNDO_LAST_SCENE_MOVE`,
[the native writer](src/roomSceneCommandPersistence.ts) stages native checkpoint records in
`RoomEncounterStore.transact`; `DurableCommandJournal.commitInTransaction` commits the authority
head and replay receipt beside that write set in one SQLite transaction before `COMMAND_COMMITTED`.
The earliest unpublished receipt timestamp fixes the 120-second checkpoint alarm; later commands
do not extend it. Checkpoint responses renew the existing 240-second authorization lease. Admission,
presentation changes and drains flush checkpoints before crossing their authority boundary. Convex
remains the durable product persistence boundary, and overlapping direct writes stay fenced.
Bound/fog/movement-decision commands retain their transitional Convex-first commits.
Scene receipt payload packing, S5 parity, complete S6/S7 authority, chat, budgets and the final local
lifecycle remain open; the source integration accepts no additional gate case.
Following the user's source-first steering, final-source execution is deferred until integration.
Acceptance remains 51/75 with the frozen 190-criteria scope unchanged. Focused Common/HP reads,
held Sheets/lifecycle, cold definition hydration and general chat/public/evidence rolls remain
open. The proposed note-write aggregate-checksum change awaits the user's decision; current
Character integrity checks remain in place.
Cold `DEFINITION` misses still reach Convex after hydration; eliminating those misses remains open.

Transient previews remain recipient-filtered and ephemeral; they do not enter the command journal or publication outbox.

Live Scene presentation changes use the protected `SET_SCENE_PRESENTATION` control operation. It shares the command order, publishes all prior commands, and calls the fenced Convex presentation setter before invalidating the old Scene and refreshing socket admission. It preserves the authority epoch and replay journal; publication failure leaves the prior presentation in place.

Before deploying the Scene-only protocol with required command-time actor roles over a previous Worker version, drain and release active epochs and verify their outboxes are empty. Pending publications must complete under the previous version; preserve committed replay and publication evidence.

See [live-session coordination](../../docs/architecture/live-sessions.md) and [ADR 0029](../../docs/adr/0029-convex-backend-cutover.md).
