# Lane 2: platform and accounts closeout

Living handoff for lane 2 of the Phase 8.2 parallel lanes (approved 2026-10-12; see "Parallel lanes" in [phase-08-2-convex-cutover.md](phase-08-2-convex-cutover.md)). Lane 1 is the integration owner and owns the local Docker Convex backend. Branch: `claude/lane2-platform-closeout-4c0e7f`, rebased on `codex/phase-08-2-convex-cutover`.

Scope: PLATFORM-1, PLATFORM-4, ACCOUNTS-1, 2, 3, 5, 8 (missing journey proofs), PLATFORM-12.1 (web tests run real contracts) and PLATFORM-14.1 (three clean full web runs). RELEASE-6 rides in the batched live run.

## Journey gap findings (2026-10-12)

| PBI        | Ledger gap                             | Finding                                                                                                                                                                                                                                        | Plan                                                                                                                |
| ---------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| PLATFORM-1 | none                                   | `apps/apis/tests/developmentFoundation.ts` is the HTTP smoke (public query, anonymous denial, closed signup); local codegen is lane 1's routine.                                                                                               | Run the smoke in the live batch; lane 1 supplies a current codegen log.                                             |
| PLATFORM-4 | profile and art images                 | The avatar journey already exists (`avatar.test.ts` "uploads, crops, reads, replays, recrops and removes", loopback R2, cleanup to zero objects); portraits retire in `library.test.ts`. Authored art had no cleanup leg.                      | New journey in `authoredAssets.test.ts`: upload, publish, owner-only signed read, delete, bytes and quota released. |
| ACCOUNTS-1 | SSR browser; native bearer             | The `auth-browser` live proof (`apps/web/tests/live-backend/authenticatedSession.ts`) drives SSR sign-in, reload, HttpOnly/Lax cookie, sign-out, revoked JWT, protected redirect and no legacy requests. Native bearer had no HTTP-level test. | Bearer exchange in `accountJourneys.test.ts`; `auth-browser` in the live batch.                                     |
| ACCOUNTS-2 | rejected real signup                   | Real handler rejection had only a live smoke.                                                                                                                                                                                                  | `accountJourneys.test.ts` drives `/sign-up/email` through the Better Auth handler.                                  |
| ACCOUNTS-3 | single signup-to-verified run          | `apps/apis/tests/localAuth.ts` needs signup open on the backend and an email sink.                                                                                                                                                             | `accountJourneys.test.ts`: signup, captured link, verify, email and username login, bearer JWT read, sign-out.      |
| ACCOUNTS-5 | successful login to the requested path | `profile-browser` signs in from `/systems?redirect` back to `/systems`, then by username, and isolates accounts in one browser.                                                                                                                | `profile-browser` in the live batch.                                                                                |
| ACCOUNTS-8 | "each privacy setting"                 | There is no profile visibility setting: profiles are caller-only (ACs 8.1 to 8.3). The gap text asks for a feature the ACs do not define.                                                                                                      | `profile-browser` in the live batch; question recorded below.                                                       |

## ACCOUNTS-8.4: profile visibility

The product owner answered Q4 (it is kept in lane 1's open-questions doc): profiles are Private by default with a Public setting. Lane 1 registered ACCOUNTS-8.4; the rule and the public fields are D109 in [phase-08-2-decisions.md](phase-08-2-decisions.md). Lane 2 builds the schema DTO, the Convex query and auth, the settings control, the public profile page and the two-account journey. The live browser leg runs after merge on lane 1's side, in the `profile-browser` mode.

## Known worktree limitation

Full web unit runs cannot reach 0 failures in a Claude worktree. `node_modules/@mantine/notifications` is a junction into the main checkout, so Vite refuses `__root.tsx`'s `?url` CSS import from outside the worktree root, and the two `src/routes` suites fail at load. Lane 1 runs PLATFORM-14.1 in the main checkout on the merged source with `scripts/runWebUnitRuns.ps1`, recording into `docs/validation/platform-14-web-unit-runs.md`. `fs.allow` is intentionally left unchanged.

## Live batch (needs lane 1's go-ahead)

Proofs: `auth-browser`, `profile-browser` (ACCOUNTS-1, 5, 8), `developmentFoundation.ts` (PLATFORM-1, ACCOUNTS-2), RELEASE-6 (`campaign-membership-browser` and the scene-live diagnostics).

Lane 1 approved the batch on 2026-10-12, provided the shared validation lock is held for the whole run. The ignored runner `local-validation/lane2/live.ps1` does this:

1. Checks that :3000 and :8787 are free, then takes the lock.
2. Builds the web app with `--mode proof` and serves it with `vite preview` on :3000.
3. Starts the Worker on :8787 with the main checkout's `apps/session-worker/.dev.vars` (path only).
4. Runs the foundation smoke and the four proofs through `scripts/runLocalConvexProof.ps1`, with `YARN_INJECT_ENVIRONMENT_FILES` set to the main checkout's `local.application.env`.
5. Stops only the processes it started and releases the lock.

Blocked: the session's permission classifier denied running it, so it needs the user's permission or a run by lane 1.

PLATFORM-1.1 proof per lane 1: `local-validation/attack18b/codegen.log` (08:33, source eee255079), from the same push as the current local deploy (`local-validation/attack18b/deploy.log`).

## Status

- PLATFORM-4 DONE: new authored-art cleanup journey in `authoredAssets.test.ts`, plus an owner-binding upload test across all eight authored kinds (17/17), plus the existing avatar and portrait journeys. Cleanup asserts charged bytes and variants are non-empty before release.
- ACCOUNTS-2, ACCOUNTS-3 DONE: `apps/apis/convex/accountJourneys.test.ts` (3/3) drives the real Better Auth handler: closed-flag rejection with no account or email, and signup → emailed link → verify → email and username login → bearer JWT exchange verified against JWKS → protected read → sign-out and revoked exchange; and emailed-code recovery (new password signs in, old password and old session refused). These run the real handler in-process (convex-test), not over a local socket; ACCOUNTS-3.1 says so in its ledger note. The test unsets `PUBLIC_SIGN_UP_ENABLED` because the local process env can carry it.
- ACCOUNTS-1 native bearer leg is proved in the same file; its SSR leg, ACCOUNTS-5, ACCOUNTS-8 and PLATFORM-1 wait on the live batch.
- PLATFORM-12.1 code is complete outside `campaigns/vtt`. Three things remain open: the browser runs below, the vtt slice, and the ledger, which keeps the AC IN_PROGRESS.
  - Mocks name functions through generated `api` refs, and fixtures and story data parse through DTO schemas (`fixtureContracts.test.ts`).
  - Sheet rest stories and tests take previews from the real rules-runtime projection, via `sheet/fixtures/playedCharacters.fixture.ts`. That module holds a played Fighter, plus a Fighter 2 / Rogue 1 with a -2 Max HP adjustment that covers mixed hit dice. The hand-written `createCharacterRestPreviewFixture` is deleted.
  - The Builder Native Draft story ran stale: it mocked `characters/builder:resolve` and `:preview`, which ADR 0036 removed in favour of client-side evaluation, so its preview assertion could never hold. It now runs the real `createBuilderEvaluator` over the SRD snapshot fixture (`builder/evaluation/builderSnapshot.fixtures.ts`).
  - An independent assertion audit against HEAD found one fixture bug: both played Characters shared an id, so story rest previews went to the wrong Character. It is fixed, with a red-first regression test in `CharacterSheetRestMulticlass.test.tsx`. The audit also flagged two loosened `findAllByText(...)[0]` matchers, now restored to exact `findByText`.
  - Owed after merge (Storybook can't start in a worktree): browser runs of `CharacterSheetRest.stories.tsx`, `MarketingProductCapture.stories.tsx` and `CharacterBuilderAuthoringRuntime.stories.tsx`. These now load rules-runtime and SRD source-data in the Storybook bundle.

## PLATFORM-12.1: excluded `campaigns/vtt` violations (owned by the VTT lane)

String function names in mocks:

- `CampaignScenePreparation.test.tsx` lines 130 and 137 (`media/vttMapActions:finalize`, `getDelivery`)
- `CampaignTabletopWindow.stories.tsx` line 367 (`characters/sheetSlices:get`)
- `useCampaignChatRoom.test.tsx` lines 27 and 28 (`campaigns/rolls:executePrivate`, `reveal`)

DTO literals not parsed through their schema (count per file):

| File                                         | Literals |
| -------------------------------------------- | -------- |
| `CampaignTabletop.stories.fixtures.ts`       | 9        |
| `CampaignTabletopActionDrawer.stories.tsx`   | 8        |
| `CampaignTabletopActionDrawer.test.tsx`      | 6        |
| `CampaignTabletopDecisionDrawer.stories.tsx` | 7        |
| `CampaignTabletopDecisionDrawer.test.tsx`    | 10       |
| `CampaignTabletopWindow.stories.tsx`         | 7        |
| `CampaignVttPresentation.stories.tsx`        | 1        |
| `CampaignVttMovement.stories.tsx`            | 1        |
| `CampaignVttStage.model.test.ts`             | 1        |
| `liveSessionClient.test.ts`                  | 8        |
| `useCampaignLiveSession.test.tsx`            | 2        |
| `useRoomEncounterRead.test.tsx`              | 2        |
| `vttLoadFixture.data.ts`                     | 2        |

Product code outside the vtt folder: `apps/web/src/data/campaigns/encounterActions.ts` builds its reference with `makeFunctionReference('encounters/actionChoices:get')` instead of the generated `api` ref. This was left alone because it is product code tied to `apps/apis/convex/encounters` (lane 1).

- PLATFORM-14.1 pending: three full web runs after PLATFORM-12.1 lands. Known blocker in this worktree: `src/routes/-routerContextSecurity.test.ts` and `src/routes/-sessionConvergence.integration.test.tsx` fail at load with Vite `Denied ID D:/dev/artificer-toolkit/node_modules/@mantine/notifications/styles.layer.css?url`. It also happens at baseline with lane 2's edits set aside, so it predates them. Cause: in this worktree, `node_modules/@mantine/notifications` is a junction into the main checkout's `node_modules`. Its realpath therefore falls outside the worktree's Vite root, and Vite refuses `__root.tsx`'s `?url` import. This comes from the worktree install, not from product code, so the full runs need a checkout whose `node_modules` sits inside its root (the main checkout, or this branch after merge).
