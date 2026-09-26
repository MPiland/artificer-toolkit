# Phase 8.2 Gate 3: Characters, Campaigns, Social

- **Status:** transitional evidence summary
- **Scope:** acceptance status and evidence origin for the 19 Gate 3 cases
- **Update when:** a Gate 3 case or criterion in the [acceptance ledger](../../roadmap/08-2-convex-cutover-acceptance.json) changes status or evidence
- **Recorded:** 2026-09-25, from the ledger; run `node scripts/acceptanceProgress.mjs` for live counts

Gate 3 has **17/19** cases and **65/71** criteria accepted. A further **5** criteria and **1** case are READY_FOR_ACCEPTANCE: implemented and covered by current tests, awaiting the final-source R08 run ([readiness review](gate-readiness-2026-09-25.md)).

The ledger's `criteria` arrays are the authority for what each case must prove; this page summarizes them with the proof tier and where the evidence came from. Raw logs are not copied here.

> **Evidence location.** Most raw evidence lives only in the Codex backup worktree, under `.codex/worktrees/phase-08-2-convex-cutover/.codex/validation/`: [open question Q2](../../handoffs/phase-08-2-open-questions.md#resolved) counts 653 of the ledger's 725 evidence references there, and every one of the 675 entries in the ledger's evidence arrays uses a `.codex/validation/` path. Only the `phase82-goal-20260923` packet is also copied to ignored `local-validation/`. The final R08 re-proof on the final source will supersede this evidence; the backup worktree is deleted only after R08 passes.

## P01 — Character drafts

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `P01.1` ACCEPTED: Character drafts support create/reopen, save, UUID/alias reads, private paginated recovery and discard.
- `P01.2` ACCEPTED: Generation and active-baseline guards reject stale writes, System binding is immutable, quotas count drafts and Characters together, and Sheet-owned state is preserved.
- `P01.3` ACCEPTED: Web bindings cover a stable create retry, save, recovery and a visible generation-bound Discard draft action.

Evidence:

10 ledger reference(s), 10 under `.codex/validation/` in the backup worktree:

- `phase82-character-drafts` (1)
- `phase82-character-list` (1)
- `phase82-character-list-web` (1)
- `phase82-character-system` (1)
- `phase82-builder-write-web` (1)
- `phase82-builder-browser` (1)
- `phase82-p01-final` (4)

## P02 — Character Builder choices, readiness, and commit

- **Status:** ACCEPTED
- **Accepted:** 2026-09-17 (notes)
- **Proof tier:** LOCAL_E2E
- **Criteria met:** 4/4

What was proven or remains to prove:

- `P02.1` ACCEPTED: Fighter/Rogue multiclass, Life Cleric preparation and slot use, and choice-heavy Dragonborn Builder-to-Sheet journeys pass serially with clean browser diagnostics.
- `P02.2` ACCEPTED: Commit checks the server draft baseline and generation, requires readiness, materializes starting equipment only on first activation, and atomically persists the Character and consumes the draft.
- `P02.3` ACCEPTED: Builder resolution stays within Convex limits with full dynamic validation, and native completions show only expected authentication negatives.
- `P02.4` ACCEPTED: Fixtures are removed exactly and stale JWTs are denied.

Evidence:

22 ledger reference(s), 22 under `.codex/validation/` in the backup worktree:

- `movement-replay-duplicates-20260916` (2)
- `phase82-p02-cleric-finalization` (1)
- `phase82-social-discovery-web` (1)
- `phase82-p02-resolution-wait` (1)
- `phase82-native-character-policies` (1)
- `phase82-native-character-policy` (1)
- `phase82-character-fact-boundary` (1)
- `phase82-character-context` (1)
- `phase82-builder-resolution` (1)
- `phase82-builder-reconciliation` (1)
- `phase82-builder-commit` (1)
- `phase82-feat-assembly` (1)
- `phase82-builder-read-web` (1)
- `phase82-character-system` (1)
- `phase82-builder-write-web` (1)
- `phase82-builder-browser` (1)
- `phase82-p02-preview` (1)
- `phase82-p02-resolution` (1)
- `phase82-p02-json` (1)
- `phase82-p02-react` (1)
- `phase82-p02-cleric` (1)

## P03 — Character reconciliation

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 4/4

What was proven or remains to prove:

- `P03.1` ACCEPTED: Builder preview and commit reconcile current publications through the removal-only rules runtime while preserving Sheet state.
- `P03.2` ACCEPTED: Repair rows keep identity, history and private state, block Sheet play until ready and return to ACTIVE only through a ready commit.
- `P03.3` ACCEPTED: After a same-source publication replacement, read-only preview removes an invalid chosen grant and commit repairs it while keeping UUID, route, damaged HP and inventory.
- `P03.4` ACCEPTED: Direct unshare, authored deletion, membership departure and assignment replacement reconcile personal, assigned and create-only state with containing-transaction rollback.

Evidence:

10 ledger reference(s), 10 under `.codex/validation/` in the backup worktree:

- `phase82-builder-reconciliation` (1)
- `phase82-option-cascade` (1)
- `phase82-builder-commit` (1)
- `phase82-feat-assembly` (1)
- `phase82-source-loss` (1)
- `phase82-native-authored-deletion` (1)
- `phase82-p03-final` (4)

## P04 — Character Sheet projection and commands

- **Status:** ACCEPTED
- **Accepted:** 2026-09-10
- **Proof tier:** LOCAL_E2E
- **Criteria met:** 4/4

What was proven or remains to prove:

- `P04.1` ACCEPTED: The personal Sheet browser journey covers HP, inspiration, conditions, inventory, currency, notes, rests, reload and Owl/Sailing Ship extras with strict diagnostics.
- `P04.2` ACCEPTED: The Spell browser journey covers Learn, Prepare, Cast, reload, slot recovery, Unprepare and Forget within the one-second command limit.
- `P04.3` ACCEPTED: Sheet commands write state, version and receipt atomically, and exact replay returns the current Sheet.
- `P04.4` ACCEPTED: The owner-only Sheet read ignores draft contents and evaluates current authorized sources.

Evidence:

29 ledger reference(s), 29 under `.codex/validation/` in the backup worktree:

- `phase82-spell-cpu-profile` (2)
- `phase82-sheet-commands` (1)
- `phase82-sheet-projection` (1)
- `phase82-sheet-read` (1)
- `phase82-sheet-receipts` (1)
- `phase82-sheet-adjustments` (1)
- `phase82-sheet-resources` (1)
- `phase82-sheet-spells` (1)
- `phase82-sheet-spell-customization` (1)
- `phase82-sheet-inventory` (1)
- `phase82-sheet-extras` (1)
- `phase82-sheet-rest-rolls` (1)
- `phase82-sheet-history` (1)
- `phase82-sheet-panels` (1)
- `phase82-sheet-preparation` (1)
- `phase82-sheet-extra-options` (1)
- `phase82-roll-web` (1)
- `phase82-sheet-web` (1)
- `phase82-sheet-extras-web` (1)
- `phase82-gm-sheet` (1)
- `phase82-gm-writes` (1)
- `phase82-p04-browser-draft` (1)
- `phase82-p04-complete` (1)
- `phase82-p04-spell-performance` (1)
- `phase82-p04-rest-cancellation` (1)
- `phase82-commit-spell-reuse` (1)
- `phase82-class-spell-final` (1)
- `phase82-media-canonical-ids` (1)

## P05 — Hit points, resources, and rests

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `P05.1` ACCEPTED: Personal and Campaign short and long rest preview and completion share current policy, fingerprints and caller-owned hit-die evidence.
- `P05.2` ACCEPTED: One mutation persists HP, hit dice, exhaustion, slots and resources, companions, maximum-HP modifier removal, roll consumption, history and the receipt.
- `P05.3` ACCEPTED: Rests delete only matching scalar-reduction effects, and rollback and exact replay perform no second deletion.

Evidence:

7 ledger reference(s), 7 under `.codex/validation/` in the backup worktree:

- `phase82-sheet-rest-rolls` (1)
- `phase82-gm-sheet` (1)
- `phase82-gm-private-rest` (1)
- `phase82-p05-final` (4)

## P06 — Authoritative rolls and evidence

- **Status:** READY_FOR_ACCEPTANCE
- **Accepted:** 2026-09-08 (reopened 2026-09-25, ADR 0034)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/5

Reopened 2026-09-25 for ADR 0034 player agency criteria. Earlier scoped acceptance evidence still backs the ACCEPTED criteria; the player agency criteria are unproven.

What was proven or remains to prove:

- `P06.1` ACCEPTED: Personal, Campaign TABLE, private GM and Character-private rolls use current authority, Sheet mechanics and server-side unbiased randomness.
- `P06.2` ACCEPTED: Roll evidence persists only in the caller's bounded private history or the TABLE conversation, and private rolls write nothing to the conversation.
- `P06.3` ACCEPTED: Forged and foreign rolls are denied; history trims, replays, discards and clears; rest receipts consume rolls; failures roll back.
- `P06.4` READY_FOR_ACCEPTANCE: Player Campaign rolls default to the Table, with To GM and Just me options, and rolls that change Character state (such as short-rest hit dice) are always GM-visible: Table or To GM, never Just me (ADR 0034).
- `P06.5` READY_FOR_ACCEPTANCE: The GM rolls Private, Blind or to the Table and can reveal a private roll (ADR 0034).

Evidence:

6 ledger reference(s), 6 under `.codex/validation/` in the backup worktree:

- `phase82-sheet-rest-rolls` (1)
- `phase82-campaign-rolls` (1)
- `phase82-collaboration-web` (1)
- `phase82-gm-private-rest` (1)
- `phase82-p06` (2)

## P07 — Equipment, inventory state, and grants

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 4/4

What was proven or remains to prove:

- `P07.1` ACCEPTED: Builder commit materializes authorized starting Equipment and currency once.
- `P07.2` ACCEPTED: Inventory, equip, attune and currency commands use current sources and policy with atomic, actor-bound replay receipts.
- `P07.3` ACCEPTED: Deleting owned Equipment reconciles active and saved inventory and removes that source's action, charge resource, proficiency and equipped-only modifier while keeping other sources.
- `P07.4` ACCEPTED: Anonymous and foreign calls are denied, and Campaign-custody failures roll back.

Evidence:

7 ledger reference(s), 7 under `.codex/validation/` in the backup worktree:

- `phase82-character-inventory` (1)
- `phase82-p07-proof` (1)
- `phase82-p07-final` (5)

## P08 — Character replay, concurrency, and rollback

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** CONCURRENCY
- **Criteria met:** 4/4

What was proven or remains to prove:

- `P08.1` ACCEPTED: Two authenticated clients produce exactly one Builder create/edit commit and one starting-Equipment materialization.
- `P08.2` ACCEPTED: Conflicting same-version Sheet commands have one winner; stale baselines, mismatched replay and anonymous or foreign calls are rejected without changing state.
- `P08.3` ACCEPTED: The SDK restores its subscription after a forced WebSocket close and replays without advancing the stream, and managed runs record real OCC retries.
- `P08.4` ACCEPTED: Post-write failures roll back state, version, receipts and nested Encounter updates.

Evidence:

6 ledger reference(s), 6 under `.codex/validation/` in the backup worktree:

- `phase82-character-concurrency` (6)

## P09 — Campaign lifecycle

- **Status:** ACCEPTED
- **Accepted:** 2026-09-20
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `P09.1` ACCEPTED: The browser journey covers Campaign create, update, default and selected copy, archive, archived copy and deletion across the ACTIVE and ARCHIVED catalogues.
- `P09.2` ACCEPTED: Copying keeps metadata automatic and notebook categories opt-in.
- `P09.3` ACCEPTED: Staged publication, authority, replay, privacy, rollback, quota, custody, Character, Scene, Run and admission contracts pass, with exact cleanup and stale-JWT denial.

Evidence:

14 ledger reference(s), 14 under `.codex/validation/` in the backup worktree:

- `phase82-campaign-read` (1)
- `phase82-archive-admission` (1)
- `phase82-campaign-update` (1)
- `phase82-p09-copy` (1)
- `phase82-gate-progress-20260917` (1)
- `local-convex-linux-20260915` (8)
- `phase82-social-admission (nativeAdmissionEvidence)` (1)

## P10 — Campaign membership and authority

- **Status:** ACCEPTED
- **Accepted:** 2026-09-19
- **Proof tier:** AUTHORIZATION
- **Criteria met:** 5/5

What was proven or remains to prove:

- `P10.1` ACCEPTED: Campaign reads require active membership and consistent owner/role authority, and players see only VISIBLE GM records without internal attribution.
- `P10.2` ACCEPTED: Campaign Sheet endpoints recheck authority without widening personal access, GM commands reject private-note fields, and receipts keep the actual actor.
- `P10.3` ACCEPTED: Leave and removal commit assignment, custody and membership changes atomically, and exact replay after departure writes and grants nothing.
- `P10.4` ACCEPTED: Ownership transfer validates a seven-day offer and hosting capacity, switches roles atomically and advances access epochs.
- `P10.5` ACCEPTED: A four-account browser journey through leave, rejoin, removal, rejoin, transfer and restoration passes with exact cleanup.

Evidence:

15 ledger reference(s), 15 under `.codex/validation/` in the backup worktree:

- `phase82-campaign-read` (1)
- `phase82-campaign-sheet-projection` (1)
- `phase82-p14-clock` (1)
- `phase82-gm-reads` (1)
- `phase82-gm-sheet` (1)
- `phase82-gm-writes` (1)
- `phase82-membership-departure` (1)
- `phase82-owner-transfer` (1)
- `local-convex-linux-20260915` (6)
- `phase82-social-admission (nativeAdmissionEvidence)` (1)

## P11 — Campaign content and settings

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 5/5

What was proven or remains to prove:

- `P11.1` ACCEPTED: Play-settings get and save use current authority, settings versions and enabled same-System sources.
- `P11.2` ACCEPTED: Shares require same-System content, explicit Homebrew parent shares and enabled official parents, and assigned Characters use only Campaign-restricted, owned and shared roots.
- `P11.3` ACCEPTED: Owner-facing projections apply Campaign text presentation while private notes keep their originals.
- `P11.4` ACCEPTED: Catalogue updates reject removing content still used by Characters, drafts, custody, initiative policy or optional combat definitions.
- `P11.5` ACCEPTED: Content removal uses the current Campaign version, and browser removals persist across reload.

Evidence:

14 ledger reference(s), 14 under `.codex/validation/` in the backup worktree:

- `phase82-campaign-settings` (1)
- `phase82-campaign-options` (1)
- `phase82-content-shares` (1)
- `phase82-campaign-sources` (1)
- `phase82-gm-sheet` (1)
- `phase82-gm-writes` (1)
- `phase82-native-unshare` (1)
- `phase82-native-authored-deletion` (1)
- `phase82-campaign-update` (1)
- `phase82-p11-final` (1)
- `phase82-campaign-native-detail` (4)

## P12 — Campaign inventory

- **Status:** ACCEPTED
- **Accepted:** 2026-09-19
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `P12.1` ACCEPTED: Character, party and Vehicle item and currency custody covers producers, privacy, fences, rollback, exact replay, source loss and lifecycle.
- `P12.2` ACCEPTED: Oversized inventories are cleaned up in bounded background work that locks only the affected inventory while unrelated writes continue (ADR 0031).
- `P12.3` ACCEPTED: Real-backend source-loss and manual Vehicle cleanup workloads fail safely under contention, retry and converge exactly.

Evidence:

12 ledger reference(s), 12 under `.codex/validation/` in the backup worktree:

- `phase82-party-inventory` (1)
- `phase82-campaign-currency` (1)
- `phase82-inventory-audit-window` (1)
- `phase82-vehicle-custody` (1)
- `phase82-vehicle-inventory` (1)
- `phase82-native-unshare` (1)
- `phase82-native-authored-deletion` (1)
- `local-convex-linux-20260915` (4)
- `phase82-gate-progress-20260917` (1)

## P13 — Campaign vehicles

- **Status:** ACCEPTED
- **Accepted:** 2026-09-19
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 2/2

What was proven or remains to prove:

- `P13.1` ACCEPTED: Vehicle creation, unavailable/restore, cargo return, destroy, source-loss evacuation and definition selection keep privacy, version fences, rollback and exact replay.
- `P13.2` ACCEPTED: Oversized cargo cleanup keeps unaffected inventory usable, fails safely under contention and converges exactly once.

Evidence:

11 ledger reference(s), 11 under `.codex/validation/` in the backup worktree:

- `phase82-campaign-vehicles` (1)
- `phase82-vehicle-custody` (1)
- `phase82-vehicle-inventory` (1)
- `phase82-native-unshare` (1)
- `phase82-native-authored-deletion` (1)
- `local-convex-linux-20260915` (5)
- `phase82-gate-progress-20260917` (1)

## P14 — Campaign collaboration

- **Status:** ACCEPTED
- **Accepted:** 2026-09-10
- **Proof tier:** LOCAL_E2E
- **Criteria met:** 4/4

What was proven or remains to prove:

- `P14.1` ACCEPTED: Two browser clients pass TABLE send, edit and tombstone, and PARTY and DIRECT privacy.
- `P14.2` ACCEPTED: Shared notebooks create, update and delete, with version contention and matching nonce replay.
- `P14.3` ACCEPTED: Signed file upload and download with name and byte checks, removal and delivery denial pass.
- `P14.4` ACCEPTED: Private GM isolation, TABLE roll convergence and unread reconciliation pass with exact cleanup.

Evidence:

12 ledger reference(s), 12 under `.codex/validation/` in the backup worktree:

- `phase82-chat` (1)
- `phase82-notebooks` (1)
- `phase82-campaign-file-upload` (1)
- `phase82-campaign-file-finalize` (1)
- `phase82-campaign-file-delivery` (1)
- `phase82-notebook-cleanup` (1)
- `phase82-campaign-attachments` (1)
- `phase82-campaign-rolls` (1)
- `phase82-collaboration-web` (1)
- `phase82-p14-clock` (1)
- `phase82-media-csp` (1)
- `phase82-p14-complete` (1)

## P15 — Sessions and control

- **Status:** IN_PROGRESS
- **Accepted:** 2026-09-10 (reopened 2026-09-24, ADR 0033)
- **Proof tier:** CONCURRENCY
- **Criteria met:** 0/4

Reopened 2026-09-24 under ADR 0033. Its earlier evidence proves the superseded Session-scoped contract and is historical; the case must pass again on the final source.

What was proven or remains to prove:

- `P15.1` READY_FOR_ACCEPTANCE: Concurrent Session numbering and metadata, RSVP uniqueness, attendance authority, note privacy, reference pins and finish replay pass.
- `P15.2` READY_FOR_ACCEPTANCE: Sessions are an optional log (schedule, RSVP, attendance, notes, references, recap), and finishing one changes no Encounter Run, presentation or live-table state (ADR 0033).
- `P15.3` IN_PROGRESS: Clock version contention, exact replay, once-only DAILY recovery and watermark hold, and managed recovery stays within limits.
- `P15.4` READY_FOR_ACCEPTANCE: GM adjustment and condition contention, effective projection, secret masking and removal pass, and archived authorization is checked before replay.

Evidence:

10 ledger reference(s), 10 under `.codex/validation/` in the backup worktree:

- `phase82-sessions` (1)
- `phase82-session-notes` (1)
- `phase82-session-references` (1)
- `phase82-notebook-cleanup` (1)
- `phase82-campaign-attachments` (1)
- `phase82-clock-calculations` (1)
- `phase82-campaign-sheet-projection` (1)
- `phase82-p14-clock` (1)
- `phase82-p15-complete` (1)
- `phase82-p15-performance` (1)

## P16 — Announcements

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `P16.1` ACCEPTED: Publication derives current owner authority, rejects archived writes and commits the source and notification intents atomically; matching retries are read-only and changed input conflicts.
- `P16.2` ACCEPTED: TABLE and PARTY targets are derived from the Campaign, and a supplied room ID cannot redirect delivery.
- `P16.3` ACCEPTED: List and get reads enforce PARTY exclusion, membership, departure denial and text masking, and the page stays usable when a deep link is unavailable.

Evidence:

7 ledger reference(s), 7 under `.codex/validation/` in the backup worktree:

- `phase82-announcements` (1)
- `phase82-chat` (1)
- `phase82-p16-final` (5)

## P17 — Social profiles, listings, applications, and blocks

- **Status:** ACCEPTED
- **Accepted:** 2026-09-10
- **Proof tier:** LOCAL_E2E
- **Criteria met:** 5/5

What was proven or remains to prove:

- `P17.1` ACCEPTED: The four-account browser run passes all 22 checkpoints with empty strict diagnostics and private access denials.
- `P17.2` ACCEPTED: Standard masking holds across API, SSR, mutation, realtime and log output.
- `P17.3` ACCEPTED: Both capacity races have one winner and a managed OCC retry, and replay preserves access epochs.
- `P17.4` ACCEPTED: Guarded retention keeps active and recent applications and purges eligible rows, completing scheduled audit and account cleanup.
- `P17.5` ACCEPTED: Moderation and block invalidations preserve accepted membership.

Evidence:

32 ledger reference(s), 32 under `.codex/validation/` in the backup worktree:

- `phase82-social-eligibility` (1)
- `phase82-social-listings` (1)
- `phase82-social-rate-limits` (1)
- `phase82-listing-publication` (1)
- `phase82-listing-management` (1)
- `phase82-social-shared-reads` (1)
- `phase82-listing-republication` (1)
- `phase82-campaign-update` (1)
- `phase82-social-inboxes` (1)
- `phase82-social-unblock` (1)
- `phase82-social-discovery` (1)
- `phase82-social-reports` (1)
- `phase82-social-evidence` (1)
- `phase82-social-account-references` (1)
- `phase82-social-block-create` (1)
- `phase82-social-block-web` (1)
- `phase82-social-invitation-web` (1)
- `phase82-social-discovery-web` (1)
- `phase82-social-editor-web` (1)
- `phase82-social-preference-web` (1)
- `phase82-listing-moderation` (1)
- `phase82-profile-moderation` (1)
- `phase82-social-moderation-web` (1)
- `phase82-social-retention-preview` (1)
- `phase82-social-retention-apply` (1)
- `phase82-social-operator` (1)
- `phase82-social-account-cascade` (1)
- `phase82-social-live` (4)
- `phase82-social-admission (nativeAdmissionEvidence)` (1)

## P18 — Notifications and preferences

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `P18.1` ACCEPTED: The recipient feed, first-seen/read state and profile-owned preferences use Convex subscriptions.
- `P18.2` ACCEPTED: Source intents check current source, counterpart, block and membership, and dispatch and recovery are bounded with latest-25 retention.
- `P18.3` ACCEPTED: The real dev cron delivers a replayed announcement once with provider status sent, and disabling both channels suppresses the next event.

Evidence:

16 ledger reference(s), 16 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (7)
- `phase82-notification-delivery` (1)
- `phase82-announcements` (1)
- `phase82-social-inboxes` (1)
- `phase82-notification-source` (5)
- `phase82-social-admission (nativeAdmissionEvidence)` (1)

## P19 — Entitlements and capacity enforcement

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** AUTHORIZATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `P19.1` ACCEPTED: The Account projection subscribes to tier, shared policy, five transactional usage counters and media bytes, and tier assignment is internal-only.
- `P19.2` ACCEPTED: Capacity is enforced for homebrew, Characters, hosted Campaigns, seats, listings, storage and Blueprints, and an over-limit downgrade preserves existing data.
- `P19.3` ACCEPTED: A parallel final-slot race yields one winner, one OCC retry and one quota loser.

Evidence:

6 ledger reference(s), 6 under `.codex/validation/` in the backup worktree:

- `phase82-entitlements` (6)
