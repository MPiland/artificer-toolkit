# Encounter Persistence

`@artificer-toolkit/encounter-persistence` owns the Encounter code that reads and writes live
Encounter state through a document store rather than through Convex directly, so the Session room
can run the same code against its own store ([ADR 0035](../../docs/adr/0035-room-authoritative-live-encounters.md)).

- `store` defines `EncounterStore`: the subset of Convex's transaction database handle the
  Encounter code uses (`get`, `query().withIndex()` with `collect`, `take`, `first`, `unique`,
  `order` and async iteration, `insert`, `patch`, `replace`, `delete`), over the same table and
  index names. The Convex adapter is `ctx.db` itself; there is no wrapper.
- `storeTables` lists the store's tables with their stored schemas (from `packages/schema`) and
  indexes. Any drift from the Convex schema is a compile error wherever `ctx.db` is passed as the
  store.
- `memoryEncounterStore` is the in-memory reference store with Convex's read and write semantics.
  The conformance suite in `apps/apis` checks Convex against it.

The package imports only the `IndexRange` type from `convex`, which lets Convex's handle satisfy
the interface without a cast. It uses no Convex database runtime.

Callers own authentication, authorization and every other guard; functions here receive what the
guards resolved. See the [persistence guide](../../docs/architecture/persistence.md#encounter-persistence-package).

Use `yarn workspace @artificer-toolkit/encounter-persistence typecheck` and `... test` for focused
changes. Build the package before Convex tests or codegen; they import its `dist` output.
