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

- One implementation for local and CI: `node scripts/liveBackendValidation.mjs [--container] [--fresh] [--steps] [--log-dir]`. The URL is the `localConvex.url` constant (`http://127.0.0.1:3210`), checked against `/instance_name` (`phase82-local-linux`; the CI container sets the same `INSTANCE_NAME`). Defaults are the local container and `manifest,codegen,deploy,seed,audit`. CI passes `--container=convex-live --fresh`; `--fresh` adds the `env` step (`JWKS` empty) and is refused for the local container.
- Convex CLI children run through `yarnSpawn` with `shell:false`, explicit `--url`/`--admin-key` arguments and `CONVEX_DEPLOYMENT`/`CONVEX_DEPLOY_KEY` removed from their environment, so no env file or selector can redirect them to Convex Cloud. `convexRunLocal.mjs` and `validatePreStagingLocal.mjs` share the same module and its single loopback guard.
- The admin key is generated inside the container, passed only as a CLI argument, masked (key and secret half) with `::add-mask::` on GitHub, and redacted line by line from forwarded output and step logs.
- A drift check after the script fails the job if the regenerated SRD manifest or `_generated` files differ from the commit. A green audit reports 1057 subjects. Step logs and `summary.json` (step, exit, seconds) go to `--log-dir` and are uploaded as the `live-backend-logs` artifact.
- Image pinned by digest (`ghcr.io/get-convex/convex-backend@sha256:69885bae…d1f8`), the digest the local container runs (also recorded in `apps/apis/README.md`).
- Triggers: push to `ci/merge-*`, `workflow_dispatch` (guarded to `refs/heads/ci/*`). No `pull_request`, no secrets, `contents: read`, concurrency group `live-backend-${{ github.ref }}`.

## Red-first checklist

1. Green run: all five steps pass; the audit log shows the subject count (1057).
2. Red run: dispatch with `steps=manifest,codegen,deploy,audit` (seed skipped; `--fresh` still sets `JWKS`); the audit fails and the job is red.
3. Local heavy batch (last): `liveBackendValidation.mjs` against the local container through `withValidationLock.ps1`.

## Status log

- 2026-10-15: workbook written; workflow and scripts pushed to `ci/merge-platform-13-t9`.
- 2026-10-15: three fix-forward runs on a fresh container, each a missing deployment prerequisite (runs 38800055892, 38801424688, 38802403610): `auth.config.ts` needs `JWKS` set (new `env` step sets it empty, as `apps/apis/README.md` documents for a fresh backend); the provider domain is the built-in `CONVEX_SITE_URL`, which is not settable and comes from the container's `CONVEX_SITE_ORIGIN` (the workflow now passes `CONVEX_CLOUD_ORIGIN`/`CONVEX_SITE_ORIGIN` loopback origins, matching the local container).
- 2026-10-15: proof recorded below. The seed and audit prove what they proved locally (audit reports 1057 subjects); no change to either.

## Proof

Final source `6eebd664a` (after the merge-review fixes):

| Run                                                                                  | Ref                       | Trigger                                        | Result                                                                                                                                   |
| ------------------------------------------------------------------------------------ | ------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [38813514949](https://github.com/MPiland/artificer-toolkit/actions/runs/38813514949) | `ci/merge-platform-13-t9` | push                                           | green, audit `"subjects": 1057`, drift check green (regenerated manifest and `_generated` files are byte-identical on Linux and Windows) |
| [38814079363](https://github.com/MPiland/artificer-toolkit/actions/runs/38814079363) | `ci/platform-13-t9`       | dispatch `steps=manifest,codegen,deploy,audit` | red: audit `Missing platform content source.` (job fails, drift check skipped, logs uploaded); `--fresh` still ran `env` first           |
| [38813511069](https://github.com/MPiland/artificer-toolkit/actions/runs/38813511069) | `ci/platform-13-t9`       | push (Tests)                                   | green                                                                                                                                    |

Step durations in seconds (script `summary.json`): green 38813514949 env 1, manifest 16, codegen 24, deploy 18, seed 95, audit 2 (job 4 m 25 s); red 38814079363 env 1, manifest 16, codegen 23, deploy 19, audit 2 (exit 1).

The `ci/merge-platform-13-t9` Tests run (38813514954) failed twice (the run and its rerun) in `apps/apis/convex/encounters/developmentLifecycleProof.test.ts` (Convex suite 3/4, a strict deep-equal `AssertionError` on a stat block); the same test failed on the earlier `3984b9140` Tests run, while the identical source passed on `ci/platform-13-t9` (38813511069). This slice touches nothing that test imports, so it is an intermittent failure to track (follow-up below), not a regression of this slice.

First version (`3984b9140`, before the review fixes):

| Run                                                                                  | Ref                       | Trigger                                            | Result                                                                   |
| ------------------------------------------------------------------------------------ | ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| [38802771155](https://github.com/MPiland/artificer-toolkit/actions/runs/38802771155) | `ci/merge-platform-13-t9` | push                                               | green, audit `"subjects": 1057`                                          |
| [38804230986](https://github.com/MPiland/artificer-toolkit/actions/runs/38804230986) | `ci/platform-13-t9`       | dispatch (all steps)                               | green, audit `"subjects": 1057`                                          |
| [38803655961](https://github.com/MPiland/artificer-toolkit/actions/runs/38803655961) | `ci/platform-13-t9`       | dispatch `steps=manifest,env,codegen,deploy,audit` | red: audit `Missing platform content source.` (job fails, logs uploaded) |

The red proof uses the permanent `steps` dispatch input (it is also how a slice runs a partial check), so there is no test-only input to remove.

Step durations in seconds (script `summary.json`; job totals from the API):

| Step                                     | 38802771155 | 38804230986 | red 38803655961 |
| ---------------------------------------- | ----------- | ----------- | --------------- |
| manifest                                 | 16          | 17          | 10              |
| env                                      | 1           | 1           | 1               |
| codegen                                  | 22          | 24          | 15              |
| deploy                                   | 18          | 18          | 12              |
| seed                                     | 90          | 94          | skipped         |
| audit                                    | 2           | 2           | 1 (exit 1)      |
| install and package build (setup action) | 88          | 335         | n/a             |
| backend start to `/version`              | 13          | 8           | n/a             |
| job total                                | 4 m 20 s    | 8 m 32 s    | about 3 m       |

Setup time varies with runner load (the 335 s run shared the account with a full Tests run).

Local heavy-lane proof (read-only), re-run on the fixed source `6eebd664a`: batch `platform-13-t9-local-audit-2` through `withValidationLock.ps1` ran `node scripts/liveBackendValidation.mjs --steps=audit` against `phase82-convex-local-linux`: exit 0, audit `"subjects": 1057`, `"definitions": 60`, `"systems": 1`, 39 s (log `local-validation/platform-13-t9/local-batch2.log`). The worktree has no installed dependencies, so the batch linked the main checkout's `node_modules` in as junctions for the run and removed the links afterwards. The first proof, before the fixes, was exit 0 in 5 s. Audit only, so the local backend's deployed code and data stay untouched; the deploy and seed steps share the same script and were proved in CI.

## Proposed ledger edits

- PLATFORM-13.T9 status → done once the proof below is recorded; AC PLATFORM-13.11 → done.

## Follow-ups (out of scope)

- Run the Session Worker (wrangler) and Playwright live proofs in CI.
- Investigate the intermittent `developmentLifecycleProof.test.ts` deep-equal failure in CI Convex suite 3/4 (passes on some runs of the same source).
