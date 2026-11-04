# PERF-1.T6: intermittent CI failure triage (2026-11-03)

Closes AC PERF-1.5: every intermittent CI failure has a recorded root cause. Each one is either fixed
with a regression test that fails first, or attributed to the throwaway self-hosted backend or the
runner with evidence. Logs and artifacts were read from GitHub Actions. Disposable copies are under the
ignored `local-validation/perf-1-t6/`.

| Failure                                                          | Run                      | Verdict                                                        | Hosted Convex risk                                                       |
| ---------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Room 1006 close, `fetch failed`                                  | 41712055836, 41697786849 | Our test fixture: fake clock fired timers late. Fixed.         | None. No Convex backend was involved.                                    |
| `watchCi.test.mjs` timeout                                       | 41706160093              | Runner: pwsh cold start. Fixed in the test.                    | None                                                                     |
| Convex `IsolateNotClean` (effects-browser)                       | 41761359435              | Convex platform rejection, which Convex marks retryable        | Possible. Product paths fail closed. One SSR gap needs a ruling (below). |
| Concurrent invitation redemption refused both (recovery-browser) | 41761359435              | Our fixture: generated a username that sign-up refuses. Fixed. | None. The product contract holds.                                        |
| Sheet command 1 s timeout                                        | 41767872164              | Owned by PERF-1.T5 (`ci/perf-1-t5`)                            | See PERF-1.T5                                                            |

## Room 1006 close and `fetch failed`

**Failures**

- Run 41712055836, attempt 1, job 126183965186 (Convex suite 3/4): `reviewDataSets.test.ts` failed with
  "The Session room closed the connection (1006 )". The message comes from
  `apps/apis/tests/developmentHttpClient.ts`.
- Run 41697786849, job 126134299668 (Convex suite 4/4): `reviewDataFireAndThunder.test.ts` failed with
  `TypeError: fetch failed`.

Both tests run on convex-test in-process, with the real Session Worker under local workerd
(`apps/apis/tests/fixtures/localRoomWorker.ts`). No Convex backend is involved.

**Cause**

`useRealTimeClock` fakes `setTimeout` for Convex's scheduler and tried to keep the fake clock on real
time in two ways. Neither made faked timers fire on real time:

- `shouldAdvanceTime` adds a fixed 20 ms each time its interval fires. Every event-loop stall (a busy
  convex-test build) leaves the fake clock further behind.
- The 20 ms sync interval called `vi.setSystemTime(realNow())`. In fake-timers, `setSystemTime` shifts
  every pending timer by the same amount, so a timer that came due in real time stays pending.

Node's fetch (undici) times keep-alive and socket timeouts with that faked global `setTimeout`. The
servers it talks to time out idle sockets on real time: the wrangler proxy and the Convex bridge,
whose Node `http` keepAliveTimeout is 5 s. So the client reuses a pooled socket after the server has
already closed it. The request on that socket is reset, which surfaces as `fetch failed` or a room
WebSocket closed with 1006.

The existing `post().catch(post)` in `postToWorker` was added for the same symptom ("the proxy can
drop a pooled connection", ECONNABORTED).

**Evidence**

- `apps/apis/convex/roomClock.test.ts` › "fires a timer on real time after the event loop stalls"
  failed against the old fixture (called 0 times after 1 s of real time, local light-lane run).
- A direct reproduction of the socket reset, a keep-alive request across a 5 s stall, did not fail
  locally. So the keep-alive link is inferred from undici's use of the global timer and from the
  fixture's own retry comment; it is not reproduced.

**Fix**

`useRealTimeClock` now advances the fake clock to real time every 20 ms with
`vi.advanceTimersByTime(realNow() - Date.now())`, which fires every timer that came due on the way.
`shouldAdvanceTime` was removed, so there is one mechanism. The red was proved locally (above). CI's
red-proof job labels every changed file ALREADY-PASSING (run 41845091477), because each fix lives in
a test helper and that job keeps changed helpers.

**Follow-up:** remove the `post().catch(post)` retry once CI runs stay green with this fix.

## `watchCi.test.mjs` timeout

**Failure:** Run 41706160093, job 126163698111. The first test, "exits non-zero … when gh cannot reach
GitHub", returned status `null`: `spawnSync`'s 20 s timeout killed pwsh at 20 028 ms. The later tests
in the file took 7.3 s, 1 s and 1 s. In the same run, `validationLockOwner.test.mjs`'s first pwsh
launch took 24.7 s.

**Cause:** pwsh's first start on a fresh GitHub runner takes up to about 25 s. The per-watch timeout
was timing that one-off start, not the script. This is the runner, not the product, so there is no
hosted risk.

**Fix:** a `beforeAll` hook in `scripts/watchCi.test.mjs` starts pwsh once, with its own 120 s budget,
before the timed watches. The script's timeouts are unchanged.

## Convex `IsolateNotClean` (effects-browser)

**Failure:** Run 41761359435, job 126349652646 (Journeys 3/5). Line 14407 of the backend log reads
"Selected isolate was not clean: Possible memory leak: not enough room for user heap. Total available
size 63.96 MiB out of 99 MiB". The backend answered `POST /api/query` with 503. The caller was the
proof harness, `DevelopmentHttpClient.#encounterCampaign` (`apps/apis/tests/developmentHttpClient.ts`),
called from `prepareRun` (`developmentEncounterEffects.ts`). This was the only occurrence across all 10
shard backend logs of runs 41761359435 and 41767872164.

**Cause, from the Convex backend source** (convex-backend, `crates/isolate/src/isolate.rs`,
`client.rs`, `crates/errors/src/lib.rs`):

- `check_isolate_clean` reports `TooMuchMemoryCarryOver` when a reused isolate has less than the 64 MiB
  user heap free.
- `start_request` repeats that check and, per its own comment, makes the failure retryable: it is
  tagged `RejectedBeforeExecution`, so the function never ran.
- That error maps to HTTP 503, WebSocket close code `Again`, and gRPC `ResourceExhausted`.
- The isolate is recreated afterwards (`should_recreate_isolate`).

Convex documents a 64 MiB memory limit for the Convex runtime ([Limits](https://docs.convex.dev/production/state/limits),
[HTTP Actions](https://docs.convex.dev/functions/http-actions)).

**Verdict:** a platform rejection from the shared isolate pool, raised before execution, so it is safe
to retry. Hosted Convex runs the same isolate code, so hosted can return it too. Nothing commits, so
there is no data risk. How the product callers behave:

- **Web app reactive client (WebSocket):** reconnects and retries on `Again`, so the user sees nothing.
- **Session Worker → Convex routes:** a 503 becomes the `UNAVAILABLE` "try again" refusal, and the
  command can be repeated (`apps/session-worker/src/nativeRoomEncounterCommand.ts:60`,
  `nativeLiveSessionRoom.ts:1144`).
- **SSR `ConvexHttpClient`** (`apps/web/src/server/auth/convex.server.ts:69`): the render fails with an
  error, and a reload succeeds. Whether `ConvexHttpClient` retries a 503 itself was not verified: reading
  its source in `node_modules` was denied. Public guidance treats retries as an application choice, and
  only for reads (for example, convex-better-auth-svelte PR #43 retries query paths only).

**Open ruling for the orchestrator:** should SSR retry a Convex query once on 503, mirroring the
existing one-shot 429 retry? Today a rare platform rejection becomes an error page instead.

## Concurrent invitation redemption refused both redeemers (recovery-browser)

**Failure:** Run 41761359435, job 126349652774 (Journeys 4/5). "Exactly one concurrent redemption must
succeed." Actual statuses `[400, 400]`, expected `[200, 400]`, in `createAuthor`
(`apps/apis/tests/developmentDrafts.ts`).

**Cause:** the Journeys 4 `convex-function.log` at 02:48:15 and 02:48:16 shows both
`authInvitations:redeem` calls failing with "That username isn't allowed.", not with the invalid-link
error the losing redeemer gets in every other race in that log.

- The fixture's `generateValidUsername` (`apps/apis/tests/fixtures/generatedUsername.ts`) checked names
  against the client policy, `validateUsername`.
- Sign-up enforces `validateUsernameOnServer` (`apps/apis/convex/authFactory.helper.ts:122`), which also
  refuses blocked-word compounds read through digit look-alikes.
- A random hex suffix can pass the client check and fail the server one, for example
  `Draft_550717e705e5`. The winner's mutation then rolls back, the invitation stays, and the second
  redeemer fails the same way.

**Contract:** the invitation's check and its consumption share one mutation transaction
(`apps/apis/convex/authInvitations.ts`). So exactly one concurrent redeemer creates the account. The
other gets the ordinary invalid-link refusal (400), never a second account. The product behaved
correctly.

**Fix and proofs**

- The fixture generator now uses the server-authoritative policy.
- `apps/apis/convex/generatedUsername.test.ts` › "draws again when only the server policy refuses the
  name" fails against the old generator, which returned `Draft_550717e705e5` because the client
  check passes it and the server check refuses it (both checked against the built
  `@artificer-toolkit/shared`). The file's other assertions now check the server policy,
  which is stricter.
- `apps/apis/convex/authInvitations.test.ts` › "lets exactly one of two concurrent redemptions create
  the account" proves the contract in convex-test. It passes before the fix as well, because the
  product was already correct.

## Sheet command 1 s timeout

Run 41767872164, job 126370499136 (Journeys 5/5). The root cause and fix belong to PERF-1.T5, branch
`ci/perf-1-t5`. This document records only the attribution.

## Other intermittent failures seen in the same runs (not in this task's list)

These are recorded here so they are not lost. Neither was diagnosed.

- **`apps/apis/convex/liveSessions/encounterMovementSealedResponses.test.ts:109`**, run 41697786849,
  job 126134299668. The timeline had 7 entries where 6 were expected (`baseline + 1`) after resolving a
  movement choice. Root cause unknown. The file does not use `useRealTimeClock`.
- **social-browser**, run 41761359435, job 126349652774. `locator.click` timed out waiting for the
  "Report" button at stage "report profile" (`apps/web/tests/live-backend/social.ts:424`). Root cause
  unknown.
