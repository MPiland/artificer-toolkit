# Compact Spell preparation — 2026-09-30

**Status:** local implementation, focused checks and all three frozen native browser journeys pass.
This is implementation evidence, not Phase 8.2 acceptance or promotion evidence. The ledger remains
51/75 accepted, with 24 cases open. S3, the authority switch, Q16, R08 and managed promotion remain pending.

The user chose compact immutable snapshot metadata with a virtualized picker on 2026-09-30.
The owner reads authorized R2 Spell list parts once per source revision. The picker reveals browser
pages of 40 rows and virtualizes the visible range; scrolling makes no additional Convex calls.
Preparation commands use complete prepared IDs, independently of mounted rows. Individual inspectors
and selected mechanics hydrate full validated Spell documents on demand.

Campaign GM preparation keeps bounded compact inline metadata: the existing Character projection
does not grant access to the Character owner's private USER snapshot scope. Current share access,
source pins, maturity masking, version conflicts and private-data cleanup remain required.

## Baseline

The retained native browser baseline is
`local-validation/local-convex-proofs/phase82-sheet-response-boundary-20260930.*`.
Fighter passed; Cleric failed the native Convex execution limit, so the third journey was not run.
The active modules matched the captured source, and fixture cleanup completed.

| Native function | Maximum database bytes read | Maximum documents read | Failed executions |
| --- | ---: | ---: | ---: |
| `characters/sheetSlices:get` | 6,636,652 | 1,101 | 2 |
| `characters/panels:get` | 6,636,652 | 1,101 | 1 |
| `characters/preparationOptions:get` | 6,636,652 | 1,101 | 1 |
| `characters/sheetCommands:execute` | 6,647,427 | 1,111 | 0 |

These are observed maxima across the baseline packet, not monthly budget estimates or latency percentiles.
The baseline includes the Builder StrictMode autosave repair, Worker SSR rich-text parser repair and
public Sheet validation after viewer projection. Those repairs alone did not resolve Cleric access costs.

## Implementation

`packages/schema` owns complete class eligibility/prepared IDs and the compact catalogue delivery
contract. Checksum-bound Spell selector facts carry attributes, components, material description and
publication status. The bounded exact backfill validates existing facts against canonical documents
before filling missing metadata; present conflicting facts fail closed.

The shared rules context carries complete selector entries and a partial mechanics map. First
activation, retained Equipment grants, source loss and individual Spell inspectors keep their existing
ownership and validation boundaries. Learning/preparing hydrates only newly required documents within
the same authorized transaction, without rebuilding the catalogue; compiled source preparation is
refreshed when its context identity changes.

## Focused verification

Logs are retained under `local-validation/phase82-compact-spell-picker/`. Compiler, tests and native
commands use `local-validation/.validation.lock`; TypeScript runs alone with `GOMAXPROCS=2` and Turbo
concurrency one.

- Shared/runtime checks: 15/15 tests in three files, `runtime-tests-v2.log`.
- Web picker/inspector/privacy checks: 36/36 tests, `web-tests-v3.log`.
- Native API regression cohort: 49/49 tests in ten files, `api-tests-v5.log`.
- Backend and Worker typechecks: 11/11 Turbo tasks, `backend-typecheck-v3.log`.
- Web app, test, stories and configuration typechecks: 4/4 Turbo tasks, `web-typecheck-v4.log`.
- Final local codegen and deployment: exit 0, `local-codegen-v2.log` and `local-deploy-v4.log`.
- Exact metadata migration: 1,057 roots in 529 bounded transactions, `backfill-summary.json`.

The checks include corrupt unused mechanics remaining unread, referenced corruption rejecting,
private Spell exclusion, revoked share/source access, preparation and casting, unprepared Spell
customization, replay, rollback and complete Builder catalogue reuse. Earlier failed checks and their
logs are retained; corrected assertions follow compact aggregate summaries, individual inspector
hydration and typed Character reconstruction.

## Native browser proof and access comparison

The ordered local recovery and proof commands were:

1. Restart the existing `phase82-convex-local-linux` container, preserving its volume, then wait for
   `http://127.0.0.1:3210/instance_name` readiness. Local push attempts v2 and v3 had failed native
   schema/module evaluation limits under memory pressure; the same source passed push v4 after restart.
2. Run the initial native browser packet `phase82-compact-spell-picker-20260930`. It failed before
   Sheet queries: the restart had stopped the in-memory R2 fixture, and all eight SOURCE index
   requests returned HTTP 503. This attempt supplies no access comparison.
3. Run `scripts/localConvexFixtures.ps1 -Action start`. Read only the local snapshot heads and source
   metadata using `convex data ... --limit 1000 --format json --url http://127.0.0.1:3210` with the
   admin key generated inside the existing container and held only in memory.
4. Run `yarn exec node local-validation/phase82-compact-spell-picker/restore-snapshots.mjs`. The helper
   reused `readScopeKind` and `buildContentSnapshotKind`, verified every part against the saved head,
   and restored 24 objects for eight kinds. It changed no database records, revisions or checksums.
   Public metadata was restored only for PLATFORM SOURCE objects.
5. Run `local-validation/phase82-compact-spell-picker/browser-v2/run.ps1`. It checked fixture health,
   matched the active Convex modules to the current bundle, started local web/Worker processes, and
   verified Background delivery with HTTP 200 before invoking
   `scripts/runLocalConvexProof.ps1 -Name phase82-compact-spell-picker-v2-20260930 -Proof builder-browser`.
   It stopped only its own process trees and released the validation lock on completion.

The final native packet ran from 19:38:43Z to 19:41:29Z on 2026-09-30 against instance
`phase82-local-linux` and exited 0. Fighter/Rogue, Cleric Spell preparation and Dragonborn Champion
all passed (3/3, 2.5 minutes). Exact fixture cleanup removed drafts, aliases, account/session/auth
records and denied stale JWTs. The expected competing invitation redemption and stale-auth rejection
are retained separately from application failures.

Evidence is retained as
`local-validation/local-convex-proofs/phase82-compact-spell-picker-v2-20260930.*` and
`local-validation/phase82-compact-spell-picker/browser-v2/`. The captured source has HEAD
`33b34e19019726bbf1cacf234499050e4172546b` plus the dirty working tree; its inventory contains 5,370
entries and SHA-256 `88098d25f003ec7d7343cfef42f496cc8e2c88244e1868a8839268a00e0987cb`.
Before/after source parity matched. All 1,012 current Convex modules matched their deployed hashes.

| Native function | Maximum database bytes read | Maximum documents read | Executions | Failed executions |
| --- | ---: | ---: | ---: | ---: |
| `characters/sheetSlices:get` | 5,002,119 | 492 | 22 | 0 |
| `characters/panels:get` | 5,001,844 | 491 | 4 | 0 |
| `characters/preparationOptions:get` | 5,005,085 | 492 | 4 | 0 |
| `characters/sheetCommands:execute` | 5,014,997 | 502 | 2 | 0 |

Observed maximum reads fell about 25% in bytes and 55% in documents. The baseline and final packets
cover different completed journeys, so this is a comparison of observed maxima, not a matched
benchmark or budget proof. Preparation still reads about 5 MB of other authored inputs; narrowing
those reads and proving the complete application workload remain open. Native user execution for
these queries stayed below one second, while maximum total query time reached 1.23 seconds.
No Builder latency, subscription invalidation or Q16 pass is inferred from these results.

## Remaining evidence

The complete final-source local lifecycle and integrated product workload remain required before any
acceptance or promotion claim. All earlier failing logs, the first browser failure and the restoration
helper remain under ignored `local-validation/`.
