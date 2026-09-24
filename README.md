# Artificer Toolkit

Artificer Toolkit is a creative tabletop RPG authoring workspace and play surface. The current product includes reusable homebrew content, character construction and sheets, Campaign management, Encounter play, and the VTT across desktop and mobile.

## Start here

- Product intent: [PRODUCT.md](PRODUCT.md)
- Visual system: [DESIGN.md](DESIGN.md)
- Domain vocabulary and invariants: [CONTEXT.md](CONTEXT.md)
- Documentation index and precedence: [docs/README.md](docs/README.md)
- Current architecture: [docs/architecture/overview.md](docs/architecture/overview.md)
- Architecture decisions: [docs/adr/README.md](docs/adr/README.md)
- Release lifecycle: [docs/runbooks/phase-8-2-release.md](docs/runbooks/phase-8-2-release.md)
- Agent and contributor rules: [AGENTS.md](AGENTS.md)

When code and prose disagree, use the precedence rules in [docs/README.md](docs/README.md). The architecture documentation describes the current working tree and labels transitional or target behavior explicitly.

## Repository map

The [Phase 8.2 cutover](docs/adr/0029-convex-backend-cutover.md) establishes the final native
Convex boundary below. Retired product workspaces have been removed from the current tree. Their exact before copies and
historical records remain validation evidence; they are not current architecture.

| Module                   | Owns                                                                                           | Does not own                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `apps/web`               | TanStack Start UI, Authoring Workspace, Builder, Sheet, Campaign, Encounter and VTT surfaces   | Product persistence or backend authority      |
| `apps/apis/convex`       | Convex schema, queries, mutations, actions, auth, jobs, storage and reactive product authority | UI rendering or duplicated domain contracts   |
| `apps/session-worker`    | Session Durable Object authority, replay receipts, ordered publication and transient fanout    | Cross-session product persistence or identity |
| `packages/schema`        | Zod-backed public contracts and DTOs                                                           | Persisted rows or application orchestration   |
| `packages/shared`        | Domain vocabulary, node maps, compilers and normalized Character/rules facts                   | Request handling, persistence or UI           |
| `packages/authoring`     | Pure Authoring Schema resolution, portable import preparation and publication validation       | Authentication, persistence or play execution |
| `packages/rules-runtime` | Installed System compilers/policies, native Kernel execution and continuation integrity        | Authentication, persistence or state mutation |
| `packages/source-data`   | Version-controlled canonical source corpus and compressed seed inputs                          | Runtime persistence or product transport      |
| `packages/emails`        | Portable React Email templates                                                                 | Delivery scheduling or provider authority     |

Product reads, writes and SSR hydration cross the generated Convex boundary. During an active live
Session, its Durable Object is the single authority for the supported Door, standalone token
move/undo paths. All Character Sheet commands use their owning Convex mutations, including during live
Sessions. The room commits the minimum SQLite Scene projection, replay
receipt and ordered Convex publication outbox before broadcasting success. Convex revalidates those
publications, drives subscriptions and remains the recovery source after authority release or
eviction. Shared packages remain transport-agnostic, and the version-controlled source corpus
remains independent from runtime storage.

## Two authoring models

Reusable authored content—such as spells, races, feats, equipment, and effects—is structurally described by Authoring Schemas, implemented by the shared node-map DSL. The backend resolves visibility, required state, dynamic options, relationships, hidden-value clearing, nested scopes, and explicit semantic presentation; clients render that resolved contract through their own presentation adapters.

Character creation is intentionally a different module. The Builder coordinates provenance, eligible choices, reconciliation, draft persistence, destructive-change preview, and commit. The Sheet handles play-state commands. Both consume shared authored content and engine output, but neither is forced through the node-map authoring renderer. See [docs/architecture/character.md](docs/architecture/character.md) and [docs/adr/0006-character-builder-sheet-boundary.md](docs/adr/0006-character-builder-sheet-boundary.md).

## Common commands

```text
yarn dev
yarn turbo:typecheck:web
yarn turbo:affected:typecheck
yarn turbo:test:authoring
yarn workspace @artificer-toolkit/web test:forms
yarn workspace @artificer-toolkit/web test:authoring
yarn storybook:web
yarn workspace @artificer-toolkit/apis codegen:convex
yarn workspace @artificer-toolkit/apis typecheck:convex
yarn workspace @artificer-toolkit/apis test:convex
yarn workspace @artificer-toolkit/apis seed:srd:convex:local
yarn workspace @artificer-toolkit/apis audit:srd:convex:local
yarn validate:pre-staging:local
```

Use the focused command documented by the owning workspace before running a broad build or test suite. Native integration commands target the selected local Convex deployment. Use the guarded generation, seed and audit commands documented by `apps/apis`; staging and production promotion remain explicit release actions.

Turbo's general `typecheck` task builds workspace dependencies first because package exports read
their generated `dist` declarations. Keep that dependency when changing validation tasks; parallel
typechecks against stale declarations can report missing exports that already exist in source.
Keep product workspace dependencies in their owning workspaces, rather than the root tooling
manifest: Turbo includes root workspace dependencies and their transitive sources in every task's
global hash. Root scripts select workspaces through `yarn workspace` or Turbo filters.

## Finding the right seam

- Need a new authored field or group? Start with the [Authoring Schema guide](docs/architecture/authoring-schema.md), `packages/shared`, `packages/schema`, and the owning workspace README.
- Need a new persistence write or hydration path? Start with [docs/architecture/persistence.md](docs/architecture/persistence.md), `apps/apis/convex`, and the shared contract in `packages/schema`.
- Need a new product-data procedure? Start with [docs/architecture/transport.md](docs/architecture/transport.md), `apps/apis/convex`, and the owning adapter in `apps/web/src/data`.
- Need a character Builder or Sheet behavior? Start with [docs/architecture/character.md](docs/architecture/character.md), then the character module landing page.
- Need a rules calculation? Start with [docs/architecture/rules-runtime.md](docs/architecture/rules-runtime.md); assemble typed facts and execute the installed System through the native Kernel.
- Need live-session coordination? Start with [docs/architecture/live-sessions.md](docs/architecture/live-sessions.md), `apps/session-worker`, and `apps/apis/convex/liveSessions`.
