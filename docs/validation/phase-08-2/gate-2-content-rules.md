# Phase 8.2 Gate 2: Content and rules

- **Status:** transitional evidence summary
- **Scope:** acceptance status and evidence origin for the 16 Gate 2 cases
- **Update when:** a Gate 2 case or criterion in the [acceptance ledger](../../roadmap/08-2-convex-cutover-acceptance.json) changes status or evidence
- **Recorded:** 2026-09-25, from the ledger; run `node scripts/acceptanceProgress.mjs` for live counts

Gate 2 has **16/16** cases and **50/50** criteria accepted.

The ledger's `criteria` arrays are the authority for what each case must prove; this page summarizes them with the proof tier and where the evidence came from. Raw logs are not copied here.

> **Evidence location.** Most raw evidence lives only in the Codex backup worktree, under `.codex/worktrees/phase-08-2-convex-cutover/.codex/validation/`: [open question Q2](../../handoffs/phase-08-2-open-questions.md#resolved) counts 653 of the ledger's 725 evidence references there, and every one of the 675 entries in the ledger's evidence arrays uses a `.codex/validation/` path. Only the `phase82-goal-20260923` packet is also copied to ignored `local-validation/`. The final R08 re-proof on the final source will supersede this evidence; the backup worktree is deleted only after R08 passes.

## C01 — Game Systems and Rules Catalogues

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `C01.1` ACCEPTED: Public System capability, detail, summary and paginated reads preserve canonical UUID and checksum identity.
- `C01.2` ACCEPTED: Malformed, unavailable or corrupt Systems and invalid catalogue-source bindings fail closed.
- `C01.3` ACCEPTED: Rules Catalogue browse, search, category and count reads keep stable continuation, System filtering, owner/master isolation and materialized totals.

Evidence:

19 ledger reference(s), 19 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (12)
- `phase82-native-system-selectors` (1)
- `phase82-approved-system-retirement` (1)
- `phase82-c01-final` (2)
- `phase82-foundation (cloudDevEvidence)` (3)

## C02 — Public UUID and checksum stability

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08 (notes)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `C02.1` ACCEPTED: System reads round-trip the canonical UUID, DTO and checksum, and reject corruption and identity mismatch.
- `C02.2` ACCEPTED: Authored copy, publication, read and replacement preserve public identity, recompute and verify checksums, and leave the canonical source unchanged.
- `C02.3` ACCEPTED: A rejected publication keeps the prior active version.

Evidence:

3 ledger reference(s), 3 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (1)
- `phase82-c02-final` (1)
- `phase82-foundation (cloudDevEvidence)` (1)

## C03 — Background authoring and publication

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `C03.1` ACCEPTED: The Background browser lifecycle covers copy, save/reload, export, activation/replacement, search/filter, deletion that keeps the draft, and discard, with zero legacy requests and exact cleanup.
- `C03.2` ACCEPTED: Catalogue pagination is deterministic and bounded, with filtered counts, forward and backward windows, and cursor resets when scope or search changes.
- `C03.3` ACCEPTED: Atomic authored deletion reconciles Background source loss across personal, create-only and Campaign-assigned Characters.

Evidence:

19 ledger reference(s), 19 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (11)
- `phase82-global-catalogue` (1)
- `phase82-catalogue-counters` (1)
- `phase82-catalogue-ui` (1)
- `phase82-export` (1)
- `phase82-native-authoring-browser-closure` (2)
- `phase82-native-authored-deletion` (1)
- `phase82-c03-final` (1)

## C04 — Class authoring and publication

- **Status:** ACCEPTED
- **Accepted:** 2026-09-10 (restored; notes)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 4/4

What was proven or remains to prove:

- `C04.1` ACCEPTED: The indexed Class/Spell guard keeps restrictive catalogue references and rolls back atomically, including concurrent Spell publication against Class deletion.
- `C04.2` ACCEPTED: Canonical replay, index repair and the managed backfill complete all 1,051 roots.
- `C04.3` ACCEPTED: Publication, privacy, invalid, stale, replacement, copy, discard and retained-edit deletion proofs and parent races pass with exact fixture cleanup.
- `C04.4` ACCEPTED: The Class browser lifecycle, catalogue and Character source-loss behavior are proven.

Evidence:

12 ledger reference(s), 12 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (1)
- `phase82-class-resume` (1)
- `phase82-class-frontend` (1)
- `phase82-class-catalogue` (1)
- `phase82-export` (1)
- `phase82-native-authoring-browser-closure` (2)
- `phase82-native-authored-deletion` (1)
- `phase82-c04-final` (1)
- `phase82-class-spell-deletion` (1)
- `phase82-class-spell-final` (2)

## C05 — Creature authoring and publication

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 2/2

What was proven or remains to prove:

- `C05.1` ACCEPTED: Creature authoring covers canonical and custom records, authored references, privacy, Guided copy, normalization, save, publish, replacement, delete, export and artwork.
- `C05.2` ACCEPTED: Canonical import compiles and audits every Creature, preserves UUID, source, checksum and version identity, backfills only missing compilation and rolls back conflicts.

Evidence:

9 ledger reference(s), 9 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (1)
- `phase82-creature` (1)
- `phase82-creature-web` (1)
- `phase82-catalogue-category` (1)
- `phase82-creature-vehicle-import` (1)
- `phase82-c05-c10-final` (4)

## C06 — Equipment authoring and publication

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 4/4

What was proven or remains to prove:

- `C06.1` ACCEPTED: Equipment base/variant authoring, same-System inheritance, publication, replacement, deletion, copy, export and catalogue reads preserve exact identity and fail closed on stale or conflicting input.
- `C06.2` ACCEPTED: Descendants recompile atomically, and published children and Campaign custody block deletion.
- `C06.3` ACCEPTED: Canonical import handles unordered parents, exact replay and missing-derived backfill across all 371 items and the 500-item inheritance ceiling.
- `C06.4` ACCEPTED: Deleted Equipment contributions disappear from active and saved Characters while unrelated private state survives.

Evidence:

16 ledger reference(s), 16 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (2)
- `phase82-equipment` (1)
- `phase82-equipment-frontend` (1)
- `phase82-equipment-acceptance` (4)
- `phase82-catalogue-category` (1)
- `phase82-c06-final` (7)

## C07 — Feat authoring and publication

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 2/2

What was proven or remains to prove:

- `C07.1` ACCEPTED: The Feat browser lifecycle covers copy, resolution, save/reload, export, activation/replacement, search/filter, deletion that keeps the draft, and discard, with exact cleanup.
- `C07.2` ACCEPTED: Feat source loss updates create-only and canonical/edit Character drafts while preserving unrelated options and private edits.

Evidence:

8 ledger reference(s), 8 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (1)
- `phase82-feat` (2)
- `phase82-catalogue-ui` (1)
- `phase82-export` (1)
- `phase82-native-authoring-browser-closure` (1)
- `phase82-native-authored-deletion` (1)
- `phase82-c07-final` (1)

## C08 — Race authoring and publication

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `C08.1` ACCEPTED: Race base/subrace authoring, same-System inheritance, publication, replacement, deletion, copy, artwork, export and node resolution fail closed on stale or conflicting parents.
- `C08.2` ACCEPTED: Canonical seed and replay cover all 13 Races.
- `C08.3` ACCEPTED: Family catalogue reads group by UUID, keep playable-selection facts, paginate deterministically, enforce owner privacy and back the /races routes.

Evidence:

15 ledger reference(s), 15 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (1)
- `phase82-race` (2)
- `phase82-race-web` (1)
- `phase82-race-catalogue` (1)
- `phase82-c08-final` (10)

## C09 — Spell authoring and publication

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 4/4

What was proven or remains to prove:

- `C09.1` ACCEPTED: Spell authoring, copy, normalization, publication, artwork, export and canonical import/replay preserve exact documents, checksums, compilation and Class dependencies, including the depth-22 Prismatic Wall.
- `C09.2` ACCEPTED: The catalogue projection atomically maintains level, school, Class UUIDs and casting time, and filters run before pagination.
- `C09.3` ACCEPTED: Rows and facets resolve current authorized labels and fail closed on stale projections; anonymous OWNED reads return nothing.
- `C09.4` ACCEPTED: The /spells route consumes the native list and summary.

Evidence:

7 ledger reference(s), 7 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (1)
- `phase82-spell` (2)
- `phase82-spell-web` (1)
- `phase82-spell-import` (1)
- `phase82-json-depth` (1)
- `phase82-c09-final` (1)

## C10 — Vehicle authoring and publication

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 2/2

What was proven or remains to prove:

- `C10.1` ACCEPTED: Vehicle authoring covers canonical and custom records, privacy, Guided copy, normalization, save, publish, replacement, delete, export and artwork.
- `C10.2` ACCEPTED: Canonical import compiles and audits every Vehicle, preserves UUID, source, checksum and version identity, backfills only missing compilation and rolls back conflicts.

Evidence:

11 ledger reference(s), 11 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (1)
- `phase82-vehicle` (1)
- `phase82-vehicle-web` (2)
- `phase82-race-web` (1)
- `phase82-catalogue-category` (1)
- `phase82-creature-vehicle-import` (1)
- `phase82-c05-c10-final` (4)

## C11 — Effects, grants, modifiers, and reusable definitions

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** REVIEW
- **Criteria met:** 4/4

What was proven or remains to prove:

- `C11.1` ACCEPTED: The neutral publisher owns all seven reusable-definition families with schema-validated documents, deterministic checksums, current dependency pins and installed System capabilities.
- `C11.2` ACCEPTED: Native create, get, list, save and publish keep one current publication and one owner-private draft, and fail closed on corrupt roots, publications, dependencies and drafts.
- `C11.3` ACCEPTED: A draft based on an older root version is rejected by get, save and publish without writes.
- `C11.4` ACCEPTED: The live System workspace uses native pagination and mutations, keeps local edits across reactive changes and excludes compiler-generated Effect actions.

Evidence:

12 ledger reference(s), 12 under `.codex/validation/` in the backup worktree:

- `phase82-definition-publisher` (1)
- `phase82-canonical-json` (1)
- `phase82-system-modules` (1)
- `phase82-system-capability` (1)
- `phase82-native-definitions` (1)
- `phase82-c11-final` (7)

## C12 — Draft create, save, discard, and recovery

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `C12.1` ACCEPTED: Copy, get, save, recovery and discard work for all eight authored domains with exact round trips, privacy, stable routes and cleanup.
- `C12.2` ACCEPTED: Background, Class and Feat browser journeys cover editing, save/reload, draft-only recovery, discard and list return with zero legacy requests.
- `C12.3` ACCEPTED: Authored images keep draft and active slots isolated, separate discard from active deletion, clean up by reference and fence stale settlements.

Evidence:

13 ledger reference(s), 13 under `.codex/validation/` in the backup worktree:

- `phase82-foundation (recoveryEvidence)` (1)
- `phase82-foundation` (10)
- `phase82-native-authoring-browser-closure` (1)
- `phase82-c12-final` (1)

## C13 — Publication validation and mechanics compilation

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** REVIEW
- **Criteria met:** 3/3

What was proven or remains to prove:

- `C13.1` ACCEPTED: Publication enforces ownership, saved-draft and base preconditions, authorized normalization, shared compilation and mechanics-index validation for all eight domains.
- `C13.2` ACCEPTED: The normalized document and its compilation are replaced atomically, and Class compiles the same ACTIVE document that it commits.
- `C13.3` ACCEPTED: Equipment and Race keep current-parent compilation and recompile descendants transactionally.

Evidence:

8 ledger reference(s), 8 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (3)
- `phase82-class-resume` (1)
- `phase82-feat` (1)
- `phase82-acceptance-closure` (2)
- `phase82-blueprints` (1)

## C14 — Deep UUID-safe duplication

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08 (notes)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `C14.1` ACCEPTED: Clone conformance passes all 1,051 canonical records with fresh owned UUIDs, stable internal remapping, preserved external references and unchanged sources.
- `C14.2` ACCEPTED: Native duplication passes all eight domains, and authenticated development proof copies the deepest record of each domain.
- `C14.3` ACCEPTED: Guided copy routing works.

Evidence:

9 ledger reference(s), 9 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (5)
- `phase82-acceptance-closure` (3)
- `phase82-c14-final` (1)

## C15 — Owner, Campaign-share, and master-content authorization

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** AUTHORIZATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `C15.1` ACCEPTED: Authored drafts, publication and deletion derive authority from current identity, keep drafts owner-private, reject owner/status spoofing and protect master records while allowing owned copies.
- `C15.2` ACCEPTED: Campaign shares accept only active same-System homebrew owned by an active member; visibility stays Campaign-scoped and maturity-masked and disappears on revocation.
- `C15.3` ACCEPTED: Share removal enforces the recorded author, current version and actor-bound replay; anonymous, outsider, foreign, archived and corrupt cases fail closed.

Evidence:

8 ledger reference(s), 8 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (6)
- `phase82-c15-final` (2)

## C16 — Node runtime and Rules Kernel execution, pause, and resume

- **Status:** ACCEPTED
- **Accepted:** 2026-09-10 (notes)
- **Proof tier:** REVIEW
- **Criteria met:** 4/4

What was proven or remains to prove:

- `C16.1` ACCEPTED: The node runtime uses one neutral resolver and normalizer with current System, source, ownership, bounds and checksum validation.
- `C16.2` ACCEPTED: Assisted START persists a sealed pause without exposing partial Run state, resumes through a second pause and settles initiative and receipts atomically.
- `C16.3` ACCEPTED: Resume admits only the exact System, executes frozen and source-independent, and rejects tampered or invalid evidence (26 runtime tests).
- `C16.4` ACCEPTED: Stored bindings, private player reads and terminal replay are covered.

Evidence:

20 ledger reference(s), 20 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (12)
- `phase82-class-frontend` (2)
- `phase82-resolver-recovery` (1)
- `phase82-native-node-retirement` (1)
- `phase82-rules-runtime` (1)
- `phase82-system-modules` (1)
- `phase82-native-definitions` (1)
- `phase82-c16-review` (1)
