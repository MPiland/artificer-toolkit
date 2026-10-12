# Lane 2: platform and accounts closeout

Living handoff for lane 2 of the Phase 8.2 parallel lanes (approved 2026-10-12; see "Parallel lanes" in [phase-08-2-convex-cutover.md](phase-08-2-convex-cutover.md)). Lane 1 is the integration owner and owns the local Docker Convex backend. Branch: `claude/lane2-platform-closeout-4c0e7f`, rebased on `codex/phase-08-2-convex-cutover`.

Scope: PLATFORM-1, PLATFORM-4, ACCOUNTS-1, 2, 3, 5, 8 (missing journey proofs), PLATFORM-12.1 (web tests run real contracts) and PLATFORM-14.1 (three clean full web runs). RELEASE-6 rides in the batched live run.

## Journey gap findings (2026-10-12)

| PBI | Ledger gap | Finding | Plan |
|---|---|---|---|
| PLATFORM-1 | none | `apps/apis/tests/developmentFoundation.ts` is the HTTP smoke (public query, anonymous denial, closed signup); local codegen is lane 1's routine. | Run the smoke in the live batch; lane 1 supplies a current codegen log. |
| PLATFORM-4 | profile and art images | The avatar journey already exists (`avatar.test.ts` "uploads, crops, reads, replays, recrops and removes", loopback R2, cleanup to zero objects); portraits retire in `library.test.ts`. Authored art had no cleanup leg. | New journey in `authoredAssets.test.ts`: upload, publish, owner-only signed read, delete, bytes and quota released. |
| ACCOUNTS-1 | SSR browser; native bearer | The `auth-browser` live proof (`apps/web/tests/live-backend/authenticatedSession.ts`) drives SSR sign-in, reload, HttpOnly/Lax cookie, sign-out, revoked JWT, protected redirect and no legacy requests. Native bearer had no HTTP-level test. | Bearer exchange in `accountJourneys.test.ts`; `auth-browser` in the live batch. |
| ACCOUNTS-2 | rejected real signup | Real handler rejection had only a live smoke. | `accountJourneys.test.ts` drives `/sign-up/email` through the Better Auth handler. |
| ACCOUNTS-3 | single signup-to-verified run | `apps/apis/tests/localAuth.ts` needs signup open on the backend and an email sink. | `accountJourneys.test.ts`: signup, captured link, verify, email and username login, bearer JWT read, sign-out. |
| ACCOUNTS-5 | successful login to the requested path | `profile-browser` signs in from `/systems?redirect` back to `/systems`, then by username, and isolates accounts in one browser. | `profile-browser` in the live batch. |
| ACCOUNTS-8 | "each privacy setting" | There is no profile visibility setting: profiles are caller-only (ACs 8.1 to 8.3). The gap text asks for a feature the ACs do not define. | `profile-browser` in the live batch; question recorded below. |

## Open question for the product owner

- ACCOUNTS-8 is titled "Control who sees my profile", but no visibility setting exists and the ACs only require caller-only profiles. Is a visibility setting wanted (new PBI), or is caller-only the intended scope?

## Live batch (needs lane 1's go-ahead)

Proofs: `auth-browser`, `profile-browser` (ACCOUNTS-1, 5, 8), `developmentFoundation.ts` (PLATFORM-1, ACCOUNTS-2), RELEASE-6 (`campaign-membership-browser` and the scene-live diagnostics).

## Status

- PLATFORM-4 DONE: new authored-art cleanup journey in `authoredAssets.test.ts` (9/9), plus the existing avatar and portrait journeys.
- ACCOUNTS-2, ACCOUNTS-3 DONE: `apps/apis/convex/accountJourneys.test.ts` (2/2) drives the real Better Auth handler: closed-flag rejection with no account or email, and signup → emailed link → verify → email and username login → bearer JWT exchange verified against JWKS → protected read → sign-out and revoked exchange. The test unsets `PUBLIC_SIGN_UP_ENABLED` because the local process env can carry it.
- ACCOUNTS-1 native bearer leg is proved in the same file; its SSR leg, ACCOUNTS-5, ACCOUNTS-8 and PLATFORM-1 wait on the live batch.
- PLATFORM-12.1 in progress (two disjoint subagent slices; vtt violations to be listed here).
- PLATFORM-14.1 pending: three full web runs after PLATFORM-12.1 lands.
