# Slice workbook: PLATFORM-13.T9 (live-backend validation on GitHub Actions)

**Status:** IN_PROGRESS (started 2026-10-15)
**Base:** `main` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

The local heavy validation lock is the throughput bottleneck (9 batches queued, 10–20 minutes each). The repo is public, so GitHub Actions minutes are free. The user approved (2026-10-15) running the open-source self-hosted Convex backend image as a temporary container on a GitHub runner. ADR 0035's "never a cloud deployment" rule means Convex Cloud; an ephemeral runner container is allowed.

Deliver a live-backend CI job (manifest, codegen, deploy, seed, SRD audit against an ephemeral container), proof (green and red runs, step durations), and the docs (ADR 0035 amendment, AGENTS.md Validation, runbook and workbook rules).

## Closes

- AC PLATFORM-13.11.

## File scope

- `.github/workflows/live-backend.yml` (new sibling of `tests.yml`, and why: it needs a container, runs only on `ci/merge-*` pushes or dispatch, and must not add a job to every slice's `ci/<slice>` push).
- `scripts/liveBackendValidation.mjs` (new; replaces the untracked `local-validation/codex-batch/deploy-seed.mjs`), `scripts/convexSelfHosted.mjs` (shared admin-key and loopback guard), `apps/apis/scripts/convexRunLocal.mjs` (uses the shared module).
- ADR 0035, AGENTS.md Validation, `docs/runbooks/phase-8-2-release.md`, `slice-workbook-rules.md`, `apps/apis/README.md`.

## Design

- One implementation for local and CI: `node scripts/liveBackendValidation.mjs [--url] [--container] [--steps] [--log-dir]`. Defaults are the local container (`phase82-convex-local-linux`, `http://127.0.0.1:3210`). CI passes `--container=convex-live`.
- `assertLoopbackUrl` refuses any non-loopback URL, so no invocation can reach Convex Cloud.
- The admin key is generated inside the container, kept in the child environment only, masked with `::add-mask::` on GitHub, and redacted from forwarded output. Step logs and `summary.json` (step, exit, seconds) go to `--log-dir` and are uploaded as the `live-backend-logs` artifact.
- Image pinned by digest (`ghcr.io/get-convex/convex-backend@sha256:69885bae…d1f8`), the digest the local container runs (also recorded in `apps/apis/README.md`).
- Triggers: push to `ci/merge-*`, `workflow_dispatch` (guarded to `refs/heads/ci/*`). No `pull_request`, no secrets, `contents: read`, concurrency group `live-backend-${{ github.ref }}`.

## Red-first checklist

1. Green run: all five steps pass; the audit log shows the subject count (1057).
2. Red run: dispatch with `steps=manifest,codegen,deploy,audit` (seed skipped); the audit fails and the job is red.
3. Local heavy batch (last): `liveBackendValidation.mjs` against the local container through `withValidationLock.ps1`.

## Status log

- 2026-10-15: workbook written; workflow and scripts pushed to `ci/merge-platform-13-t9`.

## Proposed ledger edits

- PLATFORM-13.T9 status → done once the proof below is recorded; AC PLATFORM-13.11 → done.

## Follow-ups (out of scope)

- Run the Session Worker (wrangler) and Playwright live proofs in CI.
