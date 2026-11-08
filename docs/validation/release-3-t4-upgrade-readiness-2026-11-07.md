# RELEASE-3.T4: staging upgrade-in-place readiness

> **Status:** done 2026-11-07, local only. Nothing was read from or written to Convex Cloud.
>
> **Scope:** AC RELEASE-3.3 for the first staging promotion (RELEASE-3.T2): what staging's Convex deployment already holds, which stored-schema changes narrow it, the migrations they need, and the rehearsal that proves the release deploys over it.
>
> **Update when:** staging receives any source or data, or before every later promotion (see [Later promotions](#later-promotions)).
>
> **Verification:** the repository records cited below, the user's confirmation on 2026-11-07, and the D213 Live backend run.

## Staging's deployed source: none

The Convex staging deployment is `beaming-pig-820` in project `artificertoolkit/artificer-toolkit`. It was created on 2026-09-03 with no source upload, seed or data reset, and staging stayed promotion-only:

- [ADR 0029, development runtime amendment](../adr/0029-convex-backend-cutover.md#historical-development-runtime-amendment--2026-09-03): "No source upload, seed, data reset, or default-production change occurred during setup."
- [API README, development target](../../apps/apis/README.md#development-target): "No application code was uploaded during setup."
- [Cutover acceptance](../roadmap/08-2-convex-cutover-acceptance.md): staging "was created without changing default production or uploading code."

No later record shows a deploy. R09 (the staging promotion) is still not started ([gate 5](phase-08-2/gate-5-cutover-release.md)). No workflow deploys Convex, and ADR 0035 forbids agents from using Convex Cloud. On 2026-11-07 the user confirmed that nothing has been pushed or seeded to `beaming-pig-820`. The user is the only other developer, and no agent has deployed to staging.

## Narrowing changes: none possible

A change narrows only against data that staging already stores. Staging has no deployed schema and no tables, so no field, union, literal, table or index in the release can invalidate a stored row. No migration is needed, and none was added.

## Rehearsal: a fresh deploy, already proved in CI

The first promotion is a fresh deploy onto an empty deployment. The D213 Live backend run on the release-candidate tip `ccc73867ecaeb3a33e9ad1cac718616de2629351` rehearsed exactly that: run [42423478779](https://github.com/MPiland/artificer-toolkit/actions/runs/42423478779) (`.github/workflows/live-backend.yml`, `scripts/liveBackendValidation.mjs`) generated the SRD manifest, pushed codegen, deployed, seeded and ran the SRD audit on an ephemeral, empty self-hosted backend, all green. It used the same image digest as the local container. The [T1 packet](release-3-t1-promotion-packet-2026-11-07.md#source-identity) lists it with the other D213 runs.

No stored-schema source changed after the RC tip: `git log ccc73867e..d4db63ad9 -- apps/apis/convex/schema.ts packages/schema packages/shared` is empty. If T2 deploys a later commit, that commit's own green Live backend run is its rehearsal.

No local rehearsal was run, because none is needed for an empty target.

## Guard at T2

This finding holds only while staging stays empty. RELEASE-3.T2 starts with a read-only pre-flight. Right before the first deploy, the operator confirms in the Convex dashboard for `beaming-pig-820` that the Functions page lists no deployed functions and the Data page lists no tables (system tables aside). If either is not empty, stop: the narrowing diff below runs first. The step is in the [T1 packet](release-3-t1-promotion-packet-2026-11-07.md#rollback-capture-run-by-the-operator-before-any-deploy) and the [release runbook](../runbooks/phase-8-2-release.md#staging-promotion).

## Later promotions

From the second promotion on, staging holds data, and AC RELEASE-3.3 applies in full:

1. T2 records the deployed source commit in its promotion manifest. That commit is the base for the next promotion.
2. Before the next promotion, diff the stored schema between that commit and the release: `apps/apis/convex/schema.ts` and the validators it imports from `packages/schema` and `packages/shared`. List every narrowing change: a removed or renamed field, a tightened union or literal, optional to required, or a removed table or index that stored data needs.
3. Give each narrowing change a migration in the repository's existing pattern, with a convex-test unit test that runs the real migration on old-shape rows.
4. Rehearse locally. Deploy the recorded commit to the local container, build data in that shape, deploy the release on top, run the migrations to completion, and confirm the SRD audit is green. Never reset or reseed staging.
