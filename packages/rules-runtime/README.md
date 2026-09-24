# Rules Runtime

`@artificer-toolkit/rules-runtime` owns the schema-aware execution wrapper around the
single TypeScript Rules Kernel in `@artificer-toolkit/shared/rules`. Its root export
provides `createRulesRuntimeService`, the source/service contracts, and runtime errors.

Focused subpaths also own the installed D&D System compilers, policies and operation
implementations. `platformRulesRuntime` supplies the installed capabilities/operations,
exact-System lookup, Creature fact compilation and generic runtime creation. The existing
UUID v5 library preserves deterministic compiler identities; no mechanics are duplicated.
Server-only action entry points, initiative inputs and optional-combat policy facts live
in schema contracts, never in repository types. Definition family identities likewise
come from the focused schema identity module, not the authoring publisher.
The Encounter actor cap comes from `schema/shared/authoredLimits`, not the Encounter API
projection module; a scalar policy bound must not initialize the Sheet command/response graph.

It validates current published definitions and frozen graphs, executes or resumes the
shared Kernel, and seals continuations with native Web Crypto HMAC-SHA256. Seals retain
the canonical rules-document UTF-8 bytes and lowercase 64-character hexadecimal format.
The synchronous constructor defensively copies an externally supplied key of at least
32 bytes; cryptographic work is awaited during execution/resume, never cached globally.

The calling backend (including Convex) and its store own authentication, authorized
source reads, integrity-key provisioning, transactions, state application, persistence,
and replay. This package owns neither a state store nor a second engine. Native Convex
Encounter commands compose the authenticated current `definitionStore`, native Web Crypto
continuation key, atomic pending snapshots, and complete/resume/replay through the domain
boundary. Current focused subpaths provide installed D&D Character and Encounter policies, initiative and
optional-combat validation, active-effect execution, occurrence handling, movement, projections,
Builder/Sheet composition, and deterministic replay helpers. Backends provide trusted current sources,
authority, timestamps and transaction storage; this package remains persistence-independent.

Use `yarn workspace @artificer-toolkit/rules-runtime test` and
`yarn workspace @artificer-toolkit/rules-runtime typecheck` for focused changes. See the
[canonical Rules Runtime guide](../../docs/architecture/rules-runtime.md) for contracts and ownership.
