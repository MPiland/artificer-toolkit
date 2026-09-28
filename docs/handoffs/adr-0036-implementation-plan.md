# ADR 0036 implementation plan

> Status: approved direction, implementation not started (2026-09-27). This plan implements [ADR 0036](../adr/0036-versioned-content-snapshots-and-browser-builder.md). It was built from a read-only mapping of `codex/phase-08-2-convex-cutover` at `c8d409352`.

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
