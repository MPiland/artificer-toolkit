# Slice workbook: PLATFORM-18.T1 (re-publish a changed canonical corpus)

**Status:** READY: survey first (written 2026-10-15)
**Base:** `codex/phase-08-2-convex-cutover`.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Problem (AC PLATFORM-18.1)

Canonical import (`apps/apis/convex/content/import*`) is insert-or-identical. A corpus change, such as `barbarian.ts` after ATTACK-9.T7, fails the seed with "Canonical content conflict". So every corpus change needs a backend reset, and production can't take a reset after launch. ADR 0022 pins play data to content versions.

## Step 1: survey (read-only, then stop and report)

Report:

- how canonical subjects, versions, derived data (catalogues, counters, manifests, snapshots) and pins are stored today, with file and line references;
- what a re-publication must touch;
- two or three viable designs with tradeoffs, and your recommendation.

Cover:

- a version bump per changed subject, with unchanged subjects untouched;
- derived-data resync;
- catalogue counters;
- idempotency when the same corpus is seeded twice;
- transaction and size limits (Convex mutation limits; batch if needed);
- how replay and pinned Characters, Campaigns and Encounters keep resolving earlier versions;
- what a removed subject means.

Don't edit code in this step. The main session rules on the design and records it as a D-number.

## Step 2: build (after the ruling)

- Red first: a live-backend proof that seeds corpus N, creates play data, then seeds corpus N+1 with one subject changed. It fails today with the conflict.
- Make it green under the ruling.
- Update the release runbook (`docs/runbooks/phase-8-2-release.md`) so a corpus change no longer requires a reset.
- Checkpoints:
  - CI on `ci/platform-18-t1`.
  - The live-backend proof runs through `gh workflow run live-backend.yml --ref ci/platform-18-t1`, or through a test the live-backend job already runs.
  - Never use Convex Cloud.

## Status log

### Step 1 survey (2026-10-15)

Pins: ADR 0022 is superseded by ADR 0024 (current-version reads, no consumer-selectable pins; frozen occurrences keep their own facts). Homebrew publish already replaces in place (`content/publicationPersistence.ts` `commitPublication`). Canonical import throws on any changed checksum (`content/import.ts` `exact(currentFields, …)`).

### Rulings (main session; to be recorded as D120)

1. Design A: in-place replace per changed subject, reusing `commitPublication`'s steps (insert the next version, replace the root, delete the previous version with its chunks and compilation, sync catalogue metadata, patch the families). Extract the shared part into one function if needed; don't copy. Relax the `version: 1` assumptions in `importSubjects`, `readSubjects` and the audit. Re-fit the batch cost for replaces and record the measurement.
2. A removed subject fails loudly, naming the ids. Real removal is deferred (`docs/roadmap/future-enhancements.md` Deferred edge cases, with the `deletion.ts` reuse pointers).
3. Downgrade: no guard. The seed is declarative, so seeding N after N+1 is another replace.
4. Dependents follow ADR 0024: a canonical replace goes through the same unresolved-dependent check publish uses and refuses, listing the dependents. No seed bypass.
5. AC 18.1 is reworded to ADR 0024's current-version reads: play data created on N keeps working after N+1.

### Step 2 build (2026-10-15)

Built to the rulings.

- `content/authoredReplacement.ts` `replaceCurrentAuthoredVersion` is the shared replace step; `commitPublication` and canonical `importSubjects` both call it. `importSubjects` and `seed` return `replaced`; `readSubjects` accepts any version >= 1; the seed reads stored id and checksum through `readSubjects` (`changedSubjectIds`) to fail on a removed subject before any write and to batch each replaced subject alone (`sourceImportBatches`'s `alone` predicate).
- Children are recompiled at replace time (Equipment variants, subraces) because the derived syncs are exact-or-insert. Class compilation stays with `syncClassDerived`, as on first import.
- Red: `corpusReplaceJourney.test.ts` (readied Character, Acolyte renamed, reimport) failed with `Canonical content conflict.` on the pre-fix code. Green after the fix. Fast tests: `import.test.ts` (Background replace and downgrade, Race parent replace and demotion refusal, Equipment variant recompile), `seedReplace.test.ts` (mocked manifest: N, N+1, back to N, removed subject).
- Changed expectations: only additive `replaced: 0` on existing `importSubjects` and `seed` results (`import.test.ts`, `importSpell.test.ts`, `importCreatureVehicle.test.ts`, `featPublication.test.ts`, `seed.test.ts`). In the new journey test the Sheet is expected to show the new Background label (ADR 0024 current-version reads), not to equal corpus N.
- Ruling 4 note: publish has no Character-level dependents blocker; the dependents check it shares with a canonical replace is the structural one (`assertNoClassChildren`, `assertNoRaceChildren`, now listing the dependent ids in the error) plus child recompilation.
- Live proof: `liveBackendValidation.mjs` gains `replace` (apps/apis/scripts/liveBackendReplaceProbe.ts: relabels and restores the largest Class and Subclass, the Race with most subraces, the Equipment with most variants, and leaves a Background changed) and `reseed` steps before the audit. The probe times each mutation; results go in `docs/validation/platform-18-t1-replace-mutation-margin-2026-10-15.md`.
- Hook false positive: the "Node API without use node" hook blocked writes of test files importing `node:zlib` (`seed.test.ts`, `seedReplace.test.ts`); they are vitest-only, like the existing `seed.test.ts`.

Proposed ledger edits (main session): reword AC 18.1 per ruling 5; add PLATFORM-18.T2 for canonical definitions, Systems, sources and catalogues (still insert-or-identical).