# Session Worker

`apps/session-worker` is the Cloudflare Worker and Session Durable Object that hosts the live table. One hibernatable Durable Object is addressed per Campaign (`idFromName(campaignId)`, [ADR 0033](../../docs/adr/0033-campaign-owned-play-and-session-log.md)). While its authority epoch is active, the room is the authority for live Scene commands, Encounter commands, held Character Sheet play, chat and rolls: each command commits to the room's SQLite store and journal before acknowledgement, and fenced checkpoints publish the durable product record to Convex ([ADR 0035](../../docs/adr/0035-room-authoritative-live-encounters.md)).

Architecture, command flows, the authorization cache, the store and journal, inputs hydration, checkpoints, drain/recovery, previews, limits and deployment configuration live in [live-session coordination](../../docs/architecture/live-sessions.md). This README covers only what is needed to run and deploy the package.

## Layout

- `src/index.ts`: the Worker entry. It serves `GET /health`, content snapshots (`/content/...`), the secret-protected control route from Convex, and the origin- and ticket-checked WebSocket upgrade, then forwards to the Campaign's room. It exports the stable `LiveSessionRoom` class (`NativeLiveSessionRoom`).
- `src/nativeLiveSessionRoom.ts`: the Durable Object, with its `room*` and `native*` modules for Scene, Encounter, Character Sheet and chat execution.
- `src/durableCommandJournal.ts`, `src/roomEncounterStore.ts`, `src/roomInputs.ts`, `src/roomCheckpoints.ts`: the SQLite journal, room store, hydrated inputs and checkpoint publication.
- `src/liveSessionRoutes.ts`: typed calls to Convex's protected live-session HTTP routes.
- `src/contentSnapshots.ts`, `src/contentSnapshotStorage.ts`, `src/contentToken.ts`: private content snapshot delivery and verification.
- `src/testing`: fixtures shared with `apps/apis` tests. `test/`: Workers-pool tests of the room, journal and entry point.

## Configuration

Configure these server-only values for each Worker environment:

- `LIVE_SESSION_ALLOWED_ORIGINS`: comma-separated exact web origins;
- `CONVEX_SITE_URL`: the matching Convex HTTP Actions origin;
- `LIVE_SESSION_TICKET_SECRET`: the ticket-signing secret shared with Convex;
- `LIVE_SESSION_WORKER_SECRET`: the independent Worker-to-Convex secret shared with the protected live-session HTTP Actions;
- `RULES_CONTINUATION_SECRET`: the rules continuation sealing secret, identical in Convex and this Worker and never sent over HTTP. It is independent of Better Auth's secret.
- `CONTENT_SNAPSHOT_TOKEN_SECRET`: the content token secret, identical in Convex and this Worker and independent of every other secret. It verifies tokens for private content snapshots.

The `CONTENT_SNAPSHOTS` R2 binding (`wrangler.jsonc`, per environment) names the private content snapshot bucket that Convex's `CONTENT_SNAPSHOT_R2_BUCKET` writes. `GET /content/...` serves it: PLATFORM source objects publicly, others only with a content token in the `Authorization` header ([media](../../docs/architecture/media.md#content-snapshot-delivery-adr-0036-s3--local-implementation)).

Keep every secret out of browser variables. The protected HTTP boundary compares `LIVE_SESSION_WORKER_SECRET` through the stable `x-artificer-live-session-secret` header. Bootstrap and Scene capture/hydration also require the signed-in user's bearer token. Internal publication and presentation control use the independent Worker secret and their authority fences.

For local development, copy `.dev.vars.example` to an ignored env file and point `CONVEX_SITE_URL` at the existing local Convex site. Then run:

```powershell
yarn workspace @artificer-toolkit/session-worker dev --local --ip 127.0.0.1 --port 8787 --env-file <absolute-path> --types=false
```

The web app uses `VITE_LIVE_SESSION_WEBSOCKET_URL=ws://127.0.0.1:8787`. The local browser gate starts Vite and Wrangler while reusing the existing local Convex backend.

The workspace development command pins `--host localhost` so Wrangler preserves a loopback request
hostname instead of rewriting it to the configured production route. Local snapshot delivery requires
that hostname. The fixture fetch uses manual redirects and refuses non-200 responses.

The local lifecycle supplies `LOCAL_CONTENT_SNAPSHOT_ORIGIN=http://127.0.0.1:8026` and loads `CONTENT_SNAPSHOT_TOKEN_SECRET` from local Convex into the Worker process in memory. This bridges snapshot reads to the same local R2 fixture bucket that Convex writes. Any `http://127.0.0.1:<port>` origin marks the Worker as local development (`isLocalDevelopment`); `https`, `localhost` and every other host are refused, as is a non-loopback request host. The marker also enables the development-only room routes, among them `POST /internal/live-sessions/test-rolls/<campaignId>`, which queues the room's next dice for tests (consumed in order, as given, then an optional repeat value, ahead of the platform's secure random). A room not running local development ignores any queue. Its fixture-only raw response preserves gzip bytes, object metadata and ETags; private reads still require the scoped content token. Omit this variable in managed environments, which use the `CONTENT_SNAPSHOTS` R2 binding.

## Commands

```powershell
yarn workspace @artificer-toolkit/session-worker typecheck         # regenerate the types, then tsc for src and test
yarn workspace @artificer-toolkit/session-worker test              # Workers-pool tests (test/native*.test.ts), single worker
yarn workspace @artificer-toolkit/session-worker test:unit         # src/*.test.ts through the root Vitest config
yarn workspace @artificer-toolkit/session-worker types             # regenerate the ignored src/worker-configuration.d.ts from the committed .dev.vars.example names, so every checkout gets the same Env
yarn workspace @artificer-toolkit/session-worker build             # wrangler deploy --dry-run
yarn workspace @artificer-toolkit/session-worker build:staging
yarn workspace @artificer-toolkit/session-worker preflight:managed # needs MANAGED_VTT_BASE_URL and MANAGED_LIVE_SESSION_ENDPOINT
```

Repo-level equivalents are `yarn dev:session-worker`, `yarn build:session-worker`, `yarn deploy:session-worker:staging` and `yarn deploy:session-worker:production`. Deployment uses `--keep-vars`, so dashboard-set secrets survive. Managed variables and secrets must be set for the selected staging or production environment before an authorized deploy, and no managed Convex URL is committed in `wrangler.jsonc`. `preflight:managed` verifies that the managed app answers, the Worker `/health` answers and the application CSP allows the Worker WebSocket origin. Focused checks are implementation feedback; the release gate is `yarn validate:pre-staging:local` (see [live-session coordination](../../docs/architecture/live-sessions.md#verification-and-release-gates)).

Before deploying a protocol change over a previous Worker version, drain and release active epochs and verify their outboxes are empty. Pending publications must complete under the previous version; preserve committed replay and publication evidence.

See also [ADR 0029](../../docs/adr/0029-convex-backend-cutover.md).
