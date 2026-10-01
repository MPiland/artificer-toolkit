# Phase 8.2 Gate 1: Foundation, auth, operations

- **Status:** transitional evidence summary
- **Scope:** acceptance status and evidence origin for the 15 Gate 1 cases
- **Update when:** a Gate 1 case or criterion in the [acceptance ledger](../../roadmap/08-2-convex-cutover-acceptance.json) changes status or evidence
- **Recorded:** 2026-09-25, from the ledger; run `node scripts/acceptanceProgress.mjs` for live counts

Gate 1 has **14/15** cases and **46/51** criteria accepted. A further **5** criteria and **1** case are READY_FOR_ACCEPTANCE: implemented and covered by current tests, awaiting the final-source R08 run ([readiness review](gate-readiness-2026-09-25.md)).

The ledger's `criteria` arrays are the authority for what each case must prove; this page summarizes them with the proof tier and where the evidence came from. Raw logs are not copied here.

> **Evidence location.** Most raw evidence lives only in the Codex backup worktree, under `.codex/worktrees/phase-08-2-convex-cutover/.codex/validation/`: [open question Q2](../../handoffs/phase-08-2-decisions.md#resolved) counts 653 of the ledger's 725 evidence references there, and every one of the 675 entries in the ledger's evidence arrays uses a `.codex/validation/` path. Only the `phase82-goal-20260923` packet is also copied to ignored `local-validation/`. The final R08 re-proof on the final source will supersede this evidence; the backup worktree is deleted only after R08 passes.

## F01 — Local Convex development and code generation

- **Status:** ACCEPTED
- **Accepted:** 2026-09-03
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `F01.1` ACCEPTED: Official Convex push and codegen succeed against an isolated local deployment and against personal dev flexible-goshawk-837.
- `F01.2` ACCEPTED: The shared schema, including the indexed profile table, typechecks against the generated API.
- `F01.3` ACCEPTED: Over real HTTP a public query succeeds, anonymous session and identity calls are denied and signup stays closed.

Evidence:

5 ledger reference(s), 5 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (3)
- `phase82-foundation (cloudDevEvidence)` (2)

## F02 — Schema, validators, indexes, and bounded contracts

- **Status:** ACCEPTED
- **Accepted:** 2026-09-03
- **Proof tier:** REVIEW
- **Criteria met:** 3/3

What was proven or remains to prove:

- `F02.1` ACCEPTED: Foundation schema, validators and indexes pass contract review with no open finding.
- `F02.2` ACCEPTED: Static API generation isolates client types without backend casts.
- `F02.3` ACCEPTED: A bootstrap admits exactly one paired System per platform source, and multi-System pagination still works through separate paired imports.

Evidence:

9 ledger reference(s), 9 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (9)

## F03 — Better Auth SSR and native-compatible bearer authentication

- **Status:** ACCEPTED
- **Accepted:** 2026-09-04
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 4/4

What was proven or remains to prove:

- `F03.1` ACCEPTED: Authenticated SSR renders, hydrates and reloads with an HttpOnly/Lax session cookie in a real browser against personal dev.
- `F03.2` ACCEPTED: Native-compatible bearer/JWT calls succeed, and sign-out, revoked JWTs and unauthenticated protected routes are denied or redirected.
- `F03.3` ACCEPTED: The authenticated shell sends no legacy tRPC or Supabase request, and disposable accounts are cleaned up exactly.
- `F03.4` ACCEPTED: Early typing survives blocked hydration, premature submission is blocked and fragment cleanup completes without warnings.

Evidence:

29 ledger reference(s), 29 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (29)

## F04 — Server-controlled signup defaults closed

- **Status:** ACCEPTED
- **Accepted:** 2026-09-03
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 2/2

What was proven or remains to prove:

- `F04.1` ACCEPTED: An unset signup flag reports signup as disabled.
- `F04.2` ACCEPTED: Real Better Auth email/password signup is rejected with EMAIL_PASSWORD_SIGN_UP_DISABLED, with no test bypass.

Evidence:

2 ledger reference(s), 2 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (2)

## F05 — Verified signup

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `F05.1` ACCEPTED: Signup, email link capture and verification complete over real local HTTP, followed by email and username login.
- `F05.2` ACCEPTED: A verified account makes protected native bearer/JWT reads; recovery and revocation work and signup bypass is denied.
- `F05.3` ACCEPTED: The /auth/confirmed callback and rendered local delivery pass the current-source auth and email tests (16/16).

Evidence:

4 ledger reference(s), 4 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (1)
- `phase82-signup` (1)
- `phase82-f05-final` (2)

## F06 — Initial account invitations

- **Status:** ACCEPTED
- **Accepted:** 2026-09-03 (notes)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 4/4

What was proven or remains to prove:

- `F06.1` ACCEPTED: Invitations are issued only through the internal CLI, with hashed, recipient-bound 256-bit tokens that expire and rotate.
- `F06.2` ACCEPTED: Redemption atomically creates an ordinary account and consumes the token; invalid, expired, wrong-recipient, replayed and username-colliding redemptions fail and late failures roll back.
- `F06.3` ACCEPTED: Deployed HTTP keeps the issuer and redeemer private and denies foreign origins.
- `F06.4` ACCEPTED: Concurrent redemption on personal dev succeeds exactly once per fixture, followed by login and bearer-protected calls, with signup still closed.

Evidence:

14 ledger reference(s), 14 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (14)

## F07 — Login

- **Status:** ACCEPTED
- **Accepted:** 2026-09-04
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `F07.1` ACCEPTED: Email or username login returns to the requested path with account isolation, SSR/reload, an HttpOnly/Lax cookie, sign-out, and revoked-JWT and protected-route denial.
- `F07.2` ACCEPTED: Overlapping session-convergence invalidation no longer blanks the home route, and regression tests prove eventual convergence and revocation behavior.
- `F07.3` ACCEPTED: The two-account login/profile browser journey and the original Feat browser reproduction pass on unchanged source with exact cleanup.

Evidence:

8 ledger reference(s), 8 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (4)
- `phase82-feat` (4)

## F08 — Password reset and session revocation

- **Status:** ACCEPTED
- **Accepted:** 2026-09-04
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `F08.1` ACCEPTED: Password recovery is atomic, with resend and exhaustion limits and safe concurrent resets.
- `F08.2` ACCEPTED: Wrong and consumed codes and password mismatches are rejected, and the reset URL carries no secret across reload.
- `F08.3` ACCEPTED: A reset denies the old password and existing JWTs, isolates a second account and allows a new login with SSR and logout.

Evidence:

9 ledger reference(s), 9 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (3)
- `phase82-auth-closure` (6)

## F09 — Usernames

- **Status:** ACCEPTED
- **Accepted:** 2026-09-04
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `F09.1` ACCEPTED: Usernames are normalized, moderated and unique, with Better Auth as the uniqueness authority and availability checks advisory only.
- `F09.2` ACCEPTED: In the browser, a colliding username is rejected, and rename, case-only display preservation, reload and login with the new canonical username pass.
- `F09.3` ACCEPTED: The profile uses the real Convex subscription hook, receiving updates and unsubscribing on auth loss.

Evidence:

6 ledger reference(s), 6 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (6)

## F10 — Profile privacy

- **Status:** ACCEPTED
- **Accepted:** 2026-09-04
- **Proof tier:** AUTHORIZATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `F10.1` ACCEPTED: Profile query and update act only on the caller; real native requests deny anonymous access and extra or spoofed user IDs.
- `F10.2` ACCEPTED: A two-account browser journey that reuses the same browser storage leaks neither bio nor username.
- `F10.3` ACCEPTED: Profile components handle the real subscription hook, auth loss, draft isolation and unsaved or in-flight edits (12 component tests).

Evidence:

10 ledger reference(s), 10 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (10)

## F11 — Superadmin authorization

- **Status:** ACCEPTED
- **Accepted:** 2026-09-08
- **Proof tier:** AUTHORIZATION
- **Criteria met:** 4/4

What was proven or remains to prove:

- `F11.1` ACCEPTED: Role provisioning is internal-only, UUID-targeted and requires a verified active target.
- `F11.2` ACCEPTED: Authorization reads the live stored role and session, rejects bans, revocation and ordinary users, and has no second role authority.
- `F11.3` ACCEPTED: Every provider-admin endpoint, including impersonation and arbitrary user updates, returns 404.
- `F11.4` ACCEPTED: Social moderation list, open and review operations use the shared superadmin guard.

Evidence:

10 ledger reference(s), 10 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (5)
- `phase82-f11-final` (2)
- `phase82-foundation (cloudDevEvidence)` (3)

## F12 — Account deletion

- **Status:** READY_FOR_ACCEPTANCE
- **Accepted:** 2026-09-19 (reopened 2026-09-24, ADR 0033)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 0/5

Reopened 2026-09-24 under ADR 0033. Its earlier evidence proves the superseded Session-scoped contract and is historical; the case must pass again on the final source.

What was proven or remains to prove:

- `F12.1` READY_FOR_ACCEPTANCE: Wrong-password deletion and deletion by the owner of an ACTIVE or ARCHIVED Campaign are refused with no writes.
- `F12.2` READY_FOR_ACCEPTANCE: Deletion through Better Auth revokes every session and stale JWT and removes private Characters, authored content, Profile, Social, notification, usage and media state.
- `F12.3` READY_FOR_ACCEPTANCE: Shared chat, rolls, the Session log, Campaign-owned Encounter Run history (ADR 0033) and retained handout delivery survive with Deleted user attribution.
- `F12.4` READY_FOR_ACCEPTANCE: Account deletion evicts the exact user from the Campaign live table (ADR 0033).
- `F12.5` READY_FOR_ACCEPTANCE: Deferred cleanup converges identically on rerun, and an injected rollback preserves the complete persisted catalogue.

Evidence:

6 ledger reference(s), 6 under `.codex/validation/` in the backup worktree:

- `phase82-gate-progress-20260917` (2)
- `local-convex-linux-20260915` (4)

## F13 — React Email and Resend delivery

- **Status:** ACCEPTED
- **Accepted:** 2026-09-03
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 2/2

What was proven or remains to prove:

- `F13.1` ACCEPTED: React Email templates render in the internal Node action, and a real local sink receives verification and recovery email.
- `F13.2` ACCEPTED: Closed input, configured-origin and loopback guards and official Resend component enqueue pass focused tests with zero external email calls.

Evidence:

2 ledger reference(s), 2 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (2)

## F14 — R2 upload, authorized read, and deletion

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 4/4

What was proven or remains to prove:

- `F14.1` ACCEPTED: Upload claims bind caller, target, profile, type, size and expiry for avatars, Character portraits, authored images in all eight domains, Campaign files and handout maps.
- `F14.2` ACCEPTED: Finalization reauthorizes, validates bytes, applies shared processing and quotas, and attaches only current fenced results.
- `F14.3` ACCEPTED: Signed reads enforce current ownership or membership.
- `F14.4` ACCEPTED: Reference-aware cleanup retries provider failures and keeps keys until the provider acknowledges deletion.

Evidence:

21 ledger reference(s), 21 under `.codex/validation/` in the backup worktree:

- `phase82-foundation` (9)
- `phase82-campaign-file-actions` (1)
- `phase82-campaign-file-web` (1)
- `phase82-character-portrait` (1)
- `phase82-f14-final` (9)

## F15 — Deterministic source-data import and audit

- **Status:** ACCEPTED
- **Accepted:** 2026-09-03
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 5/5

What was proven or remains to prove:

- `F15.1` ACCEPTED: All 1,083 original source files are preserved in packages/source-data/src with no missing or unexpected paths, and all 1,051 root UUIDs are retained.
- `F15.2` ACCEPTED: Import loads 1 System, 1,051 roots and 50 reusable definitions with their original UUIDs; an identical rerun inserts nothing and matches the manifest checksum.
- `F15.3` ACCEPTED: Import rolls back atomically and rejects identity, System, duplicate, bounds, pointer and corruption errors.
- `F15.4` ACCEPTED: Real HTTP denies all eight internal import and audit endpoints.
- `F15.5` ACCEPTED: The full cloud-dev import and read-back pass within the mutation CPU limit using 128 KiB input batching.

Evidence:

14 ledger reference(s), 14 under `.codex/validation/` in the backup worktree:

- `phase82-foundation (cloudDevEvidence)` (5)
- `phase82-source-data` (1)
- `phase82-foundation` (8)
