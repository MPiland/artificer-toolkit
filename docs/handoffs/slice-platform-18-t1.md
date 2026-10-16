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
