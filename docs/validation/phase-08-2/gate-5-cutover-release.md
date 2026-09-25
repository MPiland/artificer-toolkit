# Phase 8.2 Gate 5: Cutover and release

- **Status:** transitional evidence summary
- **Scope:** acceptance status and evidence origin for the 10 Gate 5 cases
- **Update when:** a Gate 5 case or criterion in the [acceptance ledger](../../roadmap/08-2-convex-cutover-acceptance.json) changes status or evidence
- **Recorded:** 2026-09-25, from the ledger; run `node scripts/acceptanceProgress.mjs` for live counts

Gate 5 has **1/10** cases and **3/23** criteria accepted.

The ledger's `criteria` arrays are the authority for what each case must prove; this page summarizes them with the proof tier and where the evidence came from. Raw logs are not copied here.

> **Evidence location.** Most raw evidence lives only in the Codex backup worktree, under `.codex/worktrees/phase-08-2-convex-cutover/.codex/validation/`: [open question Q2](../../handoffs/phase-08-2-open-questions.md#resolved) counts 653 of the ledger's 725 evidence references there, and every one of the 675 entries in the ledger's evidence arrays uses a `.codex/validation/` path. Only the `phase82-goal-20260923` packet is also copied to ignored `local-validation/`. The final R08 re-proof on the final source will supersede this evidence; the backup worktree is deleted only after R08 passes.

## R01 — All product data flows through Convex

- **Status:** IN_PROGRESS
- **Accepted:** never accepted
- **Proof tier:** RELEASE
- **Criteria met:** 0/2

What was proven or remains to prove:

- `R01.1` IN_PROGRESS: The local legacy runtime is removed, and the retained subscription, ticket and Worker path passes focused contract tests, affected typechecks, fresh package builds and a zero-consumer scan.
- `R01.2` NOT_STARTED: Complete same-source R08 product journeys and the release audit show that all product data flows through Convex.

Evidence:

1 ledger reference(s), 1 under `.codex/validation/` in the backup worktree:

- `phase82-gate-progress-20260917` (1)

## R02 — Zero Supabase runtime dependency

- **Status:** IN_PROGRESS
- **Accepted:** never accepted
- **Proof tier:** RELEASE
- **Criteria met:** 0/2

What was proven or remains to prove:

- `R02.1` IN_PROGRESS: Supabase runtime source, workspace dependencies and lockfile requirements are removed.
- `R02.2` NOT_STARTED: Final same-source R08 auth, session, SSR, realtime and media journeys and the release audit pass with no Supabase runtime dependency.

Evidence:

1 ledger reference(s), 1 under `.codex/validation/` in the backup worktree:

- `phase82-gate-progress-20260917` (1)

## R03 — Zero Kysely, PostgreSQL application SQL, migrations, and generated Supabase types

- **Status:** IN_PROGRESS
- **Accepted:** never accepted
- **Proof tier:** RELEASE
- **Criteria met:** 0/2

What was proven or remains to prove:

- `R03.1` IN_PROGRESS: The DB workspace, SQL/Kysely runtime, migrations and consumers are removed, and every protected source-data corpus file matches its pre-removal hash.
- `R03.2` NOT_STARTED: Final native seed, import and audit and the same-source R08 lifecycle pass.

Evidence:

1 ledger reference(s), 1 under `.codex/validation/` in the backup worktree:

- `phase82-gate-progress-20260917` (1)

## R04 — Zero GoRules runtime dependency

- **Status:** IN_PROGRESS
- **Accepted:** never accepted
- **Proof tier:** RELEASE
- **Criteria met:** 0/2

What was proven or remains to prove:

- `R04.1` IN_PROGRESS: GoRules runtime source, Rule Studio, dependencies and configuration are removed.
- `R04.2` NOT_STARTED: The complete native rule-corpus and gameplay proof passes in the same R08 source state.

Evidence:

1 ledger reference(s), 1 under `.codex/validation/` in the backup worktree:

- `phase82-gate-progress-20260917` (1)

## R05 — Zero tRPC and product Netlify functions

- **Status:** IN_PROGRESS
- **Accepted:** never accepted
- **Proof tier:** RELEASE
- **Criteria met:** 0/2

What was proven or remains to prove:

- `R05.1` IN_PROGRESS: tRPC routers and clients, product Netlify functions and durable-command compatibility are removed, with static/SSR web packaging kept.
- `R05.2` NOT_STARTED: Final native journeys and the same-source R08 packaging and request audit pass.

Evidence:

1 ledger reference(s), 1 under `.codex/validation/` in the backup worktree:

- `phase82-gate-progress-20260917` (1)

## R06 — Session Durable Object is the active live-command authority

- **Status:** IN_PROGRESS
- **Accepted:** never accepted
- **Proof tier:** REVIEW
- **Criteria met:** 0/4

What was proven or remains to prove:

- `R06.1` IN_PROGRESS: The Durable Object runs heavy live rule evaluation and fact preparation in order, with authorized capture and validated atomic Convex commits that preserve replay, version checks and Character/Encounter/Scene atomicity.
- `R06.2` IN_PROGRESS: Live Encounter-bound movement has a working Durable Object-to-Convex route (the gap exposed by V15-20260924-05).
- `R06.3` IN_PROGRESS: Character Sheet writes stay in Convex under the approved Character authority amendment.
- `R06.4` IN_PROGRESS: While room authority is active, the room is the single writer of the presented Scene and of all Encounter commands, and the direct-write fence covers only the presented Scene (ADR 0033).

Evidence:

4 ledger reference(s), 4 under `.codex/validation/` in the backup worktree:

- `phase82-gate-progress-20260917` (2)
- `local-convex-linux-20260915` (1)
- `phase82-goal-20260923` (1)

## R07 — Canonical docs, ADRs, ERDs, deployment guides, and runbooks match the final system

- **Status:** ACCEPTED
- **Accepted:** 2026-09-20
- **Proof tier:** REVIEW
- **Criteria met:** 3/3

What was proven or remains to prove:

- `R07.1` ACCEPTED: Canonical ownership and package-direction guides and ADR status text match the native Convex, Worker, authoring, rules-runtime and source-data boundaries, with no approval-pending removal wording.
- `R07.2` ACCEPTED: Deployment guides and the release runbook match the final system.
- `R07.3` ACCEPTED: The anchor-aware link audit checks 436 links across 98 Markdown files with zero failures.

Evidence:

4 ledger reference(s), 4 under `.codex/validation/` in the backup worktree:

- `phase82-gate-progress-20260917` (4)

## R08 — Complete development lifecycle passes from a fresh isolated Convex development deployment

- **Status:** NOT_STARTED
- **Accepted:** never accepted
- **Proof tier:** RELEASE
- **Criteria met:** 0/2

What was proven or remains to prove:

- `R08.1` NOT_STARTED: The complete development lifecycle passes from a fresh, isolated Convex development deployment.
- `R08.2` NOT_STARTED: The lifecycle runs on one final source state shared by the R01–R05 release audits, and later source changes rerun it from the earliest affected stage.

Evidence:

No evidence recorded yet.

## R09 — One staging integration/performance promotion and explicit Supabase retirement decision

- **Status:** NOT_STARTED
- **Accepted:** never accepted
- **Proof tier:** STAGING
- **Criteria met:** 0/2

What was proven or remains to prove:

- `R09.1` NOT_STARTED: One authorized staging integration and performance promotion passes.
- `R09.2` NOT_STARTED: An explicit Supabase retirement decision is recorded.

Evidence:

No evidence recorded yet.

## R10 — Production deployment and bounded smoke verification

- **Status:** NOT_STARTED
- **Accepted:** never accepted
- **Proof tier:** PRODUCTION
- **Criteria met:** 0/2

What was proven or remains to prove:

- `R10.1` NOT_STARTED: Production deployment completes.
- `R10.2` NOT_STARTED: Bounded production smoke verification passes.

Evidence:

No evidence recorded yet.
