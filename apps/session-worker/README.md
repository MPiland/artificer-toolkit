# Managed live-session worker

`apps/session-worker` is the managed remote native-WebSocket coordinator. One hibernatable Durable Object is addressed per Campaign session. It owns admission, transient fanout, conflict-key scheduling, and a bounded SQLite command journal; Supabase remains canonical gameplay state, and native GoRules Zen runs in the private Netlify Node executor.

## Local development

Copy `apps/session-worker/.dev.vars.example` to the ignored `apps/session-worker/.dev.vars`, then replace both secret placeholders:

```dotenv
LIVE_SESSION_ALLOWED_ORIGINS=http://localhost:3000
LIVE_SESSION_EXECUTOR_URL=http://localhost:8888/.netlify/functions/live-session-executor
LIVE_SESSION_TICKET_SECRET=<at-least-32-random-bytes>
LIVE_SESSION_EXECUTOR_SECRET=<different-at-least-32-random-bytes>
```

The ticket secret must match the Netlify/API environment. The executor secret must match the private Netlify function environment. Neither secret may use a `VITE_` prefix or enter browser code.

Run the worker with `yarn dev:session-worker`. The browser uses `VITE_LIVE_SESSION_WEBSOCKET_URL=ws://127.0.0.1:8787`; the worker accepts `/live-session/:sessionId` connections only from the configured origin.

## Managed deployment

Set non-secret deployment variables in `wrangler.jsonc` or the Cloudflare Workers configuration:

- `LIVE_SESSION_ALLOWED_ORIGINS`: comma-separated exact HTTPS web origins;
- `LIVE_SESSION_EXECUTOR_URL`: the deployed `/.netlify/functions/live-session-executor` HTTPS URL.

Set secrets with Wrangler rather than committing values:

```shell
yarn workspace @artificer-toolkit/session-worker wrangler secret put LIVE_SESSION_TICKET_SECRET
yarn workspace @artificer-toolkit/session-worker wrangler secret put LIVE_SESSION_EXECUTOR_SECRET
```

The committed Worker custom domain is `tabletop.artificertoolkit.app`. Cloudflare creates its DNS record and certificate during deployment; remove any conflicting CNAME before deploying. Deploy the Netlify application first so the private executor exists, then run `yarn workspace @artificer-toolkit/session-worker wrangler deploy`. Set the Netlify browser build variable `VITE_LIVE_SESSION_WEBSOCKET_URL=https://tabletop.artificertoolkit.app` and redeploy Netlify so the browser bundle and CSP use the Worker origin. Netlify also needs the matching two server-only secrets plus the existing Supabase/database settings.

Before deployment, run `yarn workspace @artificer-toolkit/session-worker typecheck` and `yarn workspace @artificer-toolkit/session-worker build`. The build is a Wrangler dry run and does not publish anything. After both deployments, set `MANAGED_VTT_BASE_URL=https://artificertoolkit.app` and `MANAGED_LIVE_SESSION_ENDPOINT=https://tabletop.artificertoolkit.app`, then run `yarn preflight:session-worker:managed`. It verifies the public app, private executor presence, Worker health, and production CSP without authenticating or mutating data.

## Managed release journey

The deployed release gate uses one clearly labeled, reusable production smoke Campaign rather than creating a new Durable Object room on every run. Keep two dedicated smoke accounts: one Campaign owner and one active player. The Campaign must have an open Session, active Encounter, attached scene, ready VTT map, one unlocked door visible to both roles, and one uniquely labeled hidden token visible only to the GM. Do not point the gate at customer data.

For an empty managed environment, `yarn provision:vtt-managed-smoke` creates that exact fixture. It requires `PROD_DATABASE_CONNECTION_STRING`, the managed `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, process-only `MANAGED_VTT_GM_PASSWORD` and `MANAGED_VTT_PLAYER_PASSWORD`, and `CONFIRM_MANAGED_VTT_SMOKE_PROVISION=provision-managed-vtt-smoke`. The command updates the two fixed smoke-account passwords, refuses to create a duplicate Campaign named `Artificer managed VTT smoke`, and prints only the non-secret paths and labels needed below. Do not save the generated passwords in the repository.

Configure these test-only local variables without committing their values:

```dotenv
CONFIRM_MANAGED_VTT_SMOKE=run-managed-vtt-smoke
MANAGED_VTT_BASE_URL=https://artificertoolkit.app
MANAGED_LIVE_SESSION_ENDPOINT=https://tabletop.artificertoolkit.app
MANAGED_VTT_CAMPAIGN_NAME=Artificer managed VTT smoke
MANAGED_VTT_GM_EMAIL=<dedicated-smoke-owner>
MANAGED_VTT_GM_PASSWORD=<dedicated-smoke-password>
MANAGED_VTT_PLAYER_EMAIL=<dedicated-smoke-player>
MANAGED_VTT_PLAYER_PASSWORD=<dedicated-smoke-password>
MANAGED_VTT_GM_ONLY_TOKEN_LABEL=<unique-hidden-token-label>
MANAGED_VTT_TABLETOP_PATH=/tabletop/campaigns/<public-id>/sessions/<number>
MANAGED_VTT_CHARACTER_SHEET_PATH=/characters/<public-id>/sheet
MANAGED_VTT_RULE_ACTION_LABEL=Use <reversible-resource-label>
```

Run `yarn test:web:e2e:vtt-managed:release`; it runs the non-mutating preflight first and then the credential-bearing browser journey with tracing and video disabled. The retained journey signs in both roles, proves both browsers use the exact preflighted Worker, verifies the real ticket request, GM-only snapshot sentinel, and exact signed VTT map delivery/readiness, performs three warmups plus twenty scene-door commits, then two warmup Use/Restore pairs plus ten measured pairs from the player's real sheet. The executor measures successful authoritative work and sends each host timing only to the requester; the gate requires nearest-rank p95 below `100 ms` for `SCENE_ONLY` and below `250 ms` for `RULE_BOUND`. Browser click-to-render values are retained as diagnostic evidence only. It disconnects every client through the authority-release grace period, reconnects to prove authoritative reconstruction, and restores the original door/resource state before closing contexts. Timing evidence is attached to the Playwright result. The shared smoke Campaign must not be used by concurrent gate runs.

The Worker deliberately uses the Durable Object Hibernation WebSocket API. Connected clients remain attached while an idle room leaves memory; SQLite journal state and the private executor recover the room when the object wakes.

One persisted Durable Object alarm multiplexes command retries, the 20-second reconnect release, and 10-second Postgres authority renewal. Retryable renewal failures pause durable command draining until renewal succeeds; terminal authority loss closes sockets so clients obtain a fresh ticket and canonical snapshot. The journal retains every nonterminal command and the newest 10,000 terminal receipts. RESUME receipts are returned only to the authenticated user who submitted the command, and transient token previews are filtered separately for each viewer's fog/control projection.

See [live-session coordination](../../docs/architecture/live-sessions.md) and [ADR 0020](../../docs/adr/0020-local-and-remote-live-session-host.md) for the authority and recovery model.
