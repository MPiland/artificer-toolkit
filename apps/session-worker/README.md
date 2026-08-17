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

Set these non-secret deployment variables in each Worker's Cloudflare **Settings → Variables and Secrets**. `keep_vars` preserves them across Wrangler deployments:

- `LIVE_SESSION_ALLOWED_ORIGINS`: comma-separated exact HTTPS web origins;
- `LIVE_SESSION_EXECUTOR_URL`: the deployed `/.netlify/functions/live-session-executor` HTTPS URL.

Set secrets with Wrangler rather than committing values:

```shell
yarn workspace @artificer-toolkit/session-worker wrangler secret put LIVE_SESSION_TICKET_SECRET
yarn workspace @artificer-toolkit/session-worker wrangler secret put LIVE_SESSION_EXECUTOR_SECRET
```

### Staging

The named `staging` Wrangler environment deploys `artificer-live-session-staging` on `tabletop-staging.artificertoolkit.app`. It has a separate Durable Object namespace and therefore cannot read or mutate production room journals. Its current Netlify preview origin and executor URL live under `env.staging.vars` in `wrangler.jsonc`, making the repository configuration the deployment source of truth. Update both values together when staging moves to another preview or a stable branch-deploy origin.

```shell
yarn build:session-worker:staging
yarn deploy:session-worker:staging
yarn workspace @artificer-toolkit/session-worker wrangler secret put LIVE_SESSION_TICKET_SECRET --env staging
yarn workspace @artificer-toolkit/session-worker wrangler secret put LIVE_SESSION_EXECUTOR_SECRET --env staging
```

The deploy scripts pass `--keep-vars` explicitly. If Wrangler still shows either staging URL being removed, cancel the deployment rather than accepting the diff.

Use staging-only ticket and executor secrets; the two values must match the Netlify **Deploy Previews** context. In Netlify, the Deploy Previews context keeps the ordinary runtime names (`DATABASE_CONNECTION_STRING`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and the two `LIVE_SESSION_*_SECRET` names) but assigns staging values to them. Its browser value is `VITE_LIVE_SESSION_WEBSOCKET_URL=wss://tabletop-staging.artificertoolkit.app`. The `STAGING_*` names are for trusted local operator scripts, not browser or Netlify runtime code. When a stable Netlify branch-deploy origin exists, update the two committed staging endpoint values once to that origin instead of changing them for each PR.

The production Worker custom domain is `tabletop.artificertoolkit.app`. Cloudflare creates its DNS record and certificate during deployment; remove any conflicting CNAME before deploying. Its two non-secret values are `LIVE_SESSION_ALLOWED_ORIGINS=https://artificertoolkit.app` and `LIVE_SESSION_EXECUTOR_URL=https://artificertoolkit.app/.netlify/functions/live-session-executor`. Deploy the Netlify application first so the private executor exists, then run `yarn deploy:session-worker:production`. Set the Netlify browser build variable `VITE_LIVE_SESSION_WEBSOCKET_URL=https://tabletop.artificertoolkit.app` and redeploy Netlify so the browser bundle and CSP use the Worker origin. Netlify also needs the matching two server-only secrets plus the existing Supabase/database settings.

Before deployment, run `yarn workspace @artificer-toolkit/session-worker typecheck` and `yarn workspace @artificer-toolkit/session-worker build`. The build is a Wrangler dry run and does not publish anything. After both deployments, set `MANAGED_VTT_BASE_URL=https://artificertoolkit.app` and `MANAGED_LIVE_SESSION_ENDPOINT=https://tabletop.artificertoolkit.app`, then run `yarn preflight:session-worker:managed`. It verifies the public app, private executor presence, Worker health, and production CSP without authenticating or mutating data.

## Managed release journey

The deployed release gate uses one clearly labeled, reusable production smoke Campaign rather than creating a new Durable Object room on every run. Keep three dedicated smoke accounts: one Campaign owner and two active players. The Campaign must have an open Session, active Encounter, attached scene, ready VTT map, one unlocked door visible to all three users, and one uniquely labeled hidden token visible only to the GM. Do not point the gate at customer data.

For an empty managed environment, `yarn provision:vtt-managed-smoke:staging` creates that exact fixture from the `STAGING_*` database and Supabase values. The production equivalent is `yarn provision:vtt-managed-smoke:production` and reads only `PROD_*`. Both require the three `MANAGED_VTT_*_EMAIL`/`MANAGED_VTT_*_PASSWORD` pairs below plus `CONFIRM_MANAGED_VTT_SMOKE_PROVISION=provision-managed-vtt-smoke`. The command updates those dedicated users, refuses to create a duplicate Campaign named `Artificer managed VTT smoke`, and prints only the non-secret paths and labels needed below. Keep credentials in the ignored root `.env.local` for local operation and in the CI secret store when automated remotely; never commit them.

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
MANAGED_VTT_PLAYER2_EMAIL=<second-dedicated-smoke-player>
MANAGED_VTT_PLAYER2_PASSWORD=<second-dedicated-smoke-password>
MANAGED_VTT_GM_ONLY_TOKEN_LABEL=<unique-hidden-token-label>
MANAGED_VTT_TABLETOP_PATH=/tabletop/campaigns/<public-id>/sessions/<number>
MANAGED_VTT_CHARACTER_SHEET_PATH=/characters/<public-id>/sheet
MANAGED_VTT_RULE_ACTION_LABEL=Use <reversible-resource-label>
```

Run `yarn test:web:e2e:vtt-managed:release`; it runs the non-mutating preflight first and then the credential-bearing browser journey with tracing and video disabled. The retained journey signs in the GM and both players in isolated browser contexts, proves all three use the exact preflighted Worker, verifies real ticket requests, the GM-only snapshot sentinel, exact signed VTT map delivery/readiness for both players, and shared door commits, then runs two warmup Use/Restore pairs plus ten measured pairs from the first player's real sheet. The executor measures successful authoritative work and sends each host timing only to the requester; the gate requires nearest-rank p95 below `100 ms` for `SCENE_ONLY` and below `250 ms` for `RULE_BOUND`. Browser click-to-render values are retained as diagnostic evidence only. It disconnects every client through the authority-release grace period, reconnects all three to prove authoritative reconstruction, and restores the original door/resource state before closing contexts. Timing evidence is attached to the Playwright result. The shared smoke Campaign must not be used by concurrent gate runs.

The Worker deliberately uses the Durable Object Hibernation WebSocket API. Connected clients remain attached while an idle room leaves memory; SQLite journal state and the private executor recover the room when the object wakes.

One persisted Durable Object alarm multiplexes command retries, the 20-second reconnect release, and 10-second Postgres authority renewal. Retryable renewal failures pause durable command draining until renewal succeeds; terminal authority loss closes sockets so clients obtain a fresh ticket and canonical snapshot. The journal retains every nonterminal command and the newest 10,000 terminal receipts. RESUME receipts are returned only to the authenticated user who submitted the command, and transient token previews are filtered separately for each viewer's fog/control projection.

See [live-session coordination](../../docs/architecture/live-sessions.md) and [ADR 0020](../../docs/adr/0020-local-and-remote-live-session-host.md) for the authority and recovery model.
