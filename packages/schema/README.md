# Schema package

`packages/schema` defines the Zod-backed contracts shared by transport callers and servers. It is the boundary for API DTOs, authored subject inputs, feature/grant/effect shapes, shared value contracts, vocabulary, and node-runtime request/response models.

## Owns and does not own

- `src/api` contains app-facing request/response contracts for content, characters, node runtime, route IDs, and systems. The node-runtime response validates explicit platform-neutral presentation on every group node, including array-only `focused` editing.
- `src/subjects`, `src/features`, `src/grants`, `src/effects`, `src/shared`, and `src/vocabulary` hold reusable domain contracts and parsing helpers.
- Package exports provide narrow subpaths such as `@artificer-toolkit/schema/api/characterBuilder` and `.../subjects/class`.
- `src/projections` defines persisted contracts and complete capture assembly, including the typed Character operational records. It does not own database orchestration, React form state, or engine resolution.
- `projections/encounterStore` owns the shared room table schemas and index definitions.
  `api/liveSessionCheckpointJournal` fences committed journal extraction and acknowledged-prefix
  compaction, and
  `api/liveSessionCheckpointRecords` defines public identities, mutable deltas and append-only
  evidence for checkpoint packing. These contracts do not import executable mechanics.
- `api/liveSessionCheckpointFence` defines scalar authority persistence independently of the full
  mechanics graph. `api/liveSessionCheckpoint` composes checkpoint deltas/history and the current
  authorization response. Actor identities include their Encounter UUID; play checkpoints exclude
  the Convex-only stream clock.
- `api/liveSessionCheckpointScenes` defines Scene source/presentation pins and normalized live
  deltas with native public keys. Complete fog save/chunk/receipt references share checkpoint
  publication; source definitions remain authored inputs. Pending evidence may preserve the Scene
  version. Native Scene receipt payloads retain their current format until their packing slice.
- [api/liveRoomInputs](src/api/liveRoomInputs.ts) defines the raw `SCENE` input pages, implemented
  in source with integrated execution proof pending. Its cursor carries a fixed family position,
  native pagination cursor and optional fog-save/chunk continuation. Pages preserve native live
  state counters, entity tombstones, command receipts, fog layers, published fog saves/chunks and
  geometry saves. Every page carries Scene/definition-save identity, definition/presentation versions
  and the live Scene version. [api/liveRoomInputsBatch](src/api/liveRoomInputsBatch.ts) joins pages
  only while those pins match, leaving a changed page for the caller's whole-read retry.
- `projections/receiptLedgerPersistence` defines scalar ledger metadata, stable entry pointers and
  binary storage types. Convex's native byte validator and the shared codec enforce binary fields.

## Key flow

Convex public functions validate inputs and outputs at the generated boundary. Web adapters call those
functions through focused generated references and render the shared DTOs; Worker HTTP actions validate
the same contracts before using native domain functions.

## Invariants

- Prefer a shared schema over an ad-hoc local shape.
- Contracts use Zod Mini's functional composition through `src/zod.ts`, which configures the existing English validation messages for every focused import. Keep parsing, checks, transforms, defaults, issue paths and enum ordering equivalent when composing schemas. Generic consumers accept `zod/v4/core`'s `$ZodType` and use its free parsing functions (or Mini's); they must not require classic fluent builder methods. Validation error handling recognizes core `$ZodError` so both Mini and remaining classic schemas retain the same error mapping.
- Storage-facing schemas import scalar identities from narrow modules; importing an executable rules or geometry graph for an enum can break Convex schema evaluation. The complete schema is checked by `apps/apis/convex/schemaBoundary.test.ts` without environment access and without the executable rules kernel. Rules limits and checksum helpers use their existing focused subpaths.
- Casting-time values are owned by `subjects/castingTime`; catalogue metadata imports that leaf directly. `subjects/shared` preserves its existing export without making catalogue reads load Feature validation.
- Character history entries and pages are owned by `api/characterHistory`; they depend on Sheet value contracts, not full command, panel or response schemas. Stored receipt readers use that narrow module. Existing command/data exports continue to expose the same schema objects.
- `api/encounterData` owns Encounter projections, Blueprint inputs and read contracts. Storage/read consumers import it directly; `api/encounters` owns action commands and explicitly re-exports the data contracts. The data module must not import action commands or Character Sheet commands.
- Reuse identical immutable scalar schemas within large contract modules. Repeated Zod v4 construction contributes to Convex's module-initialization memory limit; derived bounds must remain local to the field that requires them.
- `src/shared/rulesExecution.ts` is the public compatibility facade for Rules execution contracts. Focused `ruleExecution*.ts` leaves own core graphs, protocol and evidence, effects, application outputs, initiative, turn, spatial, result, and pending-state responsibilities. Leaves must import each other directly and must not import the facade; backend value consumers should use the narrowest owning leaf when they do not require the complete public surface.
- Pending contexts live in the focused direct-action, spatial, turn, initiative and optional-combat leaves. `ruleExecutionPendingApplication` composes their ordered union; `ruleExecutionPendingSnapshots` owns kernel snapshots and aggregate choices; `ruleExecutionReceiptCommandMetadata` owns non-executable receipt metadata. The compatibility facade contains explicit re-exports only.
- Keep authored input contracts distinct from API response DTOs and from compiled/engine data.
- Keep presentation metadata in the node-runtime contract; do not add web-local copies of the presentation vocabulary.
- Keep the eight authored root DTOs exact across shared models, node maps, persistence hydration, and API transport; nested content remains part of its owning root payload.
- Character intent, Builder draft/preview/commit, and Sheet command contracts are explicit and should not be collapsed into generic content-authoring DTOs.
- Public Sheet command responses contain only Character UUID, stream version and optional history/result. The separate execution DTO retains a full Sheet only for transitional private transaction orchestration.

## Focused validation

Use `yarn workspace @artificer-toolkit/schema test` for parsing/contract changes and `yarn workspace @artificer-toolkit/schema typecheck` for type changes. Add or update the nearest contract test when a DTO changes.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Transport boundary](../../docs/architecture/transport.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
- [Rules Runtime](../../docs/architecture/rules-runtime.md)
