# Session host

`@artificer-toolkit/session-host` is the dedicated long-lived Node process for future live VTT sessions. It uses the free, self-hosted Colyseus core and standard WebSocket transport and is intentionally separate from Netlify's request/response SSR and tRPC deployment.

The same package is the runtime boundary for:

- local play, where a future Artificer launcher starts the process on loopback;
- managed remote play, where Artificer deploys the container.

The host registers one `live-session` room filtered by exact Campaign and session IDs. Static room authentication validates the Supabase access token and active open-session membership before admission. Admission loads durable aggregate versions and materializes the pinned Zen evaluation plus matching structural Builder resolution for every present Character, so active play starts from a committed stream-versioned mechanical snapshot. The room accepts the existing typed Character Sheet and Encounter command envelopes, serializes durable execution, returns the full result only to the caller, and broadcasts only the committed aggregate/version identity to other participants. Reconnect receives the current room and aggregate versions before further commands are accepted.

This is the Phase 07 command-room foundation, not a demonstration room or VTT scene. Character and Encounter services still own authorization, pinned Zen evaluation, and database transactions. Scene geometry, token interpolation, fog, walls, pointers, and rendering remain Phase 08 work.

## Commands

- `yarn dev:session-host` starts the local process on `PORT` or `2567`.
- `yarn build:session-host` builds the production entrypoint.
- `yarn start:session-host` runs the built entrypoint.
- `yarn test:session-host:local` runs the disposable authenticated local integration gate against local Supabase.
- `docker build -f apps/session-host/Dockerfile .` builds Artificer's managed remote image from the repository root.

`GET /health` is the deployment health check. The session host is a separate deployment from Netlify, but remains in this monorepo so it can share authoritative contracts and the embedded Zen runtime without publishing private packages.

The process requires the same `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `DATABASE_CONNECTION_STRING` configuration used by the authoritative application services. Local launch remains a hidden Node process; Docker is managed-remote packaging and is not required on a player's machine.

Advanced user-managed hosting is a later product decision. This workspace does not currently provide a self-hosting installer, Compose stack, configuration UI, or support contract.

The local integration gate creates disposable users, a finalized pinned prepared caster, a pinned Encounter with a charged non-Character actor, a Campaign, and an open session. It verifies two-client synchronization, a strict sub-500 ms first/warm/resource/spell-slot command gate, Encounter persistence and broadcast, exact replay, a buffered command across automatic reconnect, rejection of parallel direct mutations, and command-authority release when the room stops, then removes the fixtures. Setting `SESSION_HOST_INTEGRATION_ENDPOINT` to a loopback HTTP endpoint runs the same gate against an already-running Linux container. The current local Node Character baseline is `211 ms` cold, `250 ms` warm p95, `207 ms` for a resource spend, `239 ms` for a spell-slot spend, and `244 ms` reconnect. The rebuilt Linux image measured `410 ms`, `338 ms`, `365 ms`, `339 ms`, and `412 ms`, respectively. Both mechanics-changing Character commands select the pinned `character-action-resolve` lane. Resource/spell-slot bounded evaluation measured `28.7/9.6 ms` and `34.8/13.2 ms` total/native-Zen locally, and `66.3/17.1 ms` and `50.3/10.0 ms` in Linux. Matching committed snapshots reduced repeated Builder resolution to effectively zero. The committed Encounter actor snapshot reduced a usage-only enemy resource command to `33.8 ms` locally and `58.8 ms` through the Linux container; the Linux service completed in `39.5 ms` with no actor or action evaluation lane. These are local-environment deploy-image measurements rather than production-region SLAs. Managed hosted play still requires deploying the image and configuring its public TLS/WebSocket endpoint and secrets.
