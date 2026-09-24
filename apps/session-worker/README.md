# Native live-session Worker

`apps/session-worker` is the Phase 8.2 WebSocket edge. One hibernatable Session Durable Object is addressed per Campaign Session, and the stable `LiveSessionRoom` export points to `NativeLiveSessionRoom`. While its authority epoch is active, the room is the single live-command authority for Door changes and standalone token move/undo. It also handles recipient-filtered transient fanout. Currently, Character Sheet mutations and Encounter rules execution still run in Convex.

The approved cutover target moves heavy live rules and fact preparation into this Session DO using the existing TypeScript rules runtime. Character Sheet writes stay in Convex, atomically with the corresponding Encounter result. The DO must receive the validated Convex commit receipt before acknowledging those commands. Authorized input capture, commit validation and that command route remain incomplete; see ADR 0029 before extending this boundary.

`nativeCharacterRules` now prepares Character facts from the protected `/live-sessions/character-rules` capture endpoint using the existing context, Builder and Sheet algorithms. It retains each read request/checksum for atomic commit validation, including missing sources and catalogue membership. It performs no writes or acknowledgements; connecting it to the command coordinator remains required. Publication pages bound ordinary payload reads, while maximum-size shared parent chains still need local backend validation.

`nativeEncounterRules` prepares action source/target facts from the protected `/live-sessions/encounter-rules` endpoint and the Character preparation path. Actor reads include the first effect page; larger effect sets use bounded continuation reads. Existing action mechanics and relationship algorithms run in the Worker. The final atomic commit must validate authorized identities and complete read ranges without reloading all captured payloads into one Convex transaction. Command dispatch, execution and commit integration remain unfinished.

## Configuration

Configure these server-only values for each Worker environment:

- `LIVE_SESSION_ALLOWED_ORIGINS`: comma-separated exact web origins;
- `CONVEX_SITE_URL`: the matching Convex HTTP Actions origin;
- `LIVE_SESSION_TICKET_SECRET`: the ticket-signing secret shared with Convex;
- `LIVE_SESSION_WORKER_SECRET`: the independent Worker-to-Convex secret shared with the protected live-session HTTP Actions;
- `RULES_CONTINUATION_SECRET`: the rules continuation sealing secret, identical in Convex and this Worker and never sent over HTTP. It is independent of Better Auth's secret.

Keep both secrets out of browser variables. The protected HTTP boundary compares `LIVE_SESSION_WORKER_SECRET` through the stable `x-artificer-live-session-secret` header. Bootstrap and Scene capture/hydration also require the signed-in user's bearer token. Internal publication and presentation control use the independent Worker secret and their authority fences.

For local development, copy `.dev.vars.example` to an ignored env file and point `CONVEX_SITE_URL` at the existing local Convex site. Then run:

```powershell
yarn workspace @artificer-toolkit/session-worker dev --local --ip 127.0.0.1 --port 8787 --env-file <absolute-path> --types=false
```

The web app uses `VITE_LIVE_SESSION_WEBSOCKET_URL=ws://127.0.0.1:8787`. The local browser gate starts Vite and Wrangler while reusing the existing local Convex backend.

## Validation and deployment

Run the native package checks before promotion:

```powershell
yarn workspace @artificer-toolkit/session-worker typecheck
yarn workspace @artificer-toolkit/session-worker test
yarn workspace @artificer-toolkit/session-worker build
```

Managed variables and secrets must be set for the selected staging or production deployments before the corresponding authorized deploy. No managed Convex URL is committed in `wrangler.jsonc`.

For each supported `COMMAND`, the room executes against its minimum live projection and atomically commits SQLite state, the replay receipt, and the ordered Convex publication outbox before broadcasting `COMMAND_COMMITTED`. The outbox records the actor's command-time role. Protected Convex publication verifies that evidence, stable identity, epoch, sequence, checksums, Scene version, and exact result; later Session closure or membership changes cannot discard an acknowledged command. Public access and new commands still require current permissions. Convex remains the durable cross-session/system store and recovery source. Direct overlapping Convex writes are fenced while the room authority is active. Other commands, including Encounter rule paths not explicitly supported by this live contract, continue through their owning Convex functions.

Transient previews remain recipient-filtered and ephemeral; they do not enter the command journal or publication outbox.

Live Scene presentation changes use the protected `SET_SCENE_PRESENTATION` control operation. It shares the command order, publishes all prior commands, and calls the fenced Convex presentation setter before invalidating the old Scene and refreshing socket admission. It preserves the authority epoch and replay journal; publication failure leaves the prior presentation in place.

Before deploying the Scene-only protocol with required command-time actor roles over a previous Worker version, drain and release active epochs and verify their outboxes are empty. Pending publications must complete under the previous version; preserve committed replay and publication evidence.

See [live-session coordination](../../docs/architecture/live-sessions.md) and [ADR 0029](../../docs/adr/0029-convex-backend-cutover.md).
