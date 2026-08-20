# Local session host

`@artificer-toolkit/session-host` is the headless Node process for local live VTT play. It exposes the same Zod-validated native WebSocket protocol as the managed Cloudflare Durable Object path, but invokes the shared application services, native GoRules Zen evaluator, and Supabase repositories directly.

The host is not the managed remote deployment. Remote sockets run through `apps/session-worker`, and durable remote commands execute through Netlify's private `live-session-executor` function. Keeping the local process in this monorepo preserves one rules implementation without requiring Cloudflare or an extra network hop during local play.

## Runtime behavior

- `GET /health` returns the stable local health payload.
- `/live-session/:sessionId` accepts native WebSocket upgrades only.
- Admission requires the application subprotocol plus a single-use, 60-second signed ticket from the Campaign-session API.
- Browser upgrades require an Origin in the explicit `SESSION_HOST_ALLOWED_ORIGINS` allow-list.
- One hydrated runtime owns each exact Campaign/session pair and holds the existing expiring Postgres command-authority lease.
- Durable commands use dependency-aware conflict keys, conflict-local FIFO, a maximum of eight concurrent disjoint executions, idempotent replay, private results, and persist-before-broadcast semantics.
- Transient drag/pointer/measurement previews are sequenced and relayed without persistence or Zen.
- A 20-second disconnect grace keeps the runtime available for reconnect; the client obtains a fresh single-use ticket and receives an authoritative `READY` snapshot.

Local hosting is online, not offline-first. It still uses configured Artificer/Supabase identity and persistence. A future launcher may start the process invisibly; Docker is not required on a player's machine. The existing Dockerfile remains a reproducible Linux/integration artifact, not a Render deployment or polished self-hosting product.

## Commands

- `yarn dev:session-host` starts the process on `PORT` or `2567`.
- `yarn build:session-host` builds the Node entrypoint.
- `yarn start:session-host` runs the built entrypoint.
- `yarn test:session-host:local` runs the disposable authenticated integration against local Supabase.

Required server-only configuration:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `DATABASE_CONNECTION_STRING`
- `LIVE_SESSION_TICKET_SECRET` with at least 32 bytes
- optional `SESSION_HOST_ALLOWED_ORIGINS`

The local integration creates one GM and five disposable players, two distinct present Characters, an Encounter, Campaign, open session, and storage-backed VTT map. It admits Player A first while Player B's Character is present, verifies private Character-response redaction, six-client synchronization, command-authority fencing, native Zen selection, exact replay, private committed Scene snapshots, map-delivery authorization, concurrent disjoint Scene rebase, deterministic Scene replay, buffered command recovery across a new ticket/reconnect, persistence, cleanup, and explicit host-processing gates. The current native WebSocket run measured `153 ms` warm Character round-trip p95, `174 ms` resource use, `176 ms` spell-slot use, `34 ms` Encounter resource use, `196 ms` reconnect recovery, and `20.16 ms` Scene-host p95 on local Supabase. Rule-bound host processing was `159 ms` p95, including at most `10 ms` of native Zen evaluation.

The direct Node-host integration remains a lower-level transaction and concurrency gate. For browser parity, `yarn test:web:e2e:vtt-local` starts `integration/localExecutorServer.ts` on loopback port `8888` behind a locally running Durable Object on `8787`, alongside Vite and local Supabase. It executes the same authenticated browser journey as the managed gate; staging then proves deployed API/network behavior and managed timing evidence.
