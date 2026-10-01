# ADR 0036: Versioned content snapshots and Builder evaluation in the browser

- **Status:** decision (Q15 option a, approved with Q16 and D65 on 2026-09-27; S1–S9 and S11 implemented locally; S10 and integrated proof pending)
- **Date:** 2026-09-27
- **Revised:** 2026-09-29
- **Scope:** how published content reaches the Builder and the live room; Builder evaluation; Builder save and commit validation
- **Update when:** snapshot format, delivery authorization, Builder evaluation placement, commit validation or Builder budgets change
- **Supersedes:**
  - ADR 0028's "no Worker, proxy, public bucket" clause, for content snapshots only;
  - ADR 0035 Amendment 11's interim capture path when room snapshot consumption (S10) lands;
  - the server-resolved Builder selectors and preview in `docs/architecture/character.md`.

## Implementation status — 2026-09-29

Snapshot build/delivery, browser Builder evaluation, referenced server commit, debounced saves,
old Builder endpoint removal and snapshot-backed authored lists are implemented locally (S1–S9, S11).
The S10 room-input foundation now supplies manifests under the GM's or assigned Character owner's
existing source authorization. Hydration verifies SOURCE/CAMPAIGN index and document objects from R2
before committing inputs to SQLite; invalidation reloads the affected scope, and a hibernation wake
reloads content from cached inputs without a Convex call. Rules planning still uses its transitional
capture adapters, so S10 is not complete. System/vocabulary inputs keep the existing revision-bound
path; a new SYSTEM snapshot format is outside this completion.
SOURCE/CAMPAIGN objects now use format 2 and `v2/` keys. Their `documents` part includes an aligned
`versions` array with each root's original public version ID, numeric version, stored checksum,
actual content-source ID and stored parent metadata. Those pins identify the stored publication;
the object hash or a normalized DTO hash cannot replace them. The pre-launch local reset/rebuild
replaces format 1 objects before browser/room integration proofs. No format 1 compatibility is kept.
The shared local R2 fixture bridge and in-memory content-token secret wiring are implemented locally;
complete browser Builder and snapshot-list proof remains pending.
See [the implementation plan](../handoffs/adr-0036-implementation-plan.md) for slice evidence and local integration gaps.

## Context

`builder.resolve` read about 392 documents (722 KB) per call and ran on every edit. `builder.get` re-ran as a subscription after every draft save. Together they accounted for 2 GB of cloud database I/O.

Q16 makes Convex database I/O the binding free-tier constraint. Published content only changes on publish. The rules code is already portable: `prepareCharacterRuleContext` takes injected `Readers`, and the session worker already uses it.

## Decision

1. **Snapshots.** Every publish-time change to source or Campaign-share content produces immutable, content-addressed objects in a private R2 bucket. System snapshots are added with their reader, as below.
   - **Granularity:** one object per scope × subject kind × part. The parts are `index`, the picker facts, `list`, the columns, filter facts and search text of the authored-content list pages (S11), and `documents`, the full published documents.
   - **Scopes:** a content source (`SOURCE`, PLATFORM sources such as the SRD included, because Campaign rules catalogues select PLATFORM sources) and a Campaign's share set (`CAMPAIGN`). A `SYSTEM` scope will hold only System-level data (the System document, vocabulary and definitions) with its own object format, added when a reader needs it (D67).
   - **Keys:** the SHA-256 of canonical JSON, which includes a format and scope header.
   - **Source pins:** format 2 document objects retain original publication version metadata beside
     the normalized documents, in the same root order. Build and read validation bind every pin to
     its root, kind and System, and SOURCE pins to their actual source scope.
   - **Heads:** Convex records each scope's current hashes in `contentSnapshotHeads`.
   - **Building:** a coalesced, compare-and-set-fenced scheduled action, triggered from the writing transaction through the existing mutation triggers.
   - **Cleanup:** superseded objects are deleted after 7 days.
2. **Delivery.** A route on the session Worker serves the objects, separately from ADR 0037's web Worker.
   - PLATFORM source objects are public and immutable; future System objects will be too.
   - USER-source and Campaign scopes require a Convex-issued HS256 content token:
     - 10-minute TTL;
     - its own secret and audience;
     - claims naming the caller's own sources and active Campaign memberships;
     - sent in the Authorization header, never in the URL, and never cached at the edge.
   - The live room reads the same objects through its R2 binding, using a manifest authorized by Convex.
3. **Visible set.** A reactive `contentSnapshots.manifest` query assembles a user's visible set with exactly the Builder's source rules: enabled catalogues, own Homebrew, current Campaign shares.
   - The browser verifies each downloaded object against its hash and caches it by hash indefinitely.
   - It drops hashes that are no longer in its manifest.
4. **Evaluation in the browser.** Builder resolution, eligibility and preview run in a lazily loaded browser Web Worker, using the shared `rules-runtime/character` code over snapshot-backed readers.
   - No Convex call is made per edit.
   - Drafts autosave on a debounce and are validated for structure only.
5. **Commit.** Commit re-validates on the server, reading only the System, the Character's sources and the roots the Character references. It never trusts a snapshot or a client preview, and an unavailable reference fails closed with `SOURCE_UNAVAILABLE`.
6. **Budgets** (the Builder criterion of ADR 0035 Decision 9):
   - 0 Convex calls per edit;
   - autosave ≤32 KB;
   - commit ≤300 KB;
   - a whole build ≤1.5 MB;
   - Builder worker chunk ≤300 KB gzipped.

## Consequences

**Benefits:**

- Builder I/O drops about 100-fold per build.
- Content egress is free.
- The room and the Builder share one content path.
- Editing and preview keep working offline with cached bundles.

**Costs:**

- A snapshot lags a publish by seconds; commit stays authoritative.
- A user whose access is revoked may fetch objects they could already read for up to one token lifetime.
- The web app ships part of the rules runtime.
- Golden, round-trip and differential parity tests become mandatory.
- Current candidate-pool emptiness checks use complete browser pools and server commit witnesses;
  no count facts are needed. Partial-pool evaluation would require equivalent facts (S5/S7).

**Removed:** `builder.get`, `builder.resolve`, `builder.preview` and full-catalogue Builder loading, with no compatibility layer (pre-launch). S11 also removed `content/catalogue:list`, `search` and `summary`: the list pages read the `list` part in the browser.

See [the implementation plan](../handoffs/adr-0036-implementation-plan.md).
