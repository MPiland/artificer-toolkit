# Phase 08 — Web VTT

> **Note:** Implementation references in this ledger to PostgreSQL/Supabase, the Netlify executor, `apps/session-host`, Zen/rule packs, and SQL schedules predate the Phase 8.2 Convex cutover ([ADR 0029](../adr/0029-convex-backend-cutover.md)) and are historical. Convex cutover acceptance is tracked in the [Phase 8.2 ledger](08-2-convex-cutover-acceptance.md).

> **Status:** rebaselined — retained scene/live-session foundation is implemented; rules runtime, authoritative combat, authoring workflows, and presentation follow the fixed acceptance ledger
> **Depends on:** [Phase 01](01-dice-and-roll-infrastructure.md), [Phase 02](02-media-and-file-pipeline.md), [Phase 06](06-live-campaign-play.md), and [Phase 07](07-encounters.md)
> **Unlocks:** the complete connected web play loop and its viability test
> **Primary ADRs:** [0009](../adr/0009-vtt-encounter-event-boundary.md), [0010](../adr/0010-platform-neutral-design-system.md), [0020](../adr/0020-local-and-remote-live-session-host.md), [0023](../adr/0023-shared-rules-kernel-and-system-capabilities.md), [0024](../adr/0024-current-published-authored-content.md), and [0025](../adr/0025-game-system-catalogues-and-encounter-blueprints.md)
>
> **Acceptance authority:** [Phase 08 fixed acceptance ledger](08-vtt-acceptance.md)

## Goal

Complete one Encounter-backed responsive web virtual tabletop over the shared Rules Kernel and
platform-owned Game System capabilities. Retain the existing maps, calibration, square/gridless play,
walls, doors, lights, darkness, tokens, fog, measurement, player preview, movement, chat, native
WebSocket, and local/managed host foundation. Add authoritative modular combat, source/homebrew parity,
authoring workflows, and System-driven presentation without introducing another actor, dice, or rules
authority.

## Current starting point

- Phase 07 is expected to own actor state, initiative, rolls, commands, events, projection, replay, authorization, and Realtime reconciliation.
- The Character Sheet remains a standalone play surface and does not own rounds or a combat log.
- `packages/design-system` can share semantic intent but not canvas or platform presentation components.
- Native WebSocket transport, alarm-renewed Durable Object coordination, bounded recovery journal, local Node hosting, renderer-neutral scene contracts/reducer, scene persistence, deterministic geometry/exploration, private projection, and the `VTT_MAP` backend are implemented. The standalone tabletop window, Session and Character Sheet launch points, source-window live Sheet command route for present Characters, GM scene editor, map upload/calibration, React/Pixi boundary, and non-canvas controls are implemented. The renderer progressively loads signed tiles, keeps complete textures independent of delivery expiry, retries incomplete delivery after a network reconnect, renders exploration fog and labeled measurements, relays pointer/drag previews, and expires abandoned transient visuals. Automated six-client recovery/privacy, role-separated browser, and headless load correctness diagnostics pass; the headed three-hour hardware soak provides real frame-gap, Long Task, and FPS evidence. A retained three-account managed deployment gate now binds the GM and both players to the preflighted Worker and covers real ticket issuance, private-snapshot withholding, exact signed map delivery/readiness, reversible scene commits broadcast to all three clients, full connection-cycle release, and authoritative reconnect without accumulating per-run Durable Object rooms; its deployed run remains.
- `apps/session-worker` owns managed remote rooms and transient fanout; the private Netlify executor owns native Zen/application execution. `apps/session-host` provides the same wire protocol with direct execution for local play.

## Requirements

- Add a platform-neutral VTT scene model derived from the authoritative Encounter projection and exact scene events.
- Support both managed internet play and local hosting through the same native WebSocket `/live-session/:sessionId` protocol. Managed players connect to a hibernatable Durable Object without sharing a LAN or opening an inbound port; local hosting runs a headless Node process on the host machine.
- Route live-session commands through one authoritative coordinator per active Campaign session. Derive and atomically claim a conservative conflict-key set, run disjoint work concurrently with conflict-local FIFO, evaluate mechanics through the exact pinned Zen revision in Node when needed, persist durable events/projections, then journal and publish compact private results/deltas.
- Store reusable versioned Campaign scene definitions and materialize the exact definition version when attached to an Encounter. Encounter projection/events own live tokens, door state, fog, and live geometry overrides.
- Extend Encounter commands/events for durable scene actions: scene attachment, structural edits, token placement/drop, door state, fog edits, and measurements.
- Keep selection, hover, open panels, camera position, drag interpolation, measurement preview, and similar transient UI state local or ephemeral.
- Use React plus one imperative PixiJS canvas boundary as the first responsive web renderer. Keep navigation, chat, initiative, actor panels, menus, controls, inspectors, dialogs, and accessible alternatives in ordinary React UI outside the canvas; do not flow frame-rate animation through React state.
- Launch the authenticated tabletop as a dedicated, reusable auxiliary browser window from either the Campaign Session workspace or the Character Sheet's latest open Session. Keep the originating workspace or Sheet open independently; the tabletop does not become a navigation hub back into those surfaces.
- Allow one admitted user to connect from multiple devices without one connection replacing another. Keep camera, zoom, selected tool, Play/Edit mode, and open panels local to each connection while all committed gameplay uses the same room authority. Treat tablet landscape as a first-class map surface with collapsible GM tools; make phone play Character-Sheet-first while retaining a focused player map for controlled-token movement, navigation, measurement, and authorized interactions.
- Let GMs switch between Play and Edit tools while a scene is live. Players receive only Play controls and authorized interactive scene elements. Door swing angle and other structural behavior are authored by the GM/editor, never selected by a player during play.
- Render the locally dragged token immediately without waiting for a network round trip. Broadcast bounded transient positions separately, interpolate them for remote viewers, and validate every path segment against authoritative barriers before a preview is relayed. The GM chooses `Reveal while dragging` (default) or `Reveal on drop`; on-drag vision is a private, server-derived transient projection and only the final path/fog batch is persisted. A stale or rejected transient position can never replace a newer committed position.
- Maps and token assets reuse Phase 02 ready-asset identity, opaque object keys, and API-owned metadata. New `VTT_MAP` bytes use private Cloudflare R2 while ordinary media and existing map bytes remain in Supabase Storage; persisted provider identity keeps Campaign and scene references portable.
- `VTT_MAP` has separate byte, dimension, pixel-count, quota, transfer, and processing rules from ordinary Campaign attachments and handout maps.
- Large map transfers use bounded R2 multipart upload. `VTT_MAP` accepts JPEG, PNG, and WebP up to 25 MiB, 8192 px per side, and 64 MP; Sharp generates renderer tiles without changing stable asset identity.
- Manual fog is explicit Encounter/scene state with GM-only mutation in v1. Advanced lighting includes wall occlusion, point/cone lights, darkness polygons, and server/client-consistent exploration.
- Every durable action is idempotent, versioned, authorized, replayable, and reconcilable after reconnect.
- Authenticate each socket on connection and again only after credential expiry or an explicit Worker challenge. Campaign membership removal, account deletion, auth-account suspension/deactivation, administrative revoke, Session finish, and Campaign archive/delete immediately evict the affected user or close the affected room without interrupting unrelated players.
- Treat connectivity as intermittent: reconnect restores the committed scene from the authoritative Encounter projection/events, then resumes private invalidation and ephemeral cues without peer-hosted state.
- Provide non-canvas alternatives for initiative, actor selection, token selection/movement, measurements, rolls, chat, and state inspection.

## Design

```mermaid
flowchart TD
  Encounter["Encounter projection + events"] --> Scene["packages/shared<br/>platform-neutral scene model"]
  Scene --> WebRenderer["PixiJS web renderer"]
  WebRenderer --> Intent["Typed semantic scene intent"]
  Intent --> Command["Typed live-session command"]
  Command --> Coordinator["Remote Durable Object\nor local Node host"]
  Coordinator --> Executor["Node application services"]
  Executor --> Encounter
  Executor --> Zen["Pinned native Zen runtime"]

  WebUI["Web panels and controls"] --> Command
```

The shared scene model contains renderer- and transport-independent maps, calibration, square/gridless grids, diagonal policy, tokens, barriers, lights, darkness, fog, measurements, private projections, snapshots, durable deltas, and bounded transient envelopes. It must not import PixiJS, React, WebSocket, DOM types, database types, React Native, or platform gestures.

```mermaid
sequenceDiagram
  participant A as Player A
  participant B as Player B
  participant H as Room coordinator
  participant X as Node command executor
  participant DB as Encounter event/projection

  A->>A: Render local drag each frame
  A-->>H: Sequenced transient drag preview
  H-->>B: Relay transient drag preview
  B->>H: Durable door command
  H->>X: Journaled command + claimed conflict keys
  X->>DB: Validate and persist
  DB-->>X: Commit
  X-->>H: Idempotent result
  H-->>A: Durable door delta
  H-->>B: Caller result and durable door delta
  A->>H: Final token drop with expected version
```

Transient previews give every admitted player concurrent visual feedback. Durable changes become globally authoritative only after persistence; the latest committed geometry validates the complete path and final drop, so a stale drag cannot overwrite a door change or cross a blocking wall. The GM can append an `Undo last token move` event that restores the prior token position and affected fog layers when no later overlapping state makes that restoration unsafe. Undo never deletes history and cannot erase knowledge a player already gained.

Scene movement and its derived fog chunks commit atomically as one versioned batch. Player broadcasts use fresh server-projected scene snapshots so newly explored entities appear together while hidden geometry remains withheld. Pinned Character vision is overlaid for the calculation only; explicit scene vision wins and authored scene data is not rewritten.

## Web renderer benchmark gate

Before public web beta, test representative desktop, tablet, and mobile-class browser hardware:

- One 8K map with 100 tokens and representative walls, lights, darkness, and fog.
- Pan, zoom, token drag, measurement, fog, and player-view preview.
- At least 45 sustained frames per second during the defined stress journey.
- No gesture stall longer than 100 ms.
- Isolated local and managed Scene-only host processing p95 below 100 ms; rule-bound host processing p95 below 250 ms, with isolated local cold command below 500 ms.
- The local browser parity journey always builds the Functions runtime and runs the managed workload through Vite, Wrangler, executor, and local Supabase, but applies only a subsecond shared-machine sanity ceiling. The managed release journey collects the strict limits from private executor origin-only timing receipts against real deployed connections, not browser click-to-render diagnostics.
- Reconnect without duplicate movement or stale projection.
- Acceptable memory and thermal behavior during a three-hour session.

If the gate fails, retain the scene model and command contracts and simplify or replace only the web renderer. Do not fork Encounter state or scene semantics.

## Ordered workstreams

1. **Lock architecture and migrate transport.** Native remote/local WebSocket admission, hibernation-safe alarm renewal, bounded Durable Object journal, private Netlify executor, local Node host, actor-bound replay, conflict scheduling, private ready snapshots/transients, and reconnect recovery are implemented. Production deployment evidence remains. _Backend complete._
2. **Define scene contracts and reducer.** Renderer-neutral scene projection, semantic intents, atomic durable commands/events, transient envelopes, collision/visibility/lighting geometry, bounded exploration chunks, and deterministic replay are implemented. _Backend complete._
3. **Add persistence and reconstruction.** Campaign definitions, materialized Encounter instances, projections, ordered events, private snapshots/deltas, and semantic conflict rebase are implemented. _Backend complete._
4. **Extend the asset pipeline.** `VTT_MAP` limits, resumable transfer, renderer tiles, stable references, signed access, deletion protection, Campaign authorization, and browser upload/calibration are implemented.
5. **Build the retained React/Pixi tracer.** The dedicated authenticated tabletop window, Session/Sheet launch points, GM Play/Edit boundary, scene editor, map upload/calibration, layered map/tiles/grid/fog/lighting/token/measurement rendering, local drag/final committed movement, wall/door/light/darkness tools, pointer previews, transient expiry, player preview, reconnect, and player-focused narrow layout are implemented.
6. **Complete authoritative live play.** Durable scene commands, transient previews, pinned Character vision with scene override, private projections, Zen-bound mechanics, the production browser play surface, accessible non-canvas alternatives, and attended Character Sheet commands routed through the room authority are implemented.
7. **Run responsive, load, accessibility, memory, authorization, and recovery tests.** Automated workerd and real local-Supabase six-client recovery journeys pass. The required full local browser journey must build the Functions runtime and use the same Vite → Wrangler Durable Object → private executor → Supabase topology, reversible door/Max-HP workload, and functional assertions as the deployed journey; its subsecond shared-machine p95 ceiling is a sanity check, while staging differs only by deployed endpoints, credentials, and real API/network performance evidence under the strict 100/250 ms limits. These fixed criteria prevent an open-ended local optimization loop. The retained 8K/100-token browser fixture passes headless correctness, transient-retention, and sampled-heap gates; headless Chromium uses SwiftShader, so timing and canvas-gesture response remain diagnostic. The headed hardware project enforces non-SwiftShader, sustained `45 FPS`, `100 ms` Long Task, foreground-valid `100 ms` frame-pacing, and real canvas wheel-gesture-response `100 ms` gates on the same full fixture. Frame pacing is valid only while the document remains continuously visible and focused; any external focus or visibility loss invalidates the hardware run instead of being ignored. The opt-in headed three-hour soak has passed; execute the deployed remote journey before beta while preserving non-canvas interaction.

## Acceptance gates

- Replaying the same Encounter projection/events reconstructs byte-for-byte equivalent scene-domain values across responsive web sessions.
- A non-member cannot load map assets, subscribe to scene broadcasts, or issue scene commands.
- A remote table on unrelated home, mobile, or public networks completes the same join, scene load, action, reconnect, and asset-access journeys as a local table.
- Players cannot move or reveal tokens outside their actor-control capability.
- Duplicate/reordered movement delivery does not duplicate or regress committed position.
- Historical Character receipts never replace a newer `READY`, committed broadcast, or cached Sheet version.
- Removed members and stale-role sockets are rejected within the next authority-renewal interval while unaffected members continue receiving permitted traffic.
- Durable Object eviction/hibernation reconstructs pending delivery and committed scene state without duplicate execution.
- Reload/reconnect restores the committed scene and discards stale local drag state.
- Manual fog edits are GM-controlled; automatic exploration is deterministic and replayable; neither path leaks hidden geometry through player projections or assets.
- Canvas and non-canvas controls can perform every required durable action.
- Session and Character Sheet launch points reuse a dedicated tabletop window that remains usable when tiled, moved to another display, or screen-shared; players never receive editor chrome.
- The same user can keep a tablet tabletop and a desktop workspace or phone Character Sheet connected concurrently; actions committed from either surface appear on the others without synchronizing camera or panel state. Tablet play remains map-first and touch-usable, while the phone tabletop remains a focused player fallback rather than a compressed GM editor.
- A Character Sheet left open beside the tabletop routes commands for its present Character through the room authority, acknowledges only persisted commits, and retains the ordinary HTTP path when no open Session owns that Character.
- The web renderer passes the explicit benchmark or the phase records the renderer simplification/replacement before beta.
- VTT actions append Encounter events, never a second combat history or character lifecycle log.
- A VTT map cannot bypass its own profile by uploading as a Campaign attachment, and a normal handout is not treated as a scene map without an authorized VTT reference.

## Out of scope

- D&D 2024 catalogue ingestion, a second product Game System, user-created Systems, arbitrary scripts,
  general environment/object/material simulation, epic progression, Adventure Module Packages, 3D,
  physics, voice/video, AI, marketplace asset sales, offline-first persistence, peer-authoritative
  state, map-art creation, procedural generation, texture painting, public plugin APIs,
  Redis/multi-region orchestration, and a generic storage-provider framework. Local hosting is
  supported but cannot become required for managed online play.

## Concerns and expansions

The responsive browser/PWA remains the canonical VTT client and must pass the benchmark on its own. Packaging does not fix a slow synchronization protocol. A later desktop launcher may reuse the same web renderer and start `apps/session-host` invisibly for local hosting; it must also provide a trusted LAN browser origin and host discovery before tablet/phone connections are presented as an end-user local-play workflow. The headless host is not a reason to duplicate scene or rules code. Electron is not a planned dependency. A native mobile app should be evaluated as a focused companion experience rather than a compressed copy of the full tabletop.

## New-session instruction

Continue from the implemented native WebSocket, Durable Object/local host, scene persistence, VTT map,
geometry/exploration, private projection, and accessible standalone tabletop. First follow the
[shared rules runtime](../architecture/rules-runtime.md) rebaseline and the fixed Gate 1 ledger; do not
resume the superseded version-pinned combat packet. Preserve the Session/Sheet-to-tabletop direction,
GM Play/Edit boundary, player-only Play surface, durable state, broadcast-only previews, and local-only
UI state. PixiJS, React, WebSocket, and DOM types remain outside shared contracts. Staging promotion
waits for the complete final local lifecycle.
