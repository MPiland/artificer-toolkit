# Authoring Schema resolver

Persistence-independent form resolution and normalization, extracted from the existing server
implementation. Depends on `schema` and `shared`; no database, framework, or session authentication.

Import `@artificer-toolkit/authoring/nodeRuntime`. Supply a `NodeRuntimeSourceReader` to
`resolveNodeRuntime` or `normalizeNodeRuntimeValues`. The reader receives only validated source
keys/columns and must enforce its own System/content access boundary. Missing sources must throw,
not masquerade as an empty option list.

Convex owns authentication and source reads in `apps/apis/convex/authoring`. Node maps live in
`packages/shared`; DTOs live in `packages/schema`. The resolver has no compatibility adapter.

Source hydration imports `@artificer-toolkit/authoring/nodeRuntime/authoredSourceFacts` for
`authoredSourceFacts` and `authoredSourceKindsByTable`. That focused path preserves the same exports
without initializing authoring node maps or the form resolver.

## Reusable definitions

`@artificer-toolkit/authoring/reusableDefinitions` publishes validated reusable definitions through
a caller-provided store. It depends only on `schema` and `shared`; it validates the supplied root
ownership, while the trusted native store owns authentication, transactions, locking, and persistence.

Build: `yarn workspace @artificer-toolkit/authoring build`.
Ownership and current migration limits: [authoring guide](../../docs/architecture/authoring-schema.md).
