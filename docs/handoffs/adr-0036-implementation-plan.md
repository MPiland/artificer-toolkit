# ADR 0036 implementation plan

> Status: approved direction; S1 and S2 implemented locally (2026-09-27). This plan implements [ADR 0036](../adr/0036-versioned-content-snapshots-and-browser-builder.md). It was built from a read-only mapping of `codex/phase-08-2-convex-cutover` at `c8d409352`.

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

## Budgets (estimates to verify in the slices)

| Action | Convex I/O | Network |
| --- | --- | --- |
| Edit | 0 | 0 when cached |
| Picker open | 0 | Cache miss: one Worker request, 5–300 KB gzipped, once per hash |
| Builder open | Manifest ~10 KB, token ~5 KB, draft ~15 KB | Cold start about 1 MB gzipped (SRD), once |
| Autosave (after 2 s idle, at most every 10 s) | ≤30 KB | — |
| Commit | Martial level 5: ~100–150 KB. Caster level 5: ~180–250 KB | — |
| Whole build | About 1.2–1.5 MB. 50 builds a month ≈ 75 MB | — |

## Slices

| Slice | Content | Tests first |
| --- | --- | --- |
| S0 | ADR 0036, plus approval of the Builder budget wording in the acceptance ledger | — |
| S1 | Snapshot schema in `packages/schema`; canonical build and hash | Determinism; header included in the hash; index/documents split |
| S2 | Heads and objects tables, share index, triggers, `build`/`commitBuild`, cleanup cron, local R2 | A publish touches only its scope and kind; idempotent retry; stale compare-and-set rejected; unshare removes the item; a hidden import is excluded; a shared child whose parent is not shared is excluded |
| S3 | Worker route, R2 binding, `issueAccess` | Authorization matrix: foreign source, departed member, expired token, wrong audience, token in the query string rejected; public SRD cacheable |
| S4 | Manifest query | Parity with `readCharacterSources`/`readCharacterSourceRoots` (no Campaign, restricted catalogues, shares) |
| S5 | `snapshotReaders` and the extracted `assembleCharacterBuilderContext` | Golden parity with today's `builder.resolve` over a fixture corpus; snapshot/Convex round-trip |
| S6 | Web: snapshot client, Web Worker evaluation, local resolve and preview | Bundle size gate (≤300 KB gzipped); import boundary forbidding `rules-runtime/encounter*` in the web app; evaluation p95 ≤100 ms |
| S7 | Commit reading only referenced content | Differential test (browser against server validation); read budget |
| S8 | Debounced autosave and a cheaper `drafts.save` | Budget test |
| S9 | Delete `builder.get`, `resolve`, `preview`, the selector scope and the full-pool loading; update `character.md`, `media.md` and `persistence.md` | — |
| S10 | The room loads content from snapshots (after the ADR 0035 room slices) | — |

## Risks and open points

- **Stale snapshots.** The UI shows when content is still updating, and commit stays authoritative. A boundary test forbids raw mutations writing content tables; audit `geometryStaging.ts`.
- **Private-content leaks.**
  - no edge cache on private paths, and the token only in the header;
  - a separate secret, CORS limited to app origins, and exact Campaign-share rules;
  - the accepted exposure is at most one token lifetime.
- **Pool-size rules.** Verify that no readiness rule depends on candidate pool size. If one does, carry an explicit count fact.
- **Unmeasured:**
  - browser bundle size and evaluation CPU;
  - System and vocabulary document size;
  - whether R2 responses need manual `Content-Encoding`;
  - Durable Object memory with large bundles;
  - scheduler behavior during a large SRD seed.
- **Re-verify** the R2 and Workers Free limits, which the room and SSR also share after D65.
