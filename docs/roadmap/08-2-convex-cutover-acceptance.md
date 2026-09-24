# Phase 8.2 — Complete Convex cutover acceptance

- **Status:** transitional
- **Scope:** Supabase-to-Convex backend replacement and pre-launch release proof
- **Update when:** a case status or its evidence changes
- **Verification:** `08-2-convex-cutover-acceptance.json` is the machine-readable ledger

## Current checkpoint

Work resumed on 2026-09-09. The exact workspace, completed architecture corrections, personal-development
deployment and ordered next steps are recorded in [the resume checkpoint](08-2-convex-cutover-resume.md).
Acceptance is 59/75. The 16 open cases are P15, V05, V08, V09, V14, F12, V15, R01–R06 and R08–R10; the frozen Character/Encounter workload remains unproven.

**ADR 0033 amendment (user-approved 2026-09-24).** The user approved making Encounter Runs Campaign-owned, keying the live table by Campaign and making Sessions an optional log before launch, and approved amending the affected acceptance criteria. P15 (Sessions and control), V05 (admission), V08 (Encounter lifecycle), V09 (actors and initiative), V14 (contention schedules) and F12 (account deletion history) now prove the [ADR 0033](../adr/0033-campaign-owned-play-and-session-log.md) contract: no open Session gates tickets, room authority, presentation or Encounter commands; finishing a Session leaves Runs, presentation and the table untouched; Runs take their party from ACTIVE Character assignments and a PREPARED Run can be deleted. Their earlier evidence proves the superseded Session-scoped contract and is historical, so each is reopened until it passes on the final source. Proof tiers, the remaining scenarios and the 75-case denominator are unchanged.

R06 ownership review is reopened after V15-20260924-05 exposed a missing live Encounter movement
path. The 2026-09-24 review accepted the user-approved Character authority amendment: all Character
Sheet changes stay in Convex, with the DO owning supported Scene commands and previews. That review
evidence remains historical. The user reaffirmed DO execution for heavy live rules after real Convex
execution/size failures; current ownership review must finish that execution/commit boundary while
preserving Convex Sheet write ownership. The earlier options keeping heavy Encounter evaluation in
Convex are superseded. The 75-case denominator is unchanged; V15 and R08 remain open.

The user clarified acceptance scope on 2026-09-24: each feature case proves its own stated contract;
the combined system is proved by the separate integration/release gates. A failure at a dependency
or newly changed integration boundary does not automatically withdraw downstream feature acceptance.
Reopen a feature case when evidence specifically contradicts its own contract or a change invalidates
its scoped proof. Existing IDs, proof tiers and scenarios remain unchanged.

V07, V10 and V13 therefore retain their established acceptance evidence. Their temporary reopening
was overbroad and has been reversed. The missing DO-to-Convex live Encounter movement route is tracked
under R06. Verify that repaired boundary directly; the complete final-source journeys and combined
workload remain mandatory under R08 and V15. Feature acceptance does not claim that this current
integration gap is resolved or that release readiness is established. Review evidence and count
corrections are retained in `.codex/validation/phase82-goal-20260923/movement-acceptance-reopen.md`.

Historical 2026-09-22 review (superseded): R06 was amended in place and accepted at REVIEW. One Session Durable Object was the
active authority for the supported Door, standalone token move/undo and live Character command paths;
it commits SQLite live state, replay receipt and ordered Convex publication outbox atomically before
broadcasting success. Convex independently revalidates ordered publications, fences overlapping direct
writes, drives subscriptions and supplies recovery after release or eviction. Recipient-filtered
previews remain ephemeral, and other Encounter rule paths remain Convex-owned. Evidence:
`.codex/validation/phase82-gate-progress-20260917/live-authority-release/token-move-worker`,
`.codex/validation/phase82-gate-progress-20260917/live-authority-release/token-move-convex`, and
`.codex/validation/local-convex-linux-20260915/vtt-rule-convergence-session-do-12.*`. The R06 ID,
fixed 75-case denominator and accepted-case count are unchanged.

V11 is accepted at its unchanged LOCAL_INTEGRATION tier. Current audiences, private pending data,
paused-state preservation, validated response/resume, existing DECLINE cancellation and replay/rollback
are covered. Authenticated Disarm03 passes on deploy-25 with one terminal settlement, exact replay,
fixture cleanup and unchanged source. See `.codex/validation/v11-acceptance-20260916/acceptance.md`.
V14 is accepted at CONCURRENCY: reaction12 completes the terminal outcome race with one settlement,
unchanged winning/root replay and stale loser retry. Its retained lifecycle and unrelated-aggregate
schedules are mapped in `.codex/validation/v14-acceptance-20260916/acceptance.md`.
V12 is accepted at AUTHORIZATION: all 89 tests in the current 13-file recipient matrix pass on
unchanged backend/domain source. Its reviewed authority and redaction paths cover every current producer.
Evidence: `.codex/validation/v12-authorization-20260916/acceptance.md`.
Browser, measured workload and release scopes remain open.

The current continuation has passed authenticated V03 native execution and the real owner Scene
upload/create/edit/reload journey, including immutable live version zero, private-read denials,
zero browser diagnostics and exact fixture/account cleanup. Physical R2 cleanup passed after the
required fences for both native and browser proof assets. The final integrated web run passed
1,296 unit tests, 206 stories and 23 Playwright journeys with matching source hashes, including
the native Scene-selector binding. V03 is ACCEPTED at its unchanged LOCAL_INTEGRATION tier.
Ordered evidence: `.codex/validation/phase82-ultra-continuation-20260911/v03-integration.md`.
The Encounter web adapter now uses native supported reads/create/commands; native Scene summary
pagination is bound to the GM selector. These earlier slices preceded V02 acceptance; V09 remains open.

V02 and V06 are ACCEPTED at LOCAL_E2E. Browser-26 passes native Scene authoring, independent
GM/player hydration, live edits, private-token exclusion, actual JWT expiry/renewal, bidirectional
native Worker previews, offline recovery, reload and departed-player refusal. Exact fixture/account
and physical R2 cleanup pass. Static JWKS retains the existing signing identity and all rate limits;
the full managed journey has no JWKS fetches or limiter failures. Runtime/generated source matches
the activation. Consolidated evidence: `.codex/validation/phase82-scene-live-acceptance-20260913/acceptance.md`.
That earlier packet advanced decision-audience and stale-receipt coverage. V12 is now accepted as recorded above. V14's
current schedules pass; the complete frozen action/reaction workload and R08 release lifecycle
remain open. R09 retains managed Worker packaging and all promotion requirements.

The local Passage integration packet records green fresh format/lint, shared/schema/rules-runtime builds,
official codegen, API/Functions/runtime typechecks, 15 native files and shared/schema contracts, plus
Overrun/Tumble choice and decline, Automatic and Assisted two-d20 continuation, ordered spatial/reaction/
Legendary Resistance continuation, retained exact replay, no-spend-before-terminal, same-mutation rollback/
retry, current Character-to-actor privacy and endpoint-footprint boundaries. The final source remained at
manifest `f1668aaa3831a69f53d3fd731b513997bafc8823ba04a2850f4676002c55d7b6`. Evidence:
`.codex/validation/scene-passage-coordinator-20260914/local-integration-evidence.json`. This advances
implementation progress only; browser Passage/combined frozen journeys, the original managed initial MOVE
CPU failure, the full workload and R08 remain open. V13 remains IN_PROGRESS; the later V11 acceptance is recorded above.

The earlier checkpoints below are historical and retain their original counts and open-gap descriptions.

The V03 shared development verifier now passes through the existing local Encounter lifecycle,
including all entity collections, persisted geometry, recipient privacy, competing edits, exact
replay and post-publication Scene/fog/head/receipt rollback with complete fixture/media cleanup.
It is wired into the authenticated development harness. Existing capacity/privacy cases additionally
cover maximum-size polygon paging and nine fog layers. A real pagination ceiling bug was corrected.
No new cases were added. Complete final-source local gates and authenticated development proof remain
open; V03 is IN_PROGRESS. Evidence: `.codex/validation/phase82-v03-development/integration.md`.

The V03 recipient packet passes 112 native tests across 11 files and 46 shared/kernel/schema tests
across five files, with thirteen combined Turbo tasks, strict lint/format and guarded generation.
Current recipient pages cover all six entity collections, own/shared versus foreign fog, hidden/GM
entities, visible-ID continuation, stale versions and departed/anonymous access. Existing full fog
capacity and persisted collision/distance/door/line-of-sight flows pass. Review-found hidden-count
continuations and excessive off-map sampling were corrected before the first passing runtime run.
V03 remains IN_PROGRESS pending authenticated development integration and the complete local lifecycle.
Evidence: `.codex/validation/phase82-v03-recipient-facts/integration.md`.

The latest V03 Session geometry connection passes 111 native tests across 11 files, twelve final Turbo
tasks, strict lint/format, read-only codegen and corrected persistence review. It composes current
Character vision for actual tokens and validates stored dependency observations during atomic
publication. Existing flows cover stale-observation retry, historical replay, Session-context omission
and explicit overrides without added cases. General recipient visibility/privacy, persisted collision/
distance/line-of-sight proof and authenticated development integration remain open.
Evidence: `.codex/validation/phase82-v03-session-geometry/integration.md`.

The latest V03 transactional freshness packet passes all 1,223 native tests across 198 files on an
unchanged source identity, twelve final Turbo build/typecheck tasks, export builds, strict lint,
formatting, read-only codegen and an executed mutation-import restriction probe. System/Campaign/
Session/Character revision markers now cover all native mutation and migration builders. The existing
eight vision cases prove immediate visibility, rollback, source changes and isolated Character play;
no additional cases were added. Geometry composition and publication-time revision checks remain open.
Evidence: `.codex/validation/phase82-v03-vision-freshness/integration.md`.

The post-timeline selection audit moves the next unblocked work to V03's native Scene entities,
geometry and visibility facts. V03 is IN_PROGRESS. Its geometry-command packet passes 99 native tests
across nine Scene/binding files and 77 kernel/schema/service tests across seven files. Annotation, light and mechanical-darkness
edits preserve immutable definitions, collection ordering/counts, Scene-wide exact replay, stale-target
conflicts, unrelated stale edits, rollback, current authority and capacity. Persisted lighting changes
produce the expected shared illumination/obscurement facts. Ambient illumination and vision reveal mode
now persist independently, with per-setting conflicts and shared receipts. Measurements retain their 500-record
capacity, own-only player edits, bounded member reads and atomic rollback/cleanup proof. Fog now uses
immutable chunk uploads and atomic reference publication, preserving full 256-chunk layers above one
MiB. Current and historical hydration, recipient checks, stale-layer conflicts, rollback, expiration and
fixture cleanup pass. Actor-token SET now honors current overrides/tombstones while preserving Scene
state and historical replay. Shared command exploration uses only geometry/fog inputs; all three existing
service paths reuse it. Recipient planning now projects geometry without fog; the existing service attaches
only the selected recipient's layer. The full reducer delegates its seven geometry operations to the
same narrow geometry reducer. Five existing command schemas are shared with the native geometry subset,
preserving all validation. Eighteen build/typecheck tasks, strict lint and independent review pass.
Internal current-geometry reads now resolve BASE overrides and APPENDED additions in bounded ordinal
pages, preserving empty continuations and rejecting ordinal collisions before lookahead can skip them.
Each page checks current owner authority and the Scene version/save. Current door state lives separately
from authored initial state in the barrier override; canonical UUID output preserves immutable checksums.
Three export build tasks and guarded read-only codegen pass; no managed activation occurred.
Turbo general typechecks now wait for dependency builds, fixing the observed stale-export failure.
Native owner token/barrier upsert/removal and door changes now hydrate complete geometry and publish
entities, all recipient fog references and a GEOMETRY receipt atomically. Receiving staging stays hidden;
current authority precedes replay, and unrelated changes reset its captured snapshot. Derived fog explicitly
replaces the complete canonical recipient layer after preserving old/new explored cells. This fixes the
native noncanonical manual-chunk collision without changing manual patch behavior or deleting history.
Five commands, current IDs/doors, replay/conflicts, manual child denial, rollback and cleanup have proof.
The subsequent test-only follow-up passes 25 geometry/binding tests and eighteen static tasks, adding
competing/duplicate publication, bounded expiry and actual uppercase token removal/restoration through
Encounter binding. Production/generated code matches the prior 176-test implementation proof.
The preceding Character vision query packet passes seven native tests, nine existing compatibility tests and
nineteen combined static tasks, with strict lint/format and read-only codegen. It reuses the scalar
algorithm and current native authority, System vocabulary, stream and definition integrity checks.
Published Sense changes affect later reads without a Character version change; valid private definitions
permit their owner and reject the Campaign GM. The Session admission implementation packet passes 32 native tests
across five files and nineteen static tasks. A subsequent test-only consolidation reduces twelve vision cases
to eight lifecycle/failure cases; all eight pass with eight Turbo build/typecheck tasks and strict lint.
Production/generated code remains unchanged. An internal query now admits the exact
OPEN Session/presentation/Scene/Run/actor/token binding and present Character, then derives vision in the
same snapshot. It accepts the Character's newer current stream independently of the Run's original actor
sourceRevision. Indexed Session Run/binding discovery now passes the same eight lifecycle/failure tests,
twelve Turbo build/typecheck tasks, strict lint and read-only codegen. Empty filtered pages preserve
continuation; present Characters supply their current stream without hydrating all actors or rules together.
Geometry composition, publication-time dependent freshness, recipient facts
and authenticated development integration remain open. ADR 0024 requires
current published sources for future derived facts and frozen execution facts only for issued occurrences.
Evidence: `.codex/validation/phase82-v03-session-discovery/integration.md`; the full checklist
and selection evidence remain in `.codex/validation/phase82-v03-entities/`.
V09's completed packets remain preserved while its existing turn-order decisions await the user.
The native Scene store retains immutable version-zero instances beneath the separate live head and
entity overrides. Preserve existing creative capacity through bounded storage/transport and reuse shared geometry.

V04 is accepted at LOCAL_INTEGRATION: all ten complete map lifecycle gates pass. Evidence includes
152 tests across 22 files, 11 backend/web static tasks, proof TypeScript, strict lint, official
generation, loader headroom and the actual upload/transfer/trigger/cleanup proof. Campaign transfer
preserves the uploader's 2,086-byte charge; live-only references still reject account deletion
atomically. Exact fixture/account cleanup and stale-JWT denial pass without unexpected diagnostics.
The final map had four provider objects before its unchanged fence and empty exact prefixes at
2026-09-11T04:01:44.707Z afterward. Complete evidence and ordered source/command manifest:
`.codex/validation/phase82-v04-retention/acceptance.md`.

The earlier owner upload/create/edit/reload proof passed with private-read denials, exact cleanup and
empty browser diagnostics. Both prior fixtures are now physically absent after the unchanged provider
fence (`.codex/validation/phase82-scene-provider/integration.md`). Independent live Scene edits and
GM/player hydration remain V02/V03 work; the full product deletion flow remains F12-owned.
V08 is accepted at LOCAL_INTEGRATION: all eleven complete-case gates pass. The current local packet
passes 100 tests/13 files, official codegen, ten backend/web Turbo tasks, full proof-driver TypeScript,
strict lint and exact Unicode CLI transport checks. Independent auth/transaction review has no findings.
The complete authenticated personal-development proof passes six Runs across Manual and four
Automatic/Assisted policy/cadence scenarios, frozen snapshots, normalized corrections and subsequent
progression, immutable Run/Scene binding, actor-token set/replace/remove, successive token reuse,
historical receipts, three forced rollbacks and real command/binding/presentation/ownership/Session-finish
races. All 48 managed errors among 2,796 completions are expected denials or injected rollback failures.

Exact record/account cleanup passed. All three fixture maps have empty exact provider prefixes after
their unchanged fences, including the final map observed after 2026-09-11T09:04:13.468Z. Current source
and generated hashes, ordered commands, complete logs, reviews and the eleven-gate checklist are
retained in `.codex/validation/phase82-v08-auth/acceptance.md`.

At V08 closure, acceptance reached 49/75 with 26 remaining and V09 was selected. Its native gaps include
actor removal, REORDER, live reinforcements and the web flow. Its native Creature
Equipment replacement packet now passes 69 focused tests, combined static/lint and a strengthened
exact-source preservation regression. Evidence and the full-case checklist live in
`.codex/validation/phase82-v09-equipment/`. Reinforcement current/next-round timing awaits the user;
that decision does not block the existing structural commands. V09 remains IN_PROGRESS, and its
remaining full-case cost must be compared with other candidates before expanding the packet.
Native get/active/list now reuse the strict player projector, with active-only player lists and
current membership/role checks. The local recipient-read packet passes 30 native tests, six shared
projection regressions, strict lint and official generation; evidence is retained in
`.codex/validation/phase82-v09-recipient-reads/`. Full native web/privacy acceptance remains pending.
An additional user decision is pending on how active reordering treats turns already taken.
Native timeline reads now select TABLE events before player pagination and stream indexed receipts
within a byte budget, preserving UUID cursors. The metadata backfill resumes in single-receipt batches
while reads reject incomplete backfills or corrupt history. The local timeline packet passes 54 tests across eight
affected native files, ten backend/web static tasks, strict lint and guarded read-only generation;
evidence is retained in `.codex/validation/phase82-v09-timeline/integration.md`. No development
activation or managed backfill has run. This packet does not close V09.
P02's compact Spell projection decision remains pending. Other actor/action/player projection/privacy,
browser, reconnect and performance obligations retain their fixed cases. No staging/production promotion occurred.

2026-09-10 P17 is accepted at LOCAL_E2E. Attempt 13 passes all 22 browser checkpoints, empty
strict diagnostics, retention, concurrent pagination, both capacity races/replay, responsive flows,
complete fixture/account teardown and stale-JWT denial. The final 39-file/281-test native run and all
nine backend/web typecheck tasks pass, including explicit disclosure rejection/preservation checks.
Runtime source matches the complete live pass; the later source delta contains only those two tests.
All 12 Social gates are reconciled in `.codex/validation/phase82-social-live/acceptance.md` and
`acceptance-checklist.md`. The older P17 checkpoints below are historical; no release promotion is claimed.

2026-09-10 P17's native block slice now creates/removes blocks, pages outgoing blocks and retains
immutable pair/generation events. Logical invalidation survives unblock, reblock and profile deletion;
bounded cleanup preserves the original event time and accepted membership/access. Focused tests cover
all four phases across 180 pending records, both job orders, stale actions, replacements, history,
expiry/edit/closure/archive/transfer precedence and transaction rollback. Independent review findings
were corrected. The complete ordered local checks are retained in
`.codex/validation/phase82-social-block-create/integration.md`. The subsequent native web slice binds
eligibility, exact profile block status/actions, outgoing block pages, application groups/direct links,
withdrawal and reporting. Evidence and limits are retained in
`.codex/validation/phase82-social-block-web/integration.md`. Official code generation uploaded source
for analysis without activating runtime. Remaining native Social surfaces, moderation safety actions,
migration/account cleanup and complete P17 proof remain pending; no new acceptance is claimed.

The subsequent invitation slice adds recipient/owner exact reads, stable native inbox pagination,
expiry/wake refresh, accept/decline/revoke/create bindings and native listing detail/application
submission. Current source and checks are retained in
`.codex/validation/phase82-social-invitation-web/integration.md`. P17 remains IN_PROGRESS; acceptance
stays 46/75. The next slice must be selected by effort to actual acceptance, with evidence-only closure
checked first; this partial Social implementation does not itself make P17 the cheapest case to close.

Discovery and hosting now bind existing native pagination, including filtered empty pages, eight-item
batches and search retry while keeping the controls available. The current packet is
`.codex/validation/phase82-social-discovery-web/integration.md`; its selection audit found no
evidence-only closure, substantial P10/P12 gaps, and no reliable gain from a local P02 invocation-order
probe. No backend source change or upload followed that probe. P17 remains IN_PROGRESS at 46/75.

The editor and host applicant review now bind existing native operations. Campaign selection and
application groups preserve pagination; unsaved fields retain their loaded optimistic version across
live updates, and mutation failures remain visible. Evidence and validation limits are retained in
`.codex/validation/phase82-social-editor-web/integration.md`. P17 remains IN_PROGRESS at 46/75.

Settings content visibility now reads and writes native Social preferences, retaining transient adult
attestation and errors. The final binding packet is
`.codex/validation/phase82-social-preference-web/integration.md`. The remaining direct legacy Social
calls are moderation. This preference packet made no backend change or new acceptance claim.

The subsequent native listing moderation packet implements HIDE/RESTORE with durable invalidation,
bounded cleanup and atomic report/listing/audit changes. Native commit timestamps order competing
BLOCK/HIDE events independently of cleanup timing. Local evidence and remaining limits are retained
in `.codex/validation/phase82-listing-moderation/integration.md`. Profile suspension/restoration,
moderation UI, migration/deletion completeness and full P17 lifecycle proof remain pending.
P17 stays IN_PROGRESS at 46/75.

The next native packet implements profile SUSPEND/RESTORE with durable profile generations,
read-time hosted-listing closure and bounded host/participant cleanup. Restoration preserves old
request invalidation; explicit republication snapshots the current generation. Public quotas and
Campaign metadata updates account for logical closures before cleanup. Evidence and limits are in
`.codex/validation/phase82-profile-moderation/integration.md`. Native moderation UI,
migration/deletion completeness and the real-backend P17 lifecycle remain pending; acceptance stays
46/75.

The moderation web page now binds the native paginated queue, audited evidence opening and all seven
review/listing/profile actions. It retains report versions, audit reasons and visible failures, and
prevents report switching during a pending write. No direct legacy Social adapter calls remain in
the Social domain's web source. The shared jsdom provider now uses Mantine's native test mode so
zero-layout controls do not hide their dropdowns; the existing form reset test queries the reopened
menu instead of a detached element. Packet evidence is
`.codex/validation/phase82-social-moderation-web/integration.md`. Migration, retention/account
deletion completeness and the real-backend P17 lifecycle remain pending; acceptance stays 46/75.

Native retention now has an internal read-only eligibility preview with bounded pagination, strict
180-day/two-day boundaries, calendar-year report retention and protected application references.
All 250 Social/notification tests pass; the new internal reference was generated through guarded
personal-development analysis, without runtime activation. Evidence is
`.codex/validation/phase82-social-retention-preview/integration.md`. The architect subsequently approved
retry-safe batches on 2026-09-10. Native apply now rechecks eligibility and atomically schedules bounded
report-audit cleanup; all application report references remain protected until reports are removed.
Official generation, strict lint, nine Turbo build/typecheck tasks and 265 combined Scene/Social/
notification tests pass. Evidence: `.codex/validation/phase82-social-retention-apply/integration.md`.
The subsequent native operator packet passes all 18 operator tests, API typecheck and lint. It requires
an explicit deployment/fixed cutoff, defaults to dry run and preserves report-before-application order.
Read-only inventories found all eight legacy Social tables empty in both production and staging;
no current importer is needed, and source counts must be repeated before cutover. Evidence:
`.codex/validation/phase82-social-operator/integration.md`. Actual backend and browser lifecycle proof
remain pending. No managed purge, runtime activation or acceptance is claimed; P17 remains IN_PROGRESS
and the ledger remains 46/75.

The account-cascade packet preserves SQL block/invitation deletion behavior in retry-safe eight-row
pages per index, immediate deleted-target read denial, affected-profile audit restrictions, and owned
Campaign deletion rejection. Independent review found no remaining issues. Native/web static checks,
official generation and strict lint passed. The complete serial native run passed 1,044/1,045 tests;
its only failure was an old deleted-target block assertion, now corrected with both affected tests
passing. This does not claim a green final-source full release lifecycle. Evidence:
`.codex/validation/phase82-social-account-cascade/integration.md`. P17 remains IN_PROGRESS at 46/75;
actual backend and complete browser proof remain pending.

The live Social proof passed on 2026-09-10 at 22:33 UTC using four disposable authenticated accounts.
All 22 browser checkpoints, private admission/replay, moderation, preferences and fixture-scoped
retention pass with empty browser diagnostics. Protected applications survive active membership and
recent departure; one old application, one invitation, two reports and eight rate windows are purged.
Scheduled report-audit and account block/invitation/notification cleanup, exact fixture removal and
all stale-JWT denials pass. Social Hub's New Post eligibility now uses the existing native hosted-count
projection, removing its overlooked legacy Campaign-list request. The nested deletion-error probe has
a runnable regression among nine passing fixture tests. Native/web/proof typechecks, strict lint,
codegen and a 7.4 MB fixture-module heap check pass. Concurrent admission/pagination, complete Standard
privacy transport evidence and responsive coverage still require reconciliation before P17 acceptance;
the count stays 46/75. Evidence: `.codex/validation/phase82-social-live/integration.md` and `attempt9/`.

The final native union passes 281 tests across 39 files, with all nine backend/web typecheck tasks
passing. Attempt 10 adds passing mobile/transport and actual concurrent admission/replay evidence;
its four departure receipts exposed a fixture cleanup ceiling, now corrected and regression-tested.
Attempt 12 passes all 22 browser checkpoints with empty diagnostics, retention, scheduled cleanup,
exact account/session/credential/profile removal and stale-JWT denial. Its new pagination probe fails
because its generated 35-character search term exceeds Convex's 32-character term limit. The fixture
now uses 19 characters and collects pagination/admission failures together. Proof typecheck and lint
pass; a complete corrected proof is still required. P17 remains IN_PROGRESS at 46/75. Current gates:
`.codex/validation/phase82-social-live/acceptance-checklist.md`; retained attempts are immutable.

2026-09-10 C16 is accepted at REVIEW. Native node resolution and the shared Kernel execute through
authenticated Convex source adapters. The actual Encounter mutation proves Assisted START, persisted
pause/re-pause, atomic terminal state and receipts, privacy and replay. Relevant source matches the
full 158-file/952-test native pass; 26 fresh runtime tests cover frozen execution, source-independent
resume, canonical HMAC and tamper/invalid-evidence rejection. Primary and independent deep review
found no remaining C16 gap. See `.codex/validation/phase82-c16-review/verification.md`.

P04 is accepted at LOCAL_E2E. Both personal Sheet and Spell browser journeys pass on source
`9f361c54224591dce0560947152ab9b9ba90f8c1cf49015a2d1f5c4e469796fb`, with strict empty diagnostics,
exact cleanup and stale JWT denial. The personal journey covers HP/inspiration/conditions,
inventory/currency, notes, rests, reload and Owl/Sailing Ship extras. The Spell journey covers
Learn/Prepare/Cast/reload/slot recovery/Unprepare/Forget/final reload. All seven combined server
errors are expected; command CPU peaks at 0.754 and 0.804 seconds respectively.
The same source passes 159 native files / 961 tests, 425 schema tests, 11 Turbo tasks, lint,
complete SRD activation/Learn/Prepare and differential compatibility checks. Existing union branches
run in the common-data order while retaining full validation. The prior CPU failures and upstream
auth connection timeout remain archived history. See
`.codex/validation/phase82-spell-cpu-profile/p04-acceptance.md` and `verification.md` in that packet.

P02's retry completes at 14:38:59 UTC with exit 1. The 30-second functional resolution wait
advances Cleric through choices, save/reload and preview. Finalization then hits the actual native
CPU ceiling. Among 1,309 server completions, resolve and commit time out at 1.0020/1.00075 seconds
CPU with 1,484/1,470 documents and 9.06/9.29 MB read; both write nothing and have no OCC retry.
Fighter/Rogue passes, Cleric fails and Dragonborn does not run. Exact cleanup and stale JWT denial
pass. P02 remains IN_PROGRESS at 46/75. Both isolated local timing and CPU profiles pass; catalogue validation dominates pure resolution;
see `.codex/validation/phase82-p02-cleric-finalization/verification.md` and its completion record.
No P02 managed proof remains running, and no P02 backend correction or further upload has occurred.
The optional derived-Spell projection ruling remains separate; current validation stays complete.

C04 acceptance is restored. The indexed relation/completeness guard preserves restrictive Class/Spell
references. The final 960-test suite, complete local backfill rehearsal and managed 1,051-root backfill
pass. Managed publication, parent races, exact Spell-reference rejection, concurrent Spell publication/
Class deletion and cleanup pass; all 821 server completions contain only 21 expected negative-path errors.
See `.codex/validation/phase82-class-spell-final/c04-acceptance.md`.

P09 now has native copy and create/archive/copy browser bindings. Copy and lifecycle pass 13 local
tests, including destination-access replay and full route/usage rollback; persistence review has no
implementation findings. The complete native suite and guarded development upload also pass.
Notebook size behavior awaits an architect ruling; managed lifecycle proof and deletion remain
pending. P09 stays IN_PROGRESS. See
`.codex/validation/phase82-p09-copy/verification.md`.

2026-09-10 P15 is accepted at CONCURRENCY. The complete managed Session, Clock and GM control proof
passes contention, replay, privacy, resource/history effects, archived authority and exact cleanup.
The first Clock run hit the one-second limit. Reusing authored sources within the mutation, while
rereading mutable state and authority, reduced the corrected recovery to 813 document reads and
0.733 seconds. All 71 affected native tests, eight Turbo tasks, scoped style and local loader checks
pass; transaction review has no remaining findings. Ordered source hashes, failed attempts and
managed metrics are retained in `.codex/validation/phase82-p15-performance/verification.md`.

2026-09-10 P14 is accepted at LOCAL_E2E. Two real browser clients pass all 12 chat, notebook, file
delivery/removal and private GM/TABLE roll checkpoints. Native version/nonce contention, privacy,
unread reconciliation, exact fixture cleanup and revoked JWT denial pass with zero unexpected
browser diagnostics. Verified successful transfer abort events remain separately recorded. Fresh
native checks pass five suites/26 tests; Clock/Session dependencies, CSP tests and scoped web gates
also pass. Ordered commands, source hashes, screenshots and every prior failed attempt are retained
in `.codex/validation/phase82-p14-complete/verification.md`. Release promotion remains open.

2026-09-10 P02 checksum follow-up preserves canonical bytes across all 1,051 SRD publications.
The guarded stored-JSON serializer passes all 952 native tests, 228 shared tests and all eight
native build/typecheck tasks. All six full-SRD Builder profiles pass; warm Cleric resolution improves
from 481.41 to 451.11 ms locally. The guarded development upload passes. Fighter/Rogue again passes
the browser journey cleanly, but adding Cleric still reaches the native one-second limit; the third
case is skipped. Exact cleanup and revoked JWT denial pass. Full catalogue loading needs further work; evidence
is `.codex/validation/phase82-p02-cleric/verification.md`. Accepted stays **44/75**.

2026-09-10 P02 navigation follow-up passes all **60** focused web tests and three Turbo tasks.
The complete Human Fighter/Rogue browser case now passes with clean diagnostics. Cleric fails after
base-class selection because native resolve reaches **1.00068 seconds / 1,479 documents / 8.74 MB**;
the third case is skipped. Exact cleanup passes. The uploaded backend remains the same 952-test
source. Local Cleric profiling continues; evidence is `.codex/validation/phase82-p02-react/verification.md`.
P02 remains IN_PROGRESS, accepted **44/75**.

The preceding 2026-09-10 stored JSON reader packet passed all 952 native tests,
typechecks and the guarded development upload pass. The Human Fighter/Rogue browser journey now
passes through Sheet reload with no native Character errors. Strict diagnostics still fail on a
React update-depth warning during save navigation and an auth fetch aborted during reload; the
other two cases are skipped. Exact cleanup passes. Evidence is
`.codex/validation/phase82-p02-json/verification.md`; browser diagnosis continues in `phase82-p02-react`.
Accepted stays **44/75**.

The preceding 2026-09-10 P02 full-selector parser/source-reuse packet passed all 124
affected native tests, eight Turbo tasks, local loader/style checks and guarded development upload
pass. Actual preview and commit pass at 0.67/0.71 seconds; the browser fails its five-second Sheet
wait. Ordinary resolve still times out once, with 30 noncached resolves averaging 0.92 seconds.
Two browser cases did not run; exact cleanup and revoked JWT denial pass. Read-volume/parsing
diagnosis continues in `.codex/validation/phase82-p02-resolution/verification.md`. Accepted stays **44/75**.

The preceding preview change's smaller source scope and direct stripped result pass
eight seeded equivalence cases, the public query regression and final native/types checks. The next
browser run fails earlier: ordinary resolution hits the one-second cap twice when adding Rogue.
Exact cleanup passes. Retain `.codex/validation/phase82-p02-preview/verification.md`; shared selector
loading is the next local diagnosis. Acceptance remains **44/75**.

The preceding 2026-09-09 P02 run completed all choices in the native multiclass Builder journey,
readiness, draft save/reload and persisted-choice checks, then preview hits the one-second execution
limit. The first browser case fails and two are skipped; cleanup and 15 focused native tests pass.
Retain `.codex/validation/phase82-builder-browser/verification.md`. The preview execution limit
remains a P02 defect. Accepted is **43/75** after completing the requested P14 priority.

## Goal

2026-09-09 P19 accepted at AUTHORIZATION: native Account counters, internal tier assignment,
capacity enforcement and the guarded development backfill/tighten are verified. The final browser
passes live plan/usage changes and hydrated reload without diagnostics. The real final-slot race
records one winner and a quota loser after OCC retry; downgrade preservation and exact cleanup pass.
Two unrelated failures in the broad native runs were corrected and their ten focused tests pass;
neither broad run is claimed green. Full release lifecycle remains R08. Evidence:
`.codex/validation/phase82-entitlements/verification.md`. Accepted is now **42/75**.

2026-09-09 P18 accepted at LOCAL_INTEGRATION: current source eligibility is checked before feed
creation and atomic Resend enqueue. The actual one-minute dev cron delivered one replayed announcement
once, with one feed item and provider status `sent`; disabling both recipient channels suppressed
the second announcement. Recipient privacy, first-read timestamps and exact cleanup passed. Fresh
native proof passes 39 tests and eight Turbo tasks. The architect-approved component-enqueue in-flight
boundary is recorded in ADR 0029. Evidence: `.codex/validation/phase82-notification-source/acceptance.md`.
Accepted is now **41/75**; full release lifecycle remains pending.

2026-09-09 P11 accepted at LOCAL_INTEGRATION: the Campaign parent and five route loaders now read
the native version-bearing record. Both actual browser removals, native version increments and
reload persistence passed. The overall browser command still failed its final diagnostics check on
legacy Campaign realtime/clock/session/conversation transport; that unresolved shell evidence is
retained in the owning cutover cases. Native content/lookup/cleanup tests and web/Convex typechecks
passed; independent follow-up found the prior parent-version defect resolved. Evidence and exact
scope: `.codex/validation/phase82-campaign-native-detail/acceptance.md`. Accepted is now **40/75**.

2026-09-09 P08 accepted: the two-client managed proof passes Builder create/edit contention,
Sheet receipt deduplication, conflicting and independent commands, stale-draft rejection and current-state
replay. Four backend OCC retries are recorded. The SDK restores its Sheet subscription after a forced
WebSocket close and replays the original command without another write. Native post-write failure proof
passes across Sheet state, receipts and the Encounter bridge; all 25 typecheck tasks and 58 focused
tests pass. The initial managed fixture duplicated published names; reusing its first prepared content
fixed the harness, and the rerun plus exact cleanup passed. Evidence:
`.codex/validation/phase82-character-concurrency/acceptance.md`. Accepted is now **39/75**.

2026-09-09 V01 accepted: the guarded personal-development deployment and authenticated Blueprint
driver now pass, closing the earlier module-loader blocker. Fresh local proof passes seven tests for
private System-scoped pagination, capacity, replay, rollback and pinned Creature/Equipment snapshots.
The actual-backend proof passes anonymous/foreign denial, create replay/conflict, private list,
update replay/stale rejection and exact fixture cleanup with stale-JWT denial. Evidence:
`.codex/validation/phase82-v01-final/acceptance.md`. Accepted is now **38/75**. Run wiring and
the full gameplay performance proof remain with their owning cases.

2026-09-09 C11 accepted: the seven-family reusable-definition publisher, native Convex lifecycle,
installed capability registry and live System editor now have one current-source review record. Final
review found and closed an older-base draft rebase defect; get/save/publish now reject that corruption
without writes. Fresh checks pass 58 native, 7 runtime, 10 web and 1 Storybook interaction tests plus
11/11 uncached typecheck tasks. Evidence: `.codex/validation/phase82-c11-final/acceptance.md`.
Accepted is now **37/75**.

2026-09-09 P03 accepted: native Character reconciliation now covers current-source preview/commit,
same-source publication replacement, direct Campaign unshare, authored deletion, membership departure
and assignment replacement across active, repair, saved-draft and create-only state. Fresh serial proof
passes 42 native and 20 shared tests plus 8/8 uncached Convex typecheck tasks. Identity, private Sheet
state and unrelated sources survive while invalid dependencies are removed. Evidence:
`.codex/validation/phase82-p03-final/acceptance.md`. Accepted is now **36/75**.

2026-09-09 P16 accepted: native immutable Campaign announcements enforce current owner publication,
server-derived TABLE/PARTY targeting, exact replay, fixed-copy notification intents, current recipient
privacy, masking and bounded pagination. The Campaign page now uses native list/get/create calls and
keeps its list usable when an optional deep link is unavailable. Fresh checks pass 6 backend and 2
web tests, 8/8 Convex and 2/2 web typecheck tasks, format and lint. Independent privacy review found
and closed one deep-link route failure, then reported no findings. Evidence:
`.codex/validation/phase82-p16-final/acceptance.md`. Accepted is now **35/75**.

2026-09-09 F14 accepted: the shared Convex/R2 path covers account avatars, Character portraits,
authored images across all eight domains, Campaign files and Campaign handout maps with signed
claims/reads, current authorization, quotas, revision fences, retries and reference-aware cleanup.
Fresh checks pass 43 backend and 18 web tests, 8/8 Convex and 2/2 web typecheck tasks, format/lint and
16 post-format tests. Scene maps, managed provider enforcement and release remain V04/R09/R08.
Evidence: `.codex/validation/phase82-f14-final/acceptance.md`. Accepted is now **34/75**.

2026-09-09 C08 accepted: native Race authoring/publication, current inheritance, canonical
seed/replay, family backfill and Product Library reads now cover all 13 canonical Races plus owned
copies. Native family pages preserve UUID identity, selection facts, privacy and stable pagination;
the Race list and detail/edit loaders use native reads. Fresh checks pass 9 native and 48 web tests,
8/8 Convex and 2/2 web typecheck tasks, focused lint, plus 28 post-format route tests. Evidence:
`.codex/validation/phase82-c08-final/acceptance.md`. Accepted is now **33/75**.

2026-09-09 C06 accepted: native Equipment authoring/publication covers exact-System parent chains,
atomic descendant recompilation, import/replay/backfill, deletion guards, export and native catalogue
reads across all 371 canonical items and the 500-item inheritance ceiling. P07 supplies the current
Character source-loss proof. Fresh checks pass 45 native and 51 web tests, 8/8 Convex and 2/2 web
typecheck tasks, format and lint. Independent review found no C06-owned gap. Evidence:
`.codex/validation/phase82-c06-final/acceptance.md`. Accepted is now **32/75**.

2026-09-09 V05 accepted: authenticated Campaign admission issues a signed, single-use, one-minute
room ticket after current authority, writable-state, open-Session and role checks. The Durable Object
rejects invalid origins, claims, rooms and replay, then performs a locked current-authority renewal
before `READY`; later renewals revoke stale sockets and preserve current members. Fresh checks pass 12
focused assertions across Functions, the API seam and the session worker. Independent security review
found no V05-owned defect. Evidence: `.codex/validation/phase82-v05-final/acceptance.md`. Accepted is
now **31/75**.

2026-09-09 C09 accepted: native Spell authoring, publication, compilation and canonical import/replay
now include the Product Library path. The root catalogue projection atomically stores level, verified
school identity, Class UUIDs and casting time; native reads filter before pagination, order by
name/level/school, resolve current labels and fail closed on stale metadata. The `/spells` route uses
the native list/summary. Fresh checks pass 6 native and 14 web tests, 8/8 Convex and 2/2 web typecheck
tasks, format and lint. Independent review found and closed one anonymous-owned summary defect, then
reported no findings. Evidence: `.codex/validation/phase82-c09-final/acceptance.md`. Accepted is now
**30/75**.

2026-09-08 P07 accepted: native Equipment deletion now proves active and saved Character inventory,
equipment and starting-choice cleanup plus removal of Equipment-derived action, resource, proficiency
and modifier contributions while private drafts, notes and unrelated state survive. Fresh serial
checks pass 17 tests across five suites plus 8/8 Convex typecheck tasks, format and lint. Evidence:
`.codex/validation/phase82-p07-final/acceptance.md`. Accepted is now **29/75**.

2026-09-08 C15 accepted: native authored drafts/publication/deletion and Campaign sharing derive
authority from current identity, protect master and foreign content, keep drafts private, constrain
shares to current active same-System homebrew, mask maturity and revoke visibility with membership or
source loss. Fresh current-source checks pass 49 tests across four suites. Evidence:
`.codex/validation/phase82-c15-final/acceptance.md`. Accepted is now **28/75**.

2026-09-08 P05 accepted: native personal and scoped Campaign rests atomically apply current-policy HP,
hit-die, exhaustion, resource, slot, companion, modifier and roll-evidence recovery with exact replay.
Completed rests now delete only matching Character scalar-reduction effects inside the same mutation;
short/long matching, preservation, stale preview and late rollback are covered. Fresh serial checks pass
19 tests across four suites plus 8/8 typecheck tasks; independent persistence review found no findings.
Evidence: `.codex/validation/phase82-p05-final/acceptance.md`. Accepted is now **27/75**.

2026-09-08 P06 accepted: native personal, Campaign TABLE, private GM and scoped
Character-private rolls use current authority, Sheet mechanics and server-side unbiased randomness.
Immutable evidence stays within bounded private history or the TABLE conversation; focused coverage
proves privacy, retention, replay, masking, discard/clear, rest consumption and rollback. Fresh
current-source checks pass 21 tests across three suites. Browser cohort, Encounter, concurrency and
release proof retain their owning cases. Evidence:
`.codex/validation/phase82-p06/final/acceptance.md`. Accepted is now **26/75**.

2026-09-08 C10 and C05 accepted: native Vehicle and Creature authoring/publication cover canonical and
custom records, owner-private active/draft reads, exact-System Guided copy, normalization, save,
publication, replacement, deletion, export and artwork. Canonical import/audit preserves exact source
identity and rolls back conflicts. Fresh shared current-source checks pass 11 native, 5 source-data and
99 focused web tests. Downstream Character/Encounter/Campaign consumers and promotion retain their
owning cases. Evidence: `.codex/validation/phase82-c05-c10-final/c10-acceptance.md` and
`.codex/validation/phase82-c05-c10-final/c05-acceptance.md`. Accepted is now **25/75**.

2026-09-08 C01 accepted: public native Game System capability/detail/summary/pagination preserve
canonical UUID/checksum identity and validate bounded catalogue-source bindings. Indexed Rules
Catalogue browse/search/category/count reads cover stable continuation, System filters, owner/master
isolation, materialized totals and corruption/incomplete-metadata rejection. Fresh current-source proof
passes 40 tests across six suites. Per-domain selectors, Rules Kernel execution and release retirement
retain their owning cases. Evidence: `.codex/validation/phase82-c01-final/acceptance.md`. Accepted is now
**23/75**.

2026-09-08 F11 accepted: internal UUID-targeted role provisioning requires a verified active account;
authorization reads current stored Better Auth role/session state and rejects bans, revocation and
ordinary users. Every provider-admin endpoint returns 404, including impersonation and arbitrary user
updates. Social moderation list/open/review operations use the shared guard. Fresh current-source
checks pass 30 auth/admin/moderation tests; official cloud-development codegen and typecheck evidence
cover the generated bindings. Pre-existing provider ID preservation remains with staging promotion.
Evidence: `.codex/validation/phase82-f11-final/acceptance.md`. Accepted is now **22/75**.

2026-09-08 P01 accepted: native Character draft integration covers authenticated create/reopen,
stable UUID/alias reads, private paginated recovery, generation-bound save/discard, immutable System
binding, union quota counting and Sheet-state preservation. Generated Convex web bindings cover stable
create retry, save, recovery and a visible generation-bound discard action. Fresh current-source checks
pass 9 backend and 15 web tests plus web typecheck, driver types, format and lint. An exploratory
personal-development browser run created the draft, then exposed the separate full-corpus Builder query
limit; exact cleanup passed and that performance work remains with C06/P02/V15/R08. Evidence:
`.codex/validation/phase82-p01-final/acceptance.md`. Accepted is now **21/75**.

2026-09-08 C12 accepted: retained authenticated personal-development proof covers copy, get, save,
recovery and discard across all eight authored domains with exact round trips, privacy, stable routes
and cleanup. The shared web path is exercised by complete Background, Class and Feat browser journeys
through list-to-detail editing, save/reload, retained draft-only recovery, final discard and list return
with zero legacy requests/errors. Focused authored-image integration proves scope isolation, discard and
active-deletion separation, reference-aware cleanup and stale-settlement fencing. Fresh current-source
checks pass 27 backend and 60 web tests. Evidence:
`.codex/validation/phase82-c12-final/acceptance.md`. Accepted is now **20/75**.

2026-09-08 Character portraits: direct owner upload/read/save/remove now use Convex/R2.
Local coverage verifies signed image bytes, failed replacement preservation, revision fencing,
Builder preservation, replay, reference-aware cleanup and account purge. Independent review
found no actionable runtime defect. Evidence: `.codex/validation/phase82-character-portrait/local-progress.md`.
Campaign/VTT portrait projection, VTT maps, managed R2 enforcement and complete lifecycle proof
remain. F14 stays IN_PROGRESS; accepted remains **11/75**.

Replace Supabase, Kysely, SQL application logic, Netlify product functions, tRPC, and GoRules with
Convex, Better Auth, and the TypeScript Rules Kernel before launch.

The denominator is fixed at **75 cases**. Defects attach to an existing case. Adding, removing, or
splitting a case requires explicit user approval. Architecture is recorded in
[ADR 0029](../adr/0029-convex-backend-cutover.md).

`packages/db` cannot be removed until `F15` verifies preservation of the complete source-data tree
in `packages/source-data/src`, including SRD source files, PDFs, text, JSON ledgers, and assets.
`R03` requires that evidence before deletion; the canonical corpus is retained in Git.

After the cutover is complete, review the domain data models and decide whether redesign is
warranted. This user-requested follow-up is separate from the fixed 75-case cutover denominator;
do not pre-build that redesign. Required native Convex transactions, indexes, authorization, and
approved ownership boundaries remain part of the cutover, not deferred model-review work.

## Progress

2026-09-08 C04 accepted: retained personal-development and browser proof covers base/subclass
publication, parent/category races and the full Class authoring lifecycle with exact cleanup. Class
family plus shared client proof covers replayable pagination and forward/backward windows. A new
integration test closes Class-specific source loss by deleting an owned Class referenced by a
committed Character while preserving its private working draft and unrelated state. Final checks pass
18 backend tests, 11 web tests, 8/8 typecheck tasks, format and lint. Evidence:
`.codex/validation/phase82-c04-final/acceptance.md`. Accepted is now **19/75**.

2026-09-08 C07 accepted: retained personal-development proof covers the complete Feat
authoring/publication browser lifecycle with exact cleanup and zero legacy requests/errors. Feat uses
the shared catalogue and atomic deletion paths freshly checked for C03; its specific source-loss tests
cover create-only and canonical/edit Character drafts while preserving unrelated choices and private
edits. Seven Feat backend and seven Feat web tests pass on current source. Evidence:
`.codex/validation/phase82-c07-final/acceptance.md`. Accepted is now **18/75**.

2026-09-08 C03 accepted: retained personal-development proof covers the complete Background
authoring/publication browser lifecycle with exact cleanup and zero legacy requests/errors. Native
backend plus rendered-client catalogue proof covers bounded pagination, filtered counts, forward and
backward windows and search/scope cursor resets. Shared atomic deletion proof covers Background
source-loss reconciliation across personal, create-only and Campaign-assigned Characters. Fresh
current-source checks pass 47 backend and 20 web tests. Evidence:
`.codex/validation/phase82-c03-final/acceptance.md`. Accepted is now **17/75**.

2026-09-08 C02 accepted: local and personal-development System evidence proves canonical public UUID,
DTO and checksum round-trip plus corruption rejection. Fresh current-source authored proof passes the
copy, publish, read and replacement path with stable public identity, stored/recomputed checksums,
unchanged canonical source and prior-version preservation after rejected publication. Evidence:
`.codex/validation/phase82-c02-final/acceptance.md`. Per-domain browser lifecycles, deep clone semantics
and release deployment remain with their owning cases. Accepted is now **16/75**.

2026-09-08 C14 accepted: the shared clone passes fresh conformance across all 1,051 canonical records
and eight authored domains, with new owned UUIDs, stable internal remapping, preserved external
references and unchanged sources. The native Convex boundary passes all eight domains; retained
authenticated development proof covers one deepest record per domain, and 12 Guided copy routing
tests pass. Other-domain browser lifecycle breadth remains with C03-C10. Evidence:
`.codex/validation/phase82-c14-final/acceptance.md`. Accepted is now **15/75**.

2026-09-08 V01 closure attempt: a bounded actual-backend Blueprint driver and guarded exact fixture
cleanup were added and independently reviewed. Final local evidence passes 5 focused tests, 8/8 Convex
typecheck tasks, strict driver types, lint and format. Three confirmed personal-development pushes,
including a current-source retry after shared System-reader separation, failed during module loading at
Convex's 64 MB limit, before deployment or fixture mutation. V01 stays IN_PROGRESS pending
actual-backend execution; the same headroom failure remains an
R08 risk. Browser Run wiring is not a V01 requirement. Evidence:
`.codex/validation/phase82-v01-final/local-progress.md`. Accepted remains **15/75**.

2026-09-08 F05 accepted: retained real local HTTP proof covers signup, loopback email/link capture,
verification, email/username login, protected native bearer/JWT reads, recovery, revocation and
signup-bypass denial. Current-source auth/email tests pass 16/16 and cover the repaired confirmation
callback plus rendered local delivery; unchanged confirmation browser surfaces retain their three
passing browser checks, and the current Convex typecheck passes. Managed Resend delivery remains R09
promotion scope. Evidence: `.codex/validation/phase82-f05-final/acceptance.md`. Accepted is now
**14/75**.

2026-09-08 acceptance-scope audit: 21 cases carried at least one blocker owned by another case or
outside their declared proof tier. Twenty still had a real case-specific gap. F05's managed-mail
requirement was removed and its corrected closure is recorded above. The original R06 review accepted
the then-current external-executor topology. That conclusion and evidence are historical; the
2026-09-22 in-place R06 amendment at the top of this document supersedes it. Accepted was then
**13/75**.

2026-09-08 native Encounter command packet: enemy Feature resource changes and action rolls now use
the immutable Creature snapshot, installed actor policy, atomic charge updates, authoritative roll
evidence, TABLE conversation storage and replay-safe receipts. Prepared or active Runs can replace
their optional-combat snapshot from current Campaign-enabled same-System definitions without coupling
to later initiative graph publication. Historical lifecycle receipts retain their original optional
snapshot checksum. Final focused evidence passes 38 tests, 8/8 Convex typecheck tasks, strict lint and
format; independent persistence/replay review found no remaining P0-P2 issue. Evidence:
`.codex/validation/phase82-native-optional-combat-final/local-progress.md`. V08/V09/V10 remain
IN_PROGRESS pending structural/action commands, native browser/player paths and complete lifecycle/E2E
proof. Accepted remains **12/75**; no deployment occurred.

2026-09-08 C13 accepted: publication validation and mechanics compilation now pass review across
all eight authored domains. Fresh serial tests pass 58/58 across eight suites; current Convex
typecheck passes eight tasks. Independent review found no remaining issue, including the original
Class action/normalized-document mismatch. Source hashes and case evidence are retained in
`.codex/validation/phase82-acceptance-closure/c13-proof.md`. Accepted is now **12/75**.
Case acceptance follows its required proof; gate and release lifecycle validation remain separate.

2026-09-08 Campaign-file web wiring: upload intent, direct signed PUT, finalization, attachment
creation, paginated reactive listing, authorized delivery and removal now call generated Convex
functions. The unused attachment query key and browser tRPC facades are removed. Two focused web
journeys, both web typecheck targets and strict scoped lint pass. Evidence:
`.codex/validation/phase82-campaign-file-web/local-progress.md`. Hosted R2 enforcement, other media
profiles and complete media lifecycle proof remain. F14 stays IN_PROGRESS; accepted remains
**11/75**. No deployment.

2026-09-08 Campaign-file actions: native public Node finalization now reuses the existing authorized
claim/process/settle path with READY replay, validation rejection and fenced operational retry.
Attachment delivery rechecks current Campaign membership and signs the verified SOURCE for five
minutes with MIME/disposition parameters. Three affected suites / 24 tests, Convex typecheck and
strict lint pass. Evidence: `.codex/validation/phase82-campaign-file-actions/local-progress.md`.
Hosted R2 enforcement and complete media lifecycle proof remain. F14 stays
IN_PROGRESS; accepted remains **11/75**. No deployment.

2026-09-08 account-reference correction: retained Social applications now prevent applicant account
deletion in every lifecycle status, preserving SQL RESTRICT without new storage or retention policy.
Real Better Auth deletion tests prove complete rollback for all six statuses and successful unrelated
account cleanup. Nine affected suites / 79 tests, Convex typecheck and strict lint pass. Evidence:
`.codex/validation/phase82-social-account-references/local-progress.md`. Native listing deletion still
requires its complete reference-safe application/invitation cascade before activation. The email-handoff
decision remains open. P17 remains IN_PROGRESS; accepted **11/75**. No deployment.

2026-09-08 evidence-preservation correction: bounded moderation evidence validation no longer trims
captured text or normalizes System UUID case. Historical SQL timestamp offsets and local-time
seconds/microseconds are retained through audited opens and review transitions. Final focused checks:
31 native tests, 13 contract tests, Convex typecheck and strict lint pass. Evidence:
`.codex/validation/phase82-social-evidence/local-progress.md`. Full source inventory/import comparison
remains required; unsupported records must stop migration rather than be rewritten or dropped.
The separate Resend in-flight boundary question remains open. P17 stays IN_PROGRESS; accepted **11/75**.

2026-09-08 native reporting/review packet: report creation captures immutable bounded server evidence;
moderators receive metadata-only queue pages and audited evidence opens/review transitions. Retained
reporter, reported-profile and moderation-actor references atomically restrict account deletion.
Final affected evidence: 71 native tests, 12 contract tests, Convex typecheck and strict lint pass;
deletion tests now complete and verify their scheduled cleanup before teardown. Evidence:
`.codex/validation/phase82-social-reports/local-progress.md`. The architect-approved immediate safety
enforcement/bounded cleanup contract is recorded in ADR 0029; its implementation, native browser wiring,
exact historical evidence migration and full local lifecycle remain pending. No deployment occurred.
P17 stays IN_PROGRESS; accepted remains **11/75**.

2026-09-08 native discovery packet: keyword search now follows approved Convex matching/relevance;
filter-only browse remains newest-first. Shared native cursor contracts preserve all structured
filters, current authorization/masking and empty-page continuation. Atomic search projection upkeep
and a strict bounded internal backfill cover existing listings. Search explicitly handles oversized
reactive ranges because native text search ignores row/byte read limits. Final affected evidence:
60 native tests, 14 contract tests, Convex typecheck, strict lint and clean independent re-review.
`.codex/validation/phase82-social-discovery/local-progress.md` records native/emulator proof boundaries.
No deployment/backfill execution occurred; native browser and real-backend/full lifecycle proof remain
pending. P17 stays IN_PROGRESS; accepted remains **11/75**.

2026-09-08 native unblock packet: removing an actor-owned directional block now consumes the existing
hourly allowance atomically without touching reverse blocks, membership or admission/notification
history. Four affected suites / 31 tests, Convex typecheck and strict lint pass. Evidence:
`.codex/validation/phase82-social-unblock/local-progress.md`. Creation/fanout, block-list pagination,
cleanup and browser wiring remain pending. P17 stays IN_PROGRESS; accepted remains **11/75**.

2026-09-08 discovery ruling: the architect approved native Convex search patterns wherever the cutover
raises a search-semantics mismatch. Keyword search will use native matching/relevance ordering, with
filter-only browsing newest-first; later changes follow user feedback. No custom compatibility search
infrastructure is required. Decision evidence:
`.codex/validation/phase82-social-discovery/search-contract-decision.md`.

2026-09-08 native Social inbox packet: four participant/current-listing-owner application/invitation
queries now use indexed PENDING/HISTORY cursor groups, current counterpart/block checks and strict
masked DTOs. Invitation expiry uses a fixed explicit horizon across pages and read-only EXPIRED
projection; native clients must reset both groups at the next deadline/on resume. All 159 affected
native tests, eight shared contract tests, Convex typecheck and strict scoped lint pass. Evidence:
`.codex/validation/phase82-social-inboxes/local-progress.md`. Native browser binding, discovery,
block/moderation lifecycle, complete notification revalidation and real-backend/full local lifecycle
proof remain pending. P17/P18 stay IN_PROGRESS; accepted remains **11/75**. No deployment.

2026-09-08 native Social admission packet: application submission/withdrawal/decision and username
invitation creation/acceptance/decline/revocation now share atomic membership admission, immutable
expectations, duplicate/rate checks and safe notification changes. Accepted replay preserves current
membership; rejoin starts a new access epoch. The existing dispatcher expires due invitations and
rechecks deadlines before feed/email processing. All 149 affected tests, Convex typecheck and strict
scoped lint pass; independent persistence/authorization review has no findings. Evidence is retained in
`.codex/validation/phase82-social-admission/local-progress.md`. Inbox reads followed in the packet above; discovery search,
block/moderation lifecycle, complete source revalidation, native web and real-backend/full same-source
lifecycle proof remain pending. P09/P10/P17/P18 stay IN_PROGRESS; accepted remains **11/75**. No deployment.

2026-09-08 native Campaign update packet: active-owner/versioned metadata, catalogue dependency
rejection, dynamic assigned-Sheet attunement validation and linked Social admission/version effects
are implemented. Five focused suites pass 53 tests, Convex typechecking and strict lint pass, and
independent persistence/authorization review has no remaining findings. Evidence is retained in
`.codex/validation/phase82-campaign-update/local-progress.md`. Encounter/frozen-source integration,
managed workload/privacy/contention, native browser wiring and the complete same-source local
lifecycle remain pending. P09/P11/P17 stay IN_PROGRESS; accepted remains **11/75**. No deployment.

2026-09-05 local naming packet: the four native publishers enforce the approved active-name
scope in their shared final transaction while allowing duplicate drafts and same-UUID edits.
The bounded name-only backfill preserves other root fields, validates subclass parents and passes
replay/rollback checks; the form displays recognized conflict errors without exposing unknown
server error data. Focused proof is retained in `.codex/validation/phase82-active-names/proof.md`.
Managed backfill/concurrency, remaining domain ports and full lifecycle acceptance remain open;
this packet adds no accepted cases and makes no deployment claim.

Current accepted count: **12/75**. `F08` accepted 2026-09-04: the real two-context recovery
journey passes reset, old-session revocation, second-account isolation, new-password login,
SSR/reload and logout with zero legacy requests or unexpected browser errors. Hydration-gated
submission and shared avatar error handling close the observed UI failures. Fifty affected tests,
web/driver typechecks, focused independent review and exact fixture cleanup pass. See
`.codex/validation/phase82-auth-closure/recovery-proof.md`. Earlier packet counts below are historical;
full-source release/promotion validation remains open.

The native Background lifecycle now passes the two-account personal-dev publication proof:
concurrent requests consume one saved draft; active reads/checksums remain private and stable;
invalid/stale publication rejects; replacement, owned copy, discard and deletion preserve the
expected draft/active boundaries. Seventeen publication tests and affected typechecks pass.
Exact accounts/content and their empty default source were cleaned. See
`.codex/validation/phase82-foundation/publication-managed-proof.md`. The browser now also passes
Guided copy/save/reload/equipment, Activate, published desktop/mobile reload, Edit, working-draft
isolation and reactivation, with zero legacy requests/errors and exact cleanup. A shared Guided
switch fix passes its deferred-save regression; see
`.codex/validation/phase82-foundation/publication-browser-proof.md`. Catalogue, list-returning
delete/discard browser paths, dependent reconciliation and other publishers remain; acceptance
is still **10/75**.

Background artwork now uses the shared native Convex/R2 media path. Draft/active separation,
ownership, stale processing rejection, immutable recrops and reference-aware cleanup pass the
43-test backend shard and independent security review; 12 shared media UI tests pass. The real
localhost/personal-dev authoring journey passes login, resolution, save/reload and exact owner
checks with zero legacy requests or console errors. Exact fixtures were cleaned. Evidence:
`.codex/validation/phase82-foundation/authored-media-proof.md`. Catalogue/guided-copy/full
publication and remaining media profiles still keep C03/F14 in progress; accepted remains **10/75**.

Guided Background starting gear now uses the same native, System-scoped Equipment reader as
Advanced authoring. Fourteen backend tests, two real-query-builder tests, typechecks and the
focused personal-dev browser journey pass with zero legacy requests/errors and exact fixture
cleanup. See `.codex/validation/phase82-foundation/guided-equipment-proof.md`. This closes the
selector transport, not the remaining catalogue/guided-copy/publication acceptance requirements.

Historical C16 implementation checkpoint: the resolver moved to `packages/authoring`, with SQL and native
Convex source adapters sharing one implementation. Original pure tests are retained; the affected
native resolver/import suite passes 18 tests. Personal dev now resolves/normalizes the complete
canonical Acolyte (48 scopes, 371 Equipment choices) without losing nested equipment UUIDs.
Owner isolation, missing/stale metadata rejection, exact seed backfill/audit and fixture cleanup
pass. Remaining catalogue sources, web authoring/publication and Rules Kernel execution/pause/resume
are not accepted. See `.codex/validation/phase82-foundation/equipment-options-proof.md`.

| Gate      | Subject                       | Accepted |  Total |
| --------- | ----------------------------- | -------: | -----: |
| 1         | Foundation, auth, operations  |       14 |     15 |
| 2         | Content and rules             |       15 |     16 |
| 3         | Characters, Campaigns, Social |       12 |     19 |
| 4         | Scene, Encounter, VTT         |        2 |     15 |
| 5         | Cutover and release           |        1 |     10 |
| **Total** |                               |   **44** | **75** |

`F07`, `F09`, and `F10` accepted 2026-09-04: the two-account localhost/personal-cloud-dev browser
journey passes login, SSR/reload, username collision/rename/case preservation, same-browser account
isolation, logout/revocation, exact persisted profiles, and anonymous/spoofed-owner denial. The
packet fixes Profile subscription identity, root recovery-provider lifetime, competing sign-in
navigation, and the account menu's pre-hydration readiness. Focused checks pass (18 Profile/root,
7 login/redirect, 9 Shell tests) and final web typechecks pass. One browser fetch canceled by a hard
document navigation is classified only when paired one-to-one with the same-stage client abort;
unmatched application/network failures remain blocking. No staging/production or broad suite ran.
See `.codex/validation/phase82-foundation/profile-browser-closure-proof.md`.

Notification consumption is now native Convex (`P18` in progress): recipient-only feed,
seen/read state, channel preferences and reactive shell integration. Source delivery is not yet
migrated. The real authenticated browser journey now passes login, server-rendered reload, native
feed and logout/revocation with no legacy tRPC/Supabase requests. The shared account-avatar adapter
uses Convex/R2. This closes `F03`; other media profiles keep `F14` in progress.

Invitation-page latency diagnosis: a fresh optimized build reaches an editable form in
766/324/273ms across fresh browser contexts, versus Vite's 8098/5091/2505ms. The optimized server's
2030ms module initialization occurred before listening and is excluded from browser timings.
These three diagnostic samples show substantial development overhead, not accepted cold-host or
gameplay performance. Vite remains slow. See
`.codex/validation/phase82-foundation/avatar-auth-shell-proof.md`.

Accepted: `F01` (local deployment/codegen), `F02` (foundation contracts/review),
`F03` (SSR/native bearer authentication, 2026-09-04), `F04` (closed signup), `F05` (verified signup, 2026-09-08), `F06` (invitations),
`F07` (login), `F08` (recovery/revocation, 2026-09-04), `F09` (usernames), `F10` (profile privacy), `F13` (local email delivery),
and `F15` (canonical source preservation/import), plus `C13` (all-domain publication validation
and mechanics compilation, 2026-09-08) and `R06` (Session DO live-command authority, 2026-09-22).
The other six acceptances were recorded 2026-09-03. Real local HTTP checks prove verification, email/username login, native bearer/JWT,
atomic password recovery, revocation, concurrent reset/resend, and cookie-origin rejection. Twelve
focused component tests and the Convex typecheck pass. Remaining auth cases retain their own
web/integration requirements; managed ingress/client-IP attribution is not inferred from loopback.
Evidence is under `.codex/validation/phase82-foundation/`. F15 extraction preserves all 1083 source
files. Its pure import preflight now validates 1 System, 1051 authored records, and 50 reusable rule
definitions without stripping fields. Local seed and complete read-back passed; identical repeat
inserted zero records and reused all 1104 logical records with the same manifest checksum. Seven
import regressions, eight definition-contract tests, Convex typecheck, independent review, and real
HTTP denial of all eight internal endpoints pass. Deep authored payloads are losslessly JSON-encoded
without changing source models. The source-data build and transitional DB consumer typecheck pass.
The original acceptance above was local. Cloud-dev seed/read-back now also passes with the same
manifest checksum: 1101 inserted, 3 previously bootstrapped records reused, all 1051 subjects and
50 definitions verified. The first count-only Class batch timed out before writing; a 128 KiB
input target plus the existing ten-record ceiling fixes this without weakening validation or
splitting documents. Nine batching/import regressions pass. No staging/production code was
uploaded; publication/copying/runtime cases remain unaccepted.

`F10` now has caller-only Convex profile reads/updates, 17 passing focused auth/recovery/email tests,
a passing Convex typecheck, and a clean targeted security review. Late-abort proof restores both
the nested Better Auth username and profile bio. Profile web reads/saves now use native Convex
subscriptions/mutations; old tRPC profile adapters were removed. Eleven profile component tests,
five shared username-availability tests, and 19 auth-form tests pass. Clean fields follow updates
without replacing unsaved edits, and loss of authentication hides the form. Avatar remains in `F14`.
Convex's supported static API generation now isolates the client type boundary (`F02`), and the
web app typecheck passes without backend casts or added peer dependencies. Browser journeys
remain pending; the local Vite cache permission issue is separate from the now-working cloud backend.
`F11` now has the supported local Better Auth component/admin schema, internal-only UUID-targeted
role provisioning, current role/session checks, and no public provider-admin routes. Nineteen
affected auth/recovery/admin tests pass across the first shard and corrected admin-only rerun;
targeted security review found no source defects. Official cloud-dev codegen/push and the Convex
typecheck now pass; the stale role/ban bindings are resolved. The latest auth-admin/System/import
shard passes 22 tests. No-reset persisted-data compatibility and deployed privileged-action proof
remain. Neither F10 nor F11 is accepted yet.

`F02` foundation review is accepted. Its one finding was a bootstrap that could admit
multiple Systems with only one platform source. Bootstrap now requires exactly one
paired System; rejection/public-nondisclosure and existing pagination/import tests
pass (17 tests), as do the schema build and Convex typecheck. Future domain APIs still
need their own proofs. Cloud dev retains the previously paired canonical System;
the source-pairing correction is now included in the successful invitation development push.

`F06` is accepted: CLI-only invitation issuance, hashed recipient-bound
24-hour tokens, rotation, and atomic redemption into a verified ordinary account. Public signup
remains closed. Five Convex tests and 33 affected web tests pass (one client test corrected to
use the contract's valid email shape); web app typecheck passes. Security review found no
exploitable defect. The standard signup CSRF middleware also protects redemption. The user confirmed
actual delivered-link registration and the intentional redirect to sign-in; browser checks prove
hydration and fragment cleanup. Real personal-dev concurrent HTTP redemption now proves exactly
one success per invitation, followed by email/password login and protected bearer/JWT calls for
two temporary users. Signup remains closed and fixtures are cleaned. No test email was sent.
The final enabled-typecheck dev push and bounded HTTP checks now pass: CLI/mutation endpoints
are private, browser foreign origins reject both with and without cookies, and invalid redemption
returns no session cookie. No account or real invitation email was created by that check.

The shared browser blocker is fixed. Netlify discarded open static response streams, preventing
Vite's Windows cache rename; a retained Yarn patch releases them and the middleware regression
passes. The SSR auth proxy also now reconstructs TanStack NodeRequest from Web fields instead of
assuming Undici private state. Six proxy tests, two query-bridge tests and both web typechecks pass.
One localhost browser/managed-personal-dev check now passes sign-in rendering, signed anonymous
session access, invalid-invitation hydration and fragment clearing with no console/page errors
(16.44 seconds; `auth-proxy-exact-browser.log`). No ACL/security weakening or simultaneous heavy
validation. This was the earlier anonymous browser check. The later native-avatar/authenticated
journey closes F03 as recorded above; invitation-specific proof separately closes F06.

`C01`/`C02` are now in progress: public System detail and paginated catalogue summaries use indexed
reads, validate canonical UUID/checksum identity and catalogue source bindings, and return the
shared DTOs without Convex storage metadata. Nine query regressions plus seven existing import
regressions pass (16 tests); schema build passes. Generated bindings, backend/web app typechecks,
and the actual cloud-dev System-query smoke now pass. The `/systems` web list now uses bounded
Convex cursor pages and a request-local shared client for SSR loaders/native hooks/subscriptions.
The detail page now reads its exact catalogue summary, and authored routes share the native
System query cache. Ten backend query tests, four web page tests, serial app/test/story
typechecks, and the System-detail definition-authoring Storybook interaction pass. Official
cloud-dev push/codegen and canonical exact-summary read-back pass. The story runner reports
a tooling-only missing-source sourcemap warning for `@react-refresh`. Rule capability,
definition editing, other-domain selectors and the broader authored UUID/publication flows
remain transitional; C01/C02 are not accepted.

`C12`/`C14`/`C15` and `P19` now have the private-draft foundation in progress. Native Convex
save/get/discard and platform-master copy use server identity, lossless payload storage,
the shared clone algorithm, and the extracted existing entitlement policy. Fifteen focused
draft/import tests and four retained entitlement tests pass. Independent review's future-SRD
URL collision was fixed by reserving the legacy encoding range; tests also cover published
root plus edit counting once and base-version/discard preservation. Official personal-dev
push/codegen/typecheck passes, and all four deployed endpoints deny anonymous callers.
One idempotent dev backfill/read-back reused all 1104 canonical records (1051 subjects,
50 definitions, one System plus source/catalogue), inserting no new source records and
preserving manifest checksum `a3b7dfea0de330e0c62952bc11d1c72a6b56c7f888baf040a867389662a7456a`.
Authenticated real-development copy/get/save/get/discard now passes for all eight authored domains,
with anonymous/foreign-user denial, master edit denial, stable aliases, and exact payload round trips.
The actual deepest Class is 16 levels; equipment and spells exercise 21 and 22 levels. No public
transport flattening is needed for these cases. Web recovery, media cleanup, publication,
owned-published copies, sharing and other capacities remain; no content case is accepted yet.

Native owner/domain draft recovery now has bounded, payload-free summaries with Convex reactive
pagination. Sixteen affected tests, generated API typecheck and the two-account development
recovery journey pass, including exact cleanup. Its 84.32s is the complete fixture run, not page
latency. Evidence: `.codex/validation/phase82-foundation/draft-recovery-proof.md`. C12 remains
IN_PROGRESS pending the complete web authoring flow; current acceptance remains **10/75**.

`C03`–`C10` now include native detail-read implementation evidence, alongside `C12`/`C15` recovery
and privacy. Existing domain DTOs, compact aliases, invalid-draft fallback, and referenced-only
metadata are preserved. The affected Convex/System shard passes 24 tests, the shared reference
collector's legacy shard passes 17, and typecheck/codegen/dev push plus independent review pass.
Real personal-dev HTTP detail/draft reads pass for all eight deepest canonical examples, including
owner/foreign denial and invalid-draft recovery; all temporary fixtures are cleaned. Evidence:
`.codex/validation/phase82-foundation/content-detail-proof.md`. Native list/selectors and web
authoring/publication integration remain; the fixed accepted count is unchanged at 6/75.

Invitation delivery and registration were confirmed by the user. Their own sign-in was not tested;
the separate two-account HTTP proof verifies the normal login path. A targeted startup correction
stops the invitation page loading gameplay modules;
393 scripts versus 859 in the complete initial trace, with final sample loads of 4.15s fresh
browser cache and 1.90s repeat. Nine focused tests and guest-route/token-cleanup browser checks
pass. This is not performance acceptance: first-load development assets remain too heavy.
The owned Vite server remains available for the user's auth testing; no additional email sent.

POC evidence does not accept production cases. A case becomes `ACCEPTED` only when its required
development proof is green on the integrated Phase 8.2 source state. Staging is reserved for
packaging, managed secrets, external integrations, authorization, and network performance after
the complete development release lifecycle passes.

Class publication now passes focused backend proof: normalized ACTIVE payload commit,
transactionally rechecked source fingerprints, 53 serial source regressions, and the managed
two-account lifecycle including parent deletion/category-conversion races. Exact fixture cleanup
and stale-JWT denial pass. Evidence:
`.codex/validation/phase82-class-resume/class-backend-proof.md`. Native Class frontend authoring
now also passes 109 affected web tests and final sequential Class/Background browser journeys
(Guided copy/equipment, save/reload, activation and published replacement), with zero legacy
requests/console errors and exact fixture cleanup. Lossless scope-model compaction fixes the
canonical Fighter resolver timeout without changing the resolved model; sign-in now uses one
router-owned navigation after cache clearing. Evidence:
`.codex/validation/phase82-class-frontend/class-frontend-proof.md`. Catalogue/list semantics,
export, dependent reconciliation and complete final-source lifecycle remain; C04/C13/C16 stay IN_PROGRESS and the
accepted denominator remains **10/75**. This is not full-source release or promotion evidence.

### Approved development runtime — 2026-09-03

Per the user-approved [ADR 0029 amendment](../adr/0029-convex-backend-cutover.md#historical-development-runtime-amendment--2026-09-03),
actual backend integration/E2E may run on the verified main project's isolated personal cloud dev
deployment. Editing, generation, builds, typechecks, pure tests, and `convex-test` remain local.
The retained `LOCAL_INTEGRATION`/`LOCAL_E2E` tier names identify development proof; they no longer
require the Convex backend process itself to run locally. Previous local evidence remains valid
for the source it covered. All scenarios, final-source lifecycle requirements, privacy checks,
performance thresholds, and the 75-case denominator remain unchanged. The user confirmed
`artificertoolkit/artificer-toolkit`: personal dev `flexible-goshawk-837` is selected and named
staging `beaming-pig-820` was created without changing default production or uploading code.
CLI evidence is retained in `cloud-dev-selection.log` and `staging-deployment-create.log` under
`.codex/validation/phase82-foundation/`. The user reports the former staging project deleted.
Staging remains promotion-only; cloud dev is not permission to use staging or production.

## Gate 1 — Foundation, auth, operations

| Case  | Acceptance subject                                          | Required proof    |
| ----- | ----------------------------------------------------------- | ----------------- |
| `F01` | Local Convex development and code generation                | LOCAL_INTEGRATION |
| `F02` | Schema, validators, indexes, and bounded contracts          | REVIEW            |
| `F03` | Better Auth SSR and native-compatible bearer authentication | LOCAL_INTEGRATION |
| `F04` | Server-controlled signup defaults closed                    | LOCAL_INTEGRATION |
| `F05` | Verified signup                                             | LOCAL_INTEGRATION |
| `F06` | Initial account invitations                                 | LOCAL_INTEGRATION |
| `F07` | Login                                                       | LOCAL_INTEGRATION |
| `F08` | Password reset and session revocation                       | LOCAL_INTEGRATION |
| `F09` | Usernames                                                   | LOCAL_INTEGRATION |
| `F10` | Profile privacy                                             | AUTHORIZATION     |
| `F11` | Superadmin authorization                                    | AUTHORIZATION     |
| `F12` | Account deletion                                            | LOCAL_INTEGRATION |
| `F13` | React Email and Resend delivery                             | LOCAL_INTEGRATION |
| `F14` | R2 upload, authorized read, and deletion                    | LOCAL_INTEGRATION |
| `F15` | Deterministic source-data import and audit                  | LOCAL_INTEGRATION |

## Gate 2 — Content and rules

| Case  | Acceptance subject                                         | Required proof    |
| ----- | ---------------------------------------------------------- | ----------------- |
| `C01` | Game Systems and Rules Catalogues                          | LOCAL_INTEGRATION |
| `C02` | Public UUID and checksum stability                         | LOCAL_INTEGRATION |
| `C03` | Background authoring and publication                       | LOCAL_INTEGRATION |
| `C04` | Class authoring and publication                            | LOCAL_INTEGRATION |
| `C05` | Creature authoring and publication                         | LOCAL_INTEGRATION |
| `C06` | Equipment authoring and publication                        | LOCAL_INTEGRATION |
| `C07` | Feat authoring and publication                             | LOCAL_INTEGRATION |
| `C08` | Race authoring and publication                             | LOCAL_INTEGRATION |
| `C09` | Spell authoring and publication                            | LOCAL_INTEGRATION |
| `C10` | Vehicle authoring and publication                          | LOCAL_INTEGRATION |
| `C11` | Effects, grants, modifiers, and reusable definitions       | REVIEW            |
| `C12` | Draft create, save, discard, and recovery                  | LOCAL_INTEGRATION |
| `C13` | Publication validation and mechanics compilation           | REVIEW            |
| `C14` | Deep UUID-safe duplication                                 | LOCAL_INTEGRATION |
| `C15` | Owner, Campaign-share, and master-content authorization    | AUTHORIZATION     |
| `C16` | Node runtime and Rules Kernel execution, pause, and resume | REVIEW            |

## Gate 3 — Characters, Campaigns, Social

| Case  | Acceptance subject                                  | Required proof    |
| ----- | --------------------------------------------------- | ----------------- |
| `P01` | Character drafts                                    | LOCAL_INTEGRATION |
| `P02` | Character Builder choices, readiness, and commit    | LOCAL_E2E         |
| `P03` | Character reconciliation                            | LOCAL_INTEGRATION |
| `P04` | Character Sheet projection and commands             | LOCAL_E2E         |
| `P05` | Hit points, resources, and rests                    | LOCAL_INTEGRATION |
| `P06` | Authoritative rolls and evidence                    | LOCAL_INTEGRATION |
| `P07` | Equipment, inventory state, and grants              | LOCAL_INTEGRATION |
| `P08` | Character replay, concurrency, and rollback         | CONCURRENCY       |
| `P09` | Campaign lifecycle                                  | LOCAL_INTEGRATION |
| `P10` | Campaign membership and authority                   | AUTHORIZATION     |
| `P11` | Campaign content and settings                       | LOCAL_INTEGRATION |
| `P12` | Campaign inventory                                  | LOCAL_INTEGRATION |
| `P13` | Campaign vehicles                                   | LOCAL_INTEGRATION |
| `P14` | Campaign collaboration                              | LOCAL_E2E         |
| `P15` | Sessions and control                                | CONCURRENCY       |
| `P16` | Announcements                                       | LOCAL_INTEGRATION |
| `P17` | Social profiles, listings, applications, and blocks | LOCAL_E2E         |
| `P18` | Notifications and preferences                       | LOCAL_INTEGRATION |
| `P19` | Entitlements and capacity enforcement               | AUTHORIZATION     |

## Gate 4 — Scene, Encounter, VTT

2026-09-10 V02 selection assessment found no native Scene persistence/transport or evidence-only closure.
Current-source validated Scene definitions can exceed Convex document/function limits;
root withdrew the lower-cap suggestion after the user raised creativity concerns. Preserve existing
capabilities with bounded storage/transport; no new size-cap ruling blocks that work. No contract limit
changed. The subsequent bounded checkpoint implements owner-only definition save/read, atomic publication
and an immutable initial live Scene reference. Eight Scene tests pass in the combined 265-test run;
official generation, strict lint and nine build/typecheck tasks pass. V02 is now `IN_PROGRESS`, with
live updates, presentation, hydration, web binding and complete native E2E pending. Return to P17 before
expanding this checkpoint. Evidence: `.codex/validation/phase82-scene-save/integration.md` and the earlier
`.codex/validation/phase82-scene-assessment/assessment.md`. Acceptance remains **46/75**.

| Case  | Acceptance subject                                              | Required proof    |
| ----- | --------------------------------------------------------------- | ----------------- |
| `V01` | Encounter Blueprints                                            | LOCAL_INTEGRATION |
| `V02` | Campaign Scenes independent of Encounters                       | LOCAL_E2E         |
| `V03` | Scene entities, geometry, and visibility facts                  | LOCAL_INTEGRATION |
| `V04` | R2-backed maps and Scene media lifecycle                        | LOCAL_INTEGRATION |
| `V05` | Session admission and presence                                  | AUTHORIZATION     |
| `V06` | Transient collaboration through the Durable Object              | LOCAL_E2E         |
| `V07` | Committed token movement and multi-client convergence           | LOCAL_E2E         |
| `V08` | Encounter lifecycle and optional Scene binding                  | LOCAL_INTEGRATION |
| `V09` | Encounter actors and initiative                                 | LOCAL_INTEGRATION |
| `V10` | Actions, reactions, effects, and selected optional combat rules | LOCAL_E2E         |
| `V11` | Decisions, pause, and resume                                    | LOCAL_INTEGRATION |
| `V12` | Player and GM privacy and redaction                             | AUTHORIZATION     |
| `V13` | Receipts, replay, and reconnect                                 | LOCAL_E2E         |
| `V14` | Same-aggregate contention and unrelated concurrency             | CONCURRENCY       |
| `V15` | Local and managed performance simulation                        | PERFORMANCE       |

V07 is IN_PROGRESS. The local standalone movement slice passes 29 native movement/geometry/Session
tests, 45 legacy/shared tests, Convex and Functions types, and focused lint. Evidence is retained in
`.codex/validation/phase82-ultra-continuation-20260911/v07-standalone-movement-01/completion.md`.
Native standalone undo additionally passes the combined 52-test movement/geometry/fog/Session suite,
Convex types and focused lint, with no independent persistence review findings; evidence is retained
in `.codex/validation/phase82-ultra-continuation-20260911/v07-undo-01/completion.md`.
The native internal mechanics batch passes 17 transactional Character/non-Character tests and eight
Convex type tasks, with focused lint and independent persistence review. The shared condition fold
also preserves equal-count replacement. Evidence is retained in
`.codex/validation/phase82-ultra-continuation-20260911/v07-native-mechanics-01/completion.md`.
Native spatial-effect storage and current target loading additionally pass 14 store tests and
23 target/mechanics tests, with current backend types and lint passing; see
`.codex/validation/phase82-ultra-continuation-20260911/v07-movement-targets-01/completion.md`.
The native spatial adapter now executes frozen damage, terminal target/effect publication, and
Assisted Character pause/resume with entered evidence. Real roundtrip proof exposed and repaired
key-order-sensitive pending-contact and evidence-policy comparisons; currentness still rejects
changed Character effect pins. See
`.codex/validation/phase82-ultra-continuation-20260911/v07-spatial-coordinator-01/completion.md`.
Parent mechanics-bearing movement integration, native command routing and multi-client browser convergence remain
open; this does not satisfy LOCAL_E2E acceptance. The fixed ledger remains 50/75 accepted.

## Gate 5 — Cutover and release

| Case  | Acceptance subject                                                                        | Required proof |
| ----- | ----------------------------------------------------------------------------------------- | -------------- |
| `R01` | All product data flows through Convex                                                     | RELEASE        |
| `R02` | Zero Supabase runtime dependency                                                          | RELEASE        |
| `R03` | Zero Kysely, PostgreSQL application SQL, migrations, and generated Supabase types         | RELEASE        |
| `R04` | Zero GoRules runtime dependency                                                           | RELEASE        |
| `R05` | Zero tRPC and product Netlify functions                                                   | RELEASE        |
| `R06` | Session Durable Object is the active live-command authority                               | REVIEW         |
| `R07` | Canonical docs, ADRs, ERDs, deployment guides, and runbooks match the final system        | REVIEW         |
| `R08` | Complete development lifecycle passes from a fresh isolated Convex development deployment | RELEASE        |
| `R09` | One staging integration/performance promotion and explicit Supabase retirement decision   | STAGING        |
| `R10` | Production deployment and bounded smoke verification                                      | PRODUCTION     |

## Validation cadence

- Each packet runs formatting, affected typechecks, and the smallest affected tests.
- Each acceptance case receives its required focused or integration proof once.
- Each gate receives one integrated run after its source stabilizes.
- Release receives one complete development lifecycle; later source changes rerun from the earliest affected
  stage.
- Staging is not a correctness-debugging environment.
- Existing pure domain, node-map, compiler, and kernel tests are retained. The complete rule corpus
  runs once after kernel cutover stabilizes, not once per browser journey.

## Performance contract

2026-09-04 F03 diagnostic: credential-free SSR no longer exchanges an absent credential for a
401 before reading current anonymous feature flags. Matched compiled-handler warm samples changed
from 300–336 ms to 74–82 ms; a loopback compiled browser probe reached the invitation form in
914 ms initially and 277–295 ms on repeat visits. Server module import was separately about 1.9 s
and is not included in those browser timings. Auth tests, both web typechecks, independent review,
and compiled browser checks pass. The Netlify CLI preview crashed and is not passing evidence;
the final probe used the installed Netlify/Lambda request adapter. These are small diagnostic
samples, not hosted percentiles or V15 acceptance. See
`.codex/validation/phase82-foundation/startup-anonymous-proof.md`. The later F03 functional acceptance
and updated optimized-build timings are recorded in Progress; no performance case is accepted.

- Ephemeral peer preview p95 is at most 150 ms.
- Warm durable peer convergence p95 is at most 250 ms and p99 at most 500 ms.
- No normal authoritative gameplay command has p95 above one second.
- The fixed load is one GM, five players, eleven actors, eight rounds, and up to two actions plus one
  reaction per actor turn.
- Same-aggregate conflicts, unrelated concurrency, replay, rollback, and privacy are included.

## Deferred

Cryptographic commit/reveal dice, visual rules authoring, native UI and DTO generation, D&D 2024,
external/user-authored Game Systems, GraphQL, tRPC, custom queues, dual-write migration, and custom R2
multipart uploads remain out of scope.

After the port, review whether deep authored mechanics would be clearer as UUID-linked sibling
nodes within a cohesive document rather than inline nested objects. Compare authoring ergonomics,
reuse, reference/cycle validation, and execution cost; remove only genuinely redundant wrappers.
This is an investigation, not an approved flattening/refactor or a new acceptance case. Preserve
current mechanics and source identities during the cutover.

Within existing `F02`/`V15`, check actual persisted and returned payload depth/size and hot-path
read/parse/validation/subscription cost across all models. A measured Convex limit or missed
latency target is a cutover defect to resolve now, not deferred cosmetic cleanup. Canonical JSON
encoding solves the observed source-import nesting limit, but is not runtime performance proof.
The local read-only 25-level response probe succeeded (`convex-return-depth-probe-2.log`), so
the observed 16-level database restriction is not assumed to apply to all function responses.
Real domain DTO journeys and latency remain required evidence for their owning cases.
