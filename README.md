# Artificer Toolkit

Artificer Toolkit is a creative tabletop RPG authoring workspace and play surface. The current MVP centers on reusable homebrew content, character construction, character sheets, and reference workflows across desktop and mobile; campaign and VTT workflows remain later product phases.

## Start here

- Product intent: [PRODUCT.md](PRODUCT.md)
- Visual system: [DESIGN.md](DESIGN.md)
- Domain vocabulary and invariants: [CONTEXT.md](CONTEXT.md)
- Documentation index and precedence: [docs/README.md](docs/README.md)
- Current architecture: [docs/architecture/overview.md](docs/architecture/overview.md)
- Architecture decisions: [docs/adr/README.md](docs/adr/README.md)
- Agent and contributor rules: [AGENTS.md](AGENTS.md)

When code and prose disagree, use the precedence rules in [docs/README.md](docs/README.md). The architecture documentation describes the current working tree and labels transitional or target behavior explicitly.

## Repository map

| Module               | Owns                                                                                                      | Does not own                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `apps/web`           | TanStack Start UI, Authoring Workspace, character Builder and Sheet surfaces, query/mutation adapters     | Product-data access, persistence, domain rules |
| `apps/apis`          | Thin tRPC transport, authentication-aware procedure composition, request/response mapping                 | Domain logic, persistence, orchestration       |
| `packages/schema`    | Zod-backed transport contracts and DTOs                                                                   | Database rows, application orchestration       |
| `packages/shared`    | Authored contracts, vocabulary, node maps, compilers, character snapshots, pure engine modules            | Request handling, persistence, UI              |
| `packages/functions` | Application orchestration, authoring pipelines, node-runtime orchestration, character Builder/Sheet flows | Transport wiring, UI, SQL schema               |
| `packages/db`        | Kysely client/types, repositories, queries, upserts, source-data import                                   | Product transport, UI, domain orchestration    |
| `supabase`           | Migrations and database bootstrap assets                                                                  | Application write policy                       |

The dependency direction is intentionally one-way: the web crosses the tRPC seam, the API delegates to application orchestration, orchestration uses shared contracts and database adapters, and shared domain modules remain transport-agnostic.

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
yarn test:srd:integration
yarn test:character-sheet:integration
```

Use the focused command documented by the owning workspace before running a broad build or test suite. Integration commands require the local database and refuse remote targets. Database reset and remote seed commands are destructive and require the safeguards described in [supabase/README.md](supabase/README.md).

## Finding the right seam

- Need a new authored field or group? Start with the [Authoring Schema guide](docs/architecture/authoring-schema.md), `packages/shared`, `packages/schema`, and the owning workspace README.
- Need a new database write or hydration path? Start with [docs/architecture/persistence.md](docs/architecture/persistence.md) and `packages/db/README.md`.
- Need a new product-data procedure? Start with [docs/architecture/transport.md](docs/architecture/transport.md) and `apps/apis/README.md`.
- Need a character Builder or Sheet behavior? Start with [docs/architecture/character.md](docs/architecture/character.md), then the character module landing page.
- Need a rules calculation? Start with [docs/architecture/engine.md](docs/architecture/engine.md); keep the engine pure and rules-system-driven.
