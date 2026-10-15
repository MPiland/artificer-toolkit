# Slice workbook: PLATFORM-13.T5 (Convex suite speed: the heavy journeys)

**Status:** in progress
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

The Convex suite is the longest CI job: each of 4 shards takes about 14 minutes with one file worker.

On 2026-10-15 a CI trial with 3 file workers per shard (run 38775641398) cut a shard to 7-8 minutes. The trial was rejected, because `campaigns/developmentCustody.test.ts` › "runs the public mixed Character custody driver and validates historical Vehicle removal before cleanup" timed out at its 30 s limit. That test takes 23 s even with one worker (run 38769788109). Per PLATFORM-13.T4, a setting that times out is rejected and no per-test timeout is raised.

This slice makes the heaviest files do less work, so that every test has a clear margin under its timeout and the 3-worker setting can be adopted.

Targets, from the serial baseline in [platform-13-t1-test-timings-2026-10-14.md](../validation/platform-13-t1-test-timings-2026-10-14.md):

- **Corpus-scale journeys:**
  - `content/equipmentLimits.test.ts`
  - `encounters/developmentLifecycleProof.test.ts`
  - `characters/commitReferencedContext.test.ts`
  - `campaigns/developmentCustody.test.ts`
  - `content/equipmentCharacter.test.ts`
  - `content/seed.test.ts`
  - `content/seedAudit.test.ts`
  - `characters/builderSnapshotParity.test.ts`
  - `content/catalogueReadBudget.test.ts`
- **`media/*`:** per-test fixture setup (`authoredAssets`, `library`, `avatar`, `characterPortrait`). Profile first.
- **Module import:** about 688 s across 380 files. Profile what each test file imports, and cut it only where a file pulls in modules it does not use.

Rules:

- **Profile before changing.** Record where each target spends its time: fixture setup, SRD preparation, repeated corpus work inside assertions, or the product path itself.
- **Proofs keep running real code.** Never replace a product call with a stub, a copy of product logic or a hand-built result. The real-code-proof rule in AGENTS.md and the user's Definition of Done apply.
- Allowed cuts:
  - shared fixtures built once per file instead of per test, where the tests do not mutate shared state;
  - computing an SRD preparation once instead of inside assertions;
  - asserting the same behavior on the smallest corpus that still exercises it, but only where the AC does not name full-corpus scale (the 500-visible-option capacity journey must stay full-scale);
  - removing work a test does that no assertion reads.
- If profiling shows the product itself does unnecessary work (for example a redundant corpus read), fix the product with a test that fails before the fix. Report it in the status log as a product change.
- Never weaken, delete or reorder an assertion. Never raise a per-test or global timeout. Never change `apps/apis/vitest.config.ts` `maxWorkers`.
- Other slice sessions may edit some of these test files (for example `developmentLifecycleProof.test.ts`). Merge the base before each CI push and keep your edits surgical.

Escalate (`SendMessage` to the main session) only if:

- a target can only be made faster by shrinking what an AC requires it to prove; or
- the product fix changes a public or persisted contract.

## Closes

- AC PLATFORM-13.7.

## File scope

- Test files and fixtures under `apps/apis/convex/**` and `apps/apis/tests/fixtures/**`.
- Product code only for a profiled, tested product inefficiency (see above).
- `docs/validation/`: a new timing record for this slice, `platform-13-t5-test-timings-2026-10-15.md`, with before and after per-file figures.

## Checklist

1. **Before:** per-file timings for the targets, serial, from a CI run of your branch head before changes. Use the JSON reporter as the T1 baseline did, and keep the JSON under `local-validation/platform-13-t5/`.
2. **Changes:** one commit per target file or fixture, each with that file's tests green and unchanged in what they assert.
3. **After:**
   - per-file timings for the same targets from a CI run, recorded in the timing record;
   - the slowest test in each target, with its share of its timeout.
   - Goal: no Convex test above 50% of its timeout serially.
4. **3-worker trial:** run the workflow by dispatch on your CI branch with 3 Convex workers:
   ```bash
   gh workflow run tests.yml --ref ci/platform-13-t5 -f convex_workers=3
   ```
   Read it with `gh run watch <id> --exit-status --interval 120`. Record the shard times. A timeout or failure there is a finding to fix in this slice, not to rerun.

## Status log

- 2026-10-15: workbook written.

## Proposed ledger edits (filled by the slice session)
