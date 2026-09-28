# ADR 0036 implementation plan

> Status: approved direction; S1 and S2 implemented locally (2026-09-27), S3, S4, S5, S6 and S7 (2026-09-28). This plan implements [ADR 0036](../adr/0036-versioned-content-snapshots-and-browser-builder.md). It was built from a read-only mapping of `codex/phase-08-2-convex-cutover` at `c8d409352`.

## What the code does today

- **Server resolution.** `resolvePayload` (`apps/apis/convex/characters/builder.ts`) calls `loadCharacterBuilderContext` (`builderContext.ts`) in `'selectors'` scope. That reads:
  - the System and the Character's sources;
  - the selected roots and their parents;
  - the whole Spell catalogue, for casters;
  - a feature scan across every visible root;
  - every visible RACE, CLASS, BACKGROUND, EQUIPMENT and FEAT root, up to 500 per kind, with Campaign-share checks.
- **Who calls it.** `useLatestCharacterResolution` calls `builder.resolve` once per edit. `builder.get` is the subscription, re-run after each draft save. `builder.preview` and `commit.commit` use the `'resolution'` scope, which still loads the full pools.
- **The portable seam.** `packages/rules-runtime/src/character/contextPreparation.ts` provides `prepareCharacterRuleContext(character, system, prev, readers)` and `collectCharacterRuleSourceSelections`, which the session worker already uses.
- **Reusable mechanisms.**
  - Change triggers in `apps/apis/convex/lib/mutations.ts`.
  - The HS256 ticket pattern: `liveSessions/tickets.ts` signs, and `session-worker/src/ticket.ts` verifies.
  - Media uses `@convex-dev/r2` presigned GET URLs (ADR 0012/0028).

## Design summary

- **Snapshot scopes:** `system/{systemId}`, `source/{contentSourceId}` and `campaign/{campaignId}` (the shares that pass `readCampaignSharedPublication`).
- **Kinds:** RACE, CLASS, BACKGROUND, EQUIPMENT, FEAT, SPELL, CREATURE and VEHICLE. Features live inside their roots.
- **Parts:** `index` for pickers, and `documents` for preview, fetched lazily per kind.
- **Object key:** `v1/{scope}/{scopeId}/{kind}/{part}/{sha256}.json`, stored gzipped.
- **Convex tables:**
  - `contentSnapshotHeads`: per scope, the hash, byte length and root count per kind and part, plus `revision`, `builtRevision` and `buildScheduledAt`;
  - `contentSnapshotObjects`: drives cleanup.
- **Dirty marking:** from triggers on authored roots and versions, shares (with a new `campaignContentShares.by_subjectId` index), systems and vocabulary, import visibility, content sources and rules catalogues.
  - One mark per scope per transaction.
  - The build is scheduled 2 s later, to coalesce bursts.
- **Build action:** incremental against the previous `documents` object. It PUTs only new keys, then calls `commitBuild`, a compare-and-set on `builtRevision` that reschedules itself if the scope went dirty again.
- **Cleanup:** a daily cron deletes objects superseded for more than 7 days.
- **Delivery:**
  - `GET /content/v1/...` on the session worker, with a separate private R2 binding, `CONTENT_SNAPSHOTS`.
  - Public and immutable for System and PLATFORM scopes.
  - Token-gated and privately cached for USER and Campaign scopes. The token is an HS256 JWT from the Convex action `contentSnapshots.issueAccess`, with secret `CONTENT_SNAPSHOT_TOKEN_SECRET`, audience `artificer-content`, a 10-minute TTL, and claims `sub`, `userSourceIds` and `campaignIds`.
- **Manifest query:** reuses `readCharacterSources` exactly. It reads about 5–12 small documents and returns the heads, the Campaign's content maturity and the build freshness (`revision` against `builtRevision`).
- **Browser:**
  - `rules-runtime/character/snapshotReaders.ts` (`createSnapshotReaders`) and a pure `assembleCharacterBuilderContext`, extracted from `builderContext.ts`.
  - Everything runs in a lazy Web Worker with a debounce of about 150 ms.
  - Bundles are verified by hash and kept in Cache Storage.
  - No evaluation during SSR.
- **Commit:** `loadCharacterReferencedContext`.
  - It reads only referenced equipment, feats, spells and the selected subclass.
  - Features are found by provenance, with a verified client hint for standalone features.
- **Draft save:** structural only, with the payload replaced in place.
- **Room (ADR 0035):** at hydrate, a Convex-authorized manifest for the Run. The room reads R2 through its binding, caches parsed bundles by hash, and reloads on `INVALIDATE_INPUTS`.

## Snapshot format (S1, current)

- **Contracts:** `packages/schema/src/api/contentSnapshots.ts`. The build, key and index projection live in `packages/rules-runtime/src/contentSnapshots.ts`, so Convex and the Worker can both import them.
- **Object:** the header fields `{format: 1, scope, scopeId, kind, part}` plus `roots`, ordered by root id. The part schema validates the object when it is built. The SHA-256 covers the canonical JSON (`canonicalizeJson`), header included.
- **Key:** `v1/{scope}/{scopeId}/{kind}/{part}/{sha256}.json`, with the scope and kind in lowercase (for example `v1/system/<id>/race/index/<sha>.json`).
- **Index entries** hold each root's own picker facts, taken from today's catalogue records:
  - **RACE:** category, parent, description, selection mode, size, speed references, and Ability Score Increase facts from the root's own features;
  - **CLASS:** category, parent, description, subclass level, hit points, multiclass requirement groups and proficiencies;
  - **BACKGROUND:** description, proficiencies and feature labels;
  - **EQUIPMENT:** the stored effective option projection (`equipmentOptions.builder`) plus the parent id;
  - **SPELL:** the spell catalogue record fields;
  - **FEAT, CREATURE, VEHICLE:** id and label.
- **What readers join:** anything resolved through the System vocabulary or another root. That covers speed and skill labels, proficiency target labels, and a subrace's inherited facts, because those can change in another scope.
- **Head:** `{scope, scopeId, revision, builtRevision, kinds}`. `kinds` maps a kind to its `index` and `documents` references (`sha256`, `byteLength`, `rootCount`). A kind with no roots has no entry. `buildScheduledAt` is table bookkeeping for S2 and is not part of the contract.

## Heads, build and cleanup (S2, current)

[Persistence](../architecture/persistence.md#content-snapshot-heads-and-objects-adr-0036-s2--local-implementation) describes the protocol. Where S2 differs from the design summary above:

- **Scopes.** Every content source, the SRD's PLATFORM source included, is a `SOURCE` scope, because Campaign rules catalogues select PLATFORM sources and snapshot documents carry no source id. A `SYSTEM` scope will hold only System-level data with its own object format, added when a reader needs it ([D67](phase-08-2-open-questions.md#decisions-to-review)); no `SYSTEM` head is built yet.
- **No new share index.** Marking finds a root's Campaigns through the existing `campaignContentShares.by_subjectKind_subjectId_campaignId` index; a `by_subjectId` index would duplicate it.
- **Not marked:** Systems, vocabulary and rules catalogues (no built scope contains them), and version payload chunks (their version is marked).
- **Full rebuild.** Each build rereads every kind of its scope. Unchanged kinds keep their keys and upload nothing; incremental rebuild from the previous `documents` object is not implemented.
- **Unshared parents.** A shared child whose parent share is gone is excluded, where the Builder's `readCampaignSharedPublication` throws.
- **Measured (convex-test, warm, full SRD source scope, 2026-09-27).** 1,057 roots in about 3,200 document reads and at most about 15 MB (an upper estimate: whole roots, versions and payload chunks). Read as one query per kind, CREATURE took 951 documents, about 5.6 MB and 616 ms (EQUIPMENT 538 ms, SPELL 451 ms): too close to the 1 s query limit once the self-hosted runtime's 2–4× slower execution is counted. The build therefore reads 100 roots per query, about 60 ms of warm Node for CREATURE. The whole build takes about 2.2 s warm (3.4 s cold), against the 10-minute action limit. The 16 objects total 5.8 MB of canonical JSON and 0.66 MB gzipped; CREATURE documents (2.1 MB) and CLASS documents (1.7 MB) are the largest.

## Delivery (S3, current)

[Media](../architecture/media.md#content-snapshot-delivery-adr-0036-s3--local-implementation) holds the authorization matrix. Where S3 differs from the design summary:

- **Names.** The token action is `contentSnapshots/access:issueAccess`; the route is `GET /content/{object key}`.
- **Which objects are public.** The build writes R2 custom metadata `access: public` on PLATFORM source objects; the Worker serves anything without it as private, and a token grants only `SOURCE` and `CAMPAIGN` scopes (a future `SYSTEM` build would mark its objects public). Chosen over a key prefix because it leaves the S1 key format and S2 bookkeeping unchanged, and it is safe: the build is the bucket's only writer, a source's kind never changes, and every key names its scope. The cost is one R2 read before a tokenless request for a private object is refused.
- **Token scope.** Own USER sources in every System and active memberships of Campaigns not being deleted, each at most 100; more fails closed.
- **No edge cache.** Public objects rely on the browser cache (`immutable`); the Worker never uses the Cache API, so each browser miss costs one R2 read. Add the Cache API for public objects if R2 reads matter.
- **Not wired yet (S6).** `scripts/validatePreStagingLocal.mjs` does not pass `CONTENT_SNAPSHOT_TOKEN_SECRET` to the local Worker, and the local Worker's `CONTENT_SNAPSHOTS` is a Miniflare bucket, not the local R2 fixture the local Convex build writes to. S6 must bridge the two before a browser reads local snapshots.
- **Local data.** Objects built before S3 have no public marker, and a build never re-uploads an existing key; reset the local snapshot tables (or the local deployment) so the SRD objects are rebuilt.

## Manifest (S4, current)

[Persistence](../architecture/persistence.md#content-snapshot-manifest-adr-0036-s4--local-implementation) describes it. `contentSnapshots/manifest:manifest({systemId, characterId?})` calls `readCharacterSources`; without a Character it calls `readSystemCharacterSources`, the non-Campaign branch extracted from it. It returns each source's kind and head, and the Campaign's id, `contentMaturity` and head. The contract is in `packages/schema/src/api/contentSnapshots.ts`.

## Snapshot Builder evaluation (S5, current)

[Rules runtime](../architecture/rules-runtime.md#portable-live-preparation) describes the seam. Where S5 differs from the design summary:

- **Signature.** `assembleCharacterBuilderContext(character, context, catalogueReaders, scope)` in `character/contextPreparation.ts` takes the context `prepareCharacterRuleContext` returns, because Convex wraps that context with its source identities and publication cache. `createSnapshotReaders(objects)` returns one object that implements both `CharacterRuleContextReaders` and `CharacterBuilderCatalogueReaders`. `scope` is `selectors` (`builder.resolve`) or `resolution` (preview and commit); the `active` Sheet scope keeps `prepareActiveCharacterBuilderContext`.
- **Index-shaped catalogue.** `createCharacterBuilderCatalog` now takes Race, Class and Background picker facts in the snapshot index shape instead of documents. The Convex readers convert documents with `toContentSnapshotIndexEntry` (Races through `toCharacterBuilderRaceCatalogSource` after parent resolution), so the picker records come from one mapping on both paths. Equipment readers return index entries, or documents when a stored projection is missing (Convex only).
- **Readers join.** A subrace takes its base Race's size and speeds, and the base Race's Ability Score Increase facts before its own. Vocabulary labels resolve through the System passed to `prepareCharacterRuleContext`, since the System is not snapshotted yet (D67).
- **Merge.** Roots merge by id across the manifest's objects, and a `SOURCE` root shadows a `CAMPAIGN` share of the same root, as `readCharacterSourceRoots` does.
- **Also extracted.** `character/builderPayload.ts` (`resolveCharacterBuilderPayload`) holds the resolution-to-payload chain that `builder.ts` ran inline. `buildContentSnapshotKind` (`contentSnapshots.ts`) builds both parts of one kind for the build action and the tests.
- **Parity (`characters/builderSnapshotParity.test.ts`).** Snapshot objects come from the S2 `readScopeKind` pages and `buildContentSnapshotKind`, parsed back through the part schemas. The server payload comes from `builder.resolve`. The corpus is every SRD Race and Class, the Acolyte, the Grappler, every SRD Equipment item and Spell. It covers a fighter, a wizard with an SRD subrace, a fighter 3 (Champion) / wizard 2 multiclass, a Feat feature plus a standalone feature found by the feature scan, a Homebrew parent and child Race, a lost Background owned by another user, and Equipment without a stored projection (the Convex document path). A second case edits a Campaign-assigned Character with a GM's Homebrew subclass shared to the Campaign, an unshared Background and the `STANDARD` text policy. Every payload is deep-equal, and every snapshot document equals `parsePublicationDocument(readPublishedDocument(...))`. A deliberately broken subrace join fails the test.
- **Pool size (uncertainty 1).** No rule clamps a required count to the candidate count. Two outcomes depend on whether a pool is empty: `SUBCLASS_SELECTION_REQUIRED` needs at least one visible subclass of the Class (`builderResolution.ts`, `getAvailableSubclassesForClass`), and a chosen grant with no catalogue candidates raises the blocking `CHOSEN_GRANT_OPTIONS_UNAVAILABLE` (Spell, Feat and Equipment grants read `catalog`). Both read the complete pool, which the snapshot readers supply, so no count fact was added. A count fact would only be needed if S6 evaluated from a partial or paginated pool.
- **Known differences, not in the corpus.**
  - Convex throws past 500 roots per kind; the snapshot readers have no bound.
  - A Campaign-shared child whose parent share is gone throws in Convex and is excluded from the snapshot (S2).
  - The feature scan visits roots in index order in Convex and in id order in snapshots, so several standalone features from different roots may reach `registry.features` in another order.
  - A scope that is still rebuilding serves the previous build's objects; commit stays authoritative.

## Browser Builder evaluation (S6, current)

[Character](../architecture/character.md#browser-builder-evaluation-adr-0036-s6--local-implementation-acceptance-pending) describes the flow. Where S6 differs from the design summary:

- **Edit drafts.** An edit draft evaluates against the active Character it replaces (`previousCharacter`: replacement allowances and the change preview read it), from the new `characters/builder.activeCharacter` query, which shares `builder.get`'s ownership and route checks. Its `_generated/api.d.ts` entry was written by hand in the codegen format; the next local codegen push regenerates it. The web app no longer calls `builder.resolve` or `builder.preview`; S9 deletes them.
- **System input.** The System comes from the existing `content.systems.get` query (D67); no new query.
- **Shared evaluation.** `rules-runtime/character/snapshotBuilderEvaluation` (`resolveSnapshotCharacterBuilderPayload`, `previewSnapshotCharacterBuilder`) is what the worker runs. `toCharacterBuilderPreviewOutput` (`builderPayload.ts`) now builds `builder.preview`'s output too, so both paths share it.
- **Lazy readers.** `createLazySnapshotReaders(indexObjects, loadDocuments)` wraps `createSnapshotReaders`: the index names each root's kind, so a publication read loads that kind's documents; parents load their kind; the feature scan loads every feature-bearing kind; the Spell catalogue loads SPELL. A Fighter loads RACE, CLASS and BACKGROUND documents only.
- **Debounce.** The Builder renderer's existing 150 ms debounce applies; the worker does not add one. The worker keeps the readers, and the documents they loaded, until the manifest's hashes change.
- **First evaluation.** When the manifest and System arrive, the Builder re-resolves the opened values locally, which also prefetches the index objects; each manifest change re-resolves again.
- **Object integrity.** The browser checks the SHA-256 and the header, and does not re-parse objects with the part schemas: the hash binds the object the build validated.
- **Chunk gate.** A Vitest test (`builderEvaluationWorker.size.test.ts`) builds the worker entry alone with Vite, since the repo has no bundle-size tooling. Measured (2026-09-28): 161 KB gzipped in the test and 162 KB gzipped (597 KB minified) for `builderEvaluation.worker-*.js` in the web app build, one self-contained chunk absent from the server bundle.
- **Evaluation time.** Warm evaluation over the S5 corpus through the lazy readers, in Node: p95 3.5 ms (6 scenarios x 5 runs), against the 100 ms gate. Cold time (first fetch and parse of a manifest's objects) is not measured.
- **Not bridged locally.** S3's local gaps remain: the local Worker gets no `CONTENT_SNAPSHOT_TOKEN_SECRET`, and its `CONTENT_SNAPSHOTS` is a Miniflare bucket, not the fixture the local Convex build writes. The browser path is covered by unit tests, not yet by a local end-to-end run.
- **Sign-out.** `clearPrivateContentSnapshots` drops cached content tokens, terminates Builder workers and deletes the whole snapshot Cache Storage (public objects are simply fetched again). It runs after a successful sign-out, before the post-sign-in redirect, and when the root session check sees another identity.

## Referenced commit (S7, current)

[Character](../architecture/character.md#referenced-commit-reads-adr-0036-s7--local-implementation) describes the loader. Where S7 differs from the design summary:

- **Loader.** `characters/referencedContext.ts` (`loadCharacterReferencedContext`) runs `prepareCharacterRuleContext` through `loadCharacterRuleContext` in referenced mode, then `assembleCharacterReferencedBuilderContext` (`rules-runtime/character/contextPreparation.ts`). `commit.commit` builds one `CharacterReferencedReads` (hints, a root cache by public id, a publication cache, unreadable ids, and the System and source access once read) and passes it to `prepareCharacterBuilder`'s `referenced` option; preview, resolve and the Sheet keep the pool scopes until S9.
- **Catalogue.** Race, Background and Class records come from the registry, as in the `resolution` scope. Equipment is read by id (inventory, starting-equipment selections, chosen-grant targets) with its parents; Feats by id; Spells by id through `readSpellCatalogue(referencedSpellIds)`, whose ids are the Spell selections, learned and prepared state, chosen-grant targets and the Spells granted features name (`collectContextSpellIds`). Pool readers ignore the argument. A first-create reload after starting-equipment materialization reruns the loader over the same caches, so it reads only the materialized Equipment.
- **One read per root.** The parent readers (`requireClassParent`, `requireRaceParent`, `requireEquipmentParents`) and `captureAcquiredEquipmentRules` take an optional root lookup, and `retainCharacterEquipmentRules` takes the commit's caches, so a commit reads each root once. The stored-stat evaluation in `writeCharacterRecord` reuses the commit's context (`sourceContext`) instead of loading the `active` scope, which read every Class root (about 450 KB for the SRD) whenever a subclass was due.
- **Features by provenance.** A missing feature is read from the root its acquisition names (`CLASS`, `SUBCLASS`, `RACE`, `SUBRACE`, `BACKGROUND`, `FEAT`; `OPTION` follows its parent acquisition). Other provenances (`MANUAL`, `FEATURE`, `ANCESTRY`) need a hint in `characterBuilderCommitInputSchema.featureSourceHints` (`{featureId, rootId}[]`, at most 500, each feature once). The hinted root must be readable (`SOURCE_UNAVAILABLE` otherwise) and hold the feature among the features `prepareCharacterRuleContext` takes from it; a missing hint fails the commit. Hints are ignored where the provenance names a root. The browser sends the hints: the Builder worker's finalization preview returns `collectCharacterFeatureSourceHints` (`character/featureSourceHints.ts`) for the previewed Character, which shares `characterFeatureProvenanceRootId` and `publicationFeatureIds` with the server and takes the least root id when several roots hold a feature. `commitReferencedContext.test.ts` checks that the hints derived from the snapshot readers equal the server's resolution over the SRD pool for `MANUAL`, `FEATURE` and `ANCESTRY` acquisitions (an `OPTION` acquisition under a Feat needs none), and that the referenced commit context accepts them.
- **Fail closed.** `SOURCE_UNAVAILABLE` (`ConvexError` data `characterBuilderCommitErrorDataSchema`: `code`, `subjectId`, `message`) when a selected Race, subrace, Class, subclass, Background, Feat acquisition, starting-equipment selection, inventory item without retained rules, or read Spell selection or state Spell is not readable content of its kind, or when any other referenced root exists but cannot be read. Held Equipment with retained rules, Creatures and Vehicles keep their existing source-loss handling. The complete pool reports the same cases as blocking validations, so commit refuses either way; only the error differs.
- **Pool-size rules.** Emptiness facts are witnesses: one readable record from the complete pool, added to the restricted catalogue.
  - `SUBCLASS_SELECTION_REQUIRED`: for a class row at its subclass level with no subclass selected, `findSubclass` walks `authoredRoots.by_system_kind_parentClassId` (after `assertClassRelationshipsIndexed`) to the first root in the Character's pool whose publication is a readable subclass of that Class.
  - Chosen grants: `getChosenGrantWitnessQuestions` (`chosenGrantChoiceResolver.ts`) asks, for each chosen grant with no option in the restricted catalogue, for one candidate (Spell, Feat or Equipment, or an Equipment property); listed candidates are read by id, `ALL` grants scan the pool in `readCharacterSourceRoots` order and stop at the first match. It also asks, for each selected Equipment property and each property grant (granted or chosen) that could offer it, for an Equipment record carrying it, because the property's validity and its "granted by" disabled reason depend on that. Vocabulary grants (skills, languages, saves, senses) do not depend on the pool.
  - **Why this is exact.** Every chosen-grant option set and the subclass list are monotone in the catalogue, and every selected id is in both catalogues. So the restricted options of a choice equal the complete options on every selected id, and each emptiness outcome is decided by one witness. Starting-equipment and Spell-selection checks look up selected ids only. The Spell catalogue also feeds `spellPreparationCatalog`, which changes `availableSpellIds`, but `preparedSpellIds` keep only state and selected Spells, which both catalogues hold, and commit persists no evaluation output. Scans stop at the first witness; one that finds none reads the kind's pool, bounded at 500 roots as the pools are, and only a Character that cannot be ready (or whose chosen property has no carrier) reaches that case.
- **Differential test (c)** (`characters/commitReferencedContext.test.ts`). Both paths run `prepareCharacterBuilder` with `finalize` over the same draft, and the readiness, validations, outstanding choices and reconciled Character must be deep-equal; a referenced `SOURCE_UNAVAILABLE` must meet a complete pool that is not ready. The corpus is the S5 scenarios (the standalone feature with its hint), a Fighter 3 with and without a visible subclass (the Champion moved to another user's private source), a Hill Dwarf whose chosen Tool grant lists a Tool no source holds and then no readable Tool at all, a High Elf wizard with its chosen cantrip unselected, and 24 seeded intents over the SRD (random Race, subrace, Class, level 1–5, subclass, Background, Spell selections, the Feat and standalone acquisitions, and chosen-grant selections sampled from the complete pool, some over their count).
- **Read budget** (`characters/commitReadBudget.test.ts`). A Proxy over `ctx.db` counts every document a transaction returns at its JSON size, per table. `commitCharacter` is the mutation handler, extracted so the test can run it with the counting context; the Characters (Human Acolyte, level 5, SRD starting equipment) are made ready by filling the Builder's outstanding choices. Measured (convex-test, 2026-09-28):
  - **Fighter 5 (Champion):** 106 documents, 145 KB. The Fighter root alone is 41 KB, because `authoringSources` holds its feature rows. The System is 31 KB.
  - **Wizard 5 (Evocation), 4 cantrips and 14 spells:** 148 documents, 257 KB; Spell roots and versions are about 7 KB per Spell.
  - **The written row is not reread.** `writeCharacterRecord` evaluates the stored stats over the row it wrote, `listActiveRuleEffects` skips its owner check when `loadCharacterSheetFacts` holds the row (`ownerVerified`), and `syncAccountUsage` takes the owner commit verified. Before this, those three read the new Character row back: 116 KB for the Fighter and 85 KB for the Wizard. The budget test counts every read.
  - Before the shared caches the Fighter commit read 1.1 MB (a second full rule context for materialization, the `active`-scope Class pool for the stats, and repeated parent and retention reads).

## Budgets (estimates to verify in the slices)

| Action                                        | Convex I/O                                                           | Network                                                         |
| --------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Edit                                          | 0                                                                    | 0 when cached                                                   |
| Picker open                                   | 0                                                                    | Cache miss: one Worker request, 5–300 KB gzipped, once per hash |
| Builder open                                  | Manifest ~10 KB, token ~5 KB, draft ~15 KB                           | Cold start about 1 MB gzipped (SRD), once                       |
| Autosave (after 2 s idle, at most every 10 s) | ≤30 KB                                                               | —                                                               |
| Commit                                        | Measured (S7): Fighter 5 145 KB, Wizard 5 257 KB, every read counted | —                                                               |
| Whole build                                   | About 1.2–1.5 MB. 50 builds a month ≈ 75 MB                          | —                                                               |

## Slices

| Slice | Content                                                                                                                                          | Tests first                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0    | ADR 0036, plus approval of the Builder budget wording in the acceptance ledger                                                                   | —                                                                                                                                                                                                         |
| S1    | Snapshot schema in `packages/schema`; canonical build and hash                                                                                   | Determinism; header included in the hash; index/documents split                                                                                                                                           |
| S2    | Heads and objects tables, share index, triggers, `build`/`commitBuild`, cleanup cron, local R2                                                   | A publish touches only its scope and kind; idempotent retry; stale compare-and-set rejected; unshare removes the item; a hidden import is excluded; a shared child whose parent is not shared is excluded |
| S3    | Worker route, R2 binding, `issueAccess`                                                                                                          | Authorization matrix: foreign source, departed member, expired token, wrong audience, token in the query string rejected; public SRD cacheable                                                            |
| S4    | Manifest query                                                                                                                                   | Parity with `readCharacterSources`/`readCharacterSourceRoots` (no Campaign, restricted catalogues, shares)                                                                                                |
| S5    | `snapshotReaders` and the extracted `assembleCharacterBuilderContext`                                                                            | Golden parity with today's `builder.resolve` over a fixture corpus; snapshot/Convex round-trip                                                                                                            |
| S6    | Web: snapshot client, Web Worker evaluation, local resolve and preview                                                                           | Bundle size gate (≤300 KB gzipped); import boundary forbidding `rules-runtime/encounter*` in the web app; evaluation p95 ≤100 ms                                                                          |
| S7    | Commit reading only referenced content                                                                                                           | Differential test (browser against server validation); read budget                                                                                                                                        |
| S8    | Debounced autosave and a cheaper `drafts.save`                                                                                                   | Budget test                                                                                                                                                                                               |
| S9    | Delete `builder.get`, `resolve`, `preview`, the selector scope and the full-pool loading; update `character.md`, `media.md` and `persistence.md` | —                                                                                                                                                                                                         |
| S10   | The room loads content from snapshots (after the ADR 0035 room slices)                                                                           | —                                                                                                                                                                                                         |

## Risks and open points

- **Stale snapshots.** The UI shows when content is still updating, and commit stays authoritative. A boundary test forbids raw mutations writing content tables; audit `geometryStaging.ts`.
- **Private-content leaks.**
  - no edge cache on private paths, and the token only in the header;
  - a separate secret, CORS limited to app origins, and exact Campaign-share rules;
  - the accepted exposure is at most one token lifetime.
- **Pool-size rules.** Checked in S5: two rules depend on whether a pool is empty, and both read complete snapshot pools, so no count fact is carried. Revisit if S6 evaluates from a partial pool.
- **Unmeasured:**
  - browser evaluation CPU (S6 measured Node only) and cold manifest load time;
  - System and vocabulary document size;
  - whether R2 responses need manual `Content-Encoding`;
  - Durable Object memory with large bundles;
  - scheduler behavior during a large SRD seed.
- **Re-verify** the R2 and Workers Free limits, which the room and SSR also share after D65.
