# ADR 0040: Staged account deletion

- **Status:** decision (approved 2026-10-28 by the orchestrator: ruling A plus C, then option 1, departure first; recorded in D199; implemented by RELIABILITY-21.T22)
- **Date:** 2026-10-28
- **Scope:** `apps/apis/convex/accountDeletion.ts`, `accountDeletionJobs.ts`, `accountDeletionFinish.ts`, `lib/authTriggers.helper.ts` and the per-module step mutations
- **Amends:** [ADR 0030](0030-owner-deletion-and-retained-dependencies.md). It drops the promise that account deletion is one rollback-able transaction; every rule about which rows are retained or removed is unchanged.
- **Verification:**
  - convex-test: `accountDeletion.test.ts` (the job completes with no owned rows; a failed step commits nothing and is retried until it succeeds; an owner is refused at the request and at scheduling);
  - the live browser journey `apps/web/tests/live-backend/accountDeletion.ts`, which polls with a bound until the account and owned rows are gone.

## Context

Account deletion ran `deleteUser` and the whole app cascade in one mutation: Campaign departure, media retention, private Characters, authored content, sources, Blueprints and purges. On self-hosted Convex that call evaluates the 6.4 MB `auth.ts` module graph, and the cascade grows with the account's data. It broke the 1 s mutation limit on CI (RELIABILITY-21.19).

## Decision

Account deletion is a durable job (`accountDeletionJobs`) of bounded, idempotent steps scheduled through `ctx.scheduler`:

1. **Request.** `accountDeletion:execute` rechecks the session, email and password and refuses an owner of an ACTIVE or ARCHIVED Campaign. It revokes every session and credential and creates the job, all in one commit. The user is signed out at once, and the HTTP request returns `null`, meaning "deletion scheduled".
2. **Steps, in order.**
   - CAMPAIGNS: one membership departure per invocation, through the existing departure code.
   - SOCIAL: Social preparation.
   - MEDIA: retention of one READY VTT map per invocation.
   - CHARACTERS: one private Character per invocation, then roll history in batches. Each removed active
     Character sends a CHARACTER notice to the live room of every Campaign the owner left, so a room
     that froze its actor at departure removes it (D200).
   - AUTHORED: one authored root or draft-only subject per invocation.
   - SOURCES: one content source per invocation.
   - FINISH: Blueprints in batches, then rate limits, the feed and the entitlement.
   - ACCOUNT: calls `deleteUser`, and so must run last.
     Each step lives in the module that owns its rows, so an invocation evaluates only that module's graph.
3. **Atomic account commit.** In `auth:onDelete`, the ACCOUNT step commits in one transaction:
   - the owned-Campaign gate and the no-ACTIVE-membership gate;
   - a check that the job is at ACCOUNT;
   - the delete of the profile and the Social profile;
   - the delete of the job row.
     It then schedules the purges, which refuse to run while the profile exists: copy-job cleanup, usage, notification delivery, media and Social cleanup. `onDelete` refuses a deletion that was not scheduled.
4. **Idempotency and retry.** Every commit rotates the job's token, so a duplicate or stale invocation is a no-op. Convex does not retry a failed scheduled mutation, so each dispatch also schedules a watchdog. Unless a newer commit moved the token, the watchdog re-runs the step with backoff `min(15 s × 2^attempt, 1 h)`. A failed step commits nothing, so the retry starts from the last committed position.

## Consequences

- Privacy is eventual, not atomic. The account is signed out and loses every credential at once; owned rows are removed within the job's run, and the profile last.
- A step failure no longer rolls back the request. The job keeps retrying, and the account stays signed out with no credentials.
- Better Auth needs `onCreate`, `onUpdate` and `onDelete` in one module, so `auth.ts` keeps its trigger imports lean (`lib/authTriggers.helper.ts` schedules by function reference only).
- Known gap: if the provider user vanishes outside this flow while the job sits at ACCOUNT, the step keeps retrying until the cap. This is recoverable by an operator and deferred.
