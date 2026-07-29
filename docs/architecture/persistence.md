# Persistence and Kysely

> Status: canonical (current working-tree baseline)
>
> Scope: Supabase/Postgres schema, Kysely client, repositories, upserts, hydration, and source data
>
> Update when: migrations, table ownership, repository contracts, transaction semantics, or seed data change
>
> Verification: `packages/db/src/client.ts`, `packages/db/src/repositories/contracts.ts`, `packages/db/src/domains/**/upserts`, `packages/db/src/types`, and `supabase/migrations`

SQL migrations define the relational schema and RLS policies. `packages/db` uses Kysely with generated Supabase types (`src/types/supabase.database.ts`) and exposes repositories/query functions so application services do not depend on row layouts.

## Connection and RLS

`createDb` builds a Postgres Kysely instance from `DATABASE_CONNECTION_STRING` and a bounded `pg` pool. `withUserContext(db, userId, fn)` starts a transaction, sets `request.jwt.claim.sub` with `set_config(..., true)`, and invokes `fn` with the transaction handle. This is how API calls execute under the caller’s Supabase RLS identity.

Do not call repository writes outside the context selected by the API/service layer. A transaction can be passed as `DBLike` (`Kysely<Database> | Transaction<Database>`). Transactional repository operations reuse an incoming transaction and open one only for a top-level Kysely instance.

## Repository boundary

Repository contracts expose authored-shaped operations: `findById`, `findByIds`, `findAll`, and `upsert`. Equipment and race repositories additionally expose resolved reads. The authored-definition repository also exposes an access-controlled selected-revision read that resolves UUID or public route identity, definition ownership, the requested active/draft payload, and draft presence in one query. A repository may issue many SQL statements, but callers receive one domain aggregate and never raw Kysely builders.

Hydration loads the root and related rows, reorders dependent collections where necessary, and reconstructs authored intent/provenance. Keep DTO validation at the API seam; keep row mapping and authored hydration in DB.

Ordered authored collections must persist their source order explicitly. For example, `creature_speeds.sort_order` preserves the authored `speeds` array; repositories must not rely on physical row order or vocabulary IDs to reconstruct it.

Character Sheet adjustment intent is stored outside `CharacterAuthored` in closed relational family tables. Each row has a constrained target/value shape, character ownership, optional `source_note`, actor IDs, and timestamps. `source_note` is the only manual adjustment metadata across every family; authored provenance remains derived in calculation breakdowns. Item and companion targets use owned-instance UUIDs; definition-owned repeated sources include their persisted acquisition/source-record identity. `createCharacterSheetAdjustmentRepository` validates hydrated rows through the shared transport schema, supports typed upsert/removal, and owns movement-display preferences. No generic path/value or derived-total table is permitted.

### Character Extras (Branch 05 target)

Creature and vehicle records are character-owned Sheet instances. Hydration returns complete instance state rather than raw rows: immutable authored source identity and name, persisted `customName`/notes/active state, and the current instance-owned play state needed by the Sheet. For creatures, the persisted relationship role is limited to `COMPANION`, `MOUNT`, or `OWNED`; `origin_kind` is a separate constrained `WORLD`/`SUMMONED` column. The migration converts legacy `SUMMONED` roles to `COMPANION` plus `SUMMONED` origin and assigns `WORLD` to every other existing creature row before enforcing the new constraints.

`character_vehicles` persists current HP separately from immutable authored vehicle maximum/operational facts. Database checks reject negative creature current/temporary HP, negative vehicle current HP, and invalid creature hit-die rows (nonpositive die, negative totals/usage, or usage above total). Creature and vehicle equipment assignment rows remain instance-scoped. Sheet lifecycle removal runs in the existing command/event transaction and must remove every instance-scoped child (creature resources, companion adjustments, and creature/vehicle equipment assignments) while retaining the independently owned inventory records and the command/event history. RLS follows character ownership for every new or changed instance-state table; the hit-die table has an explicit deny policy in addition to RLS being enabled. Repositories preserve character-instance isolation during hydration and writes, and authored creature/vehicle source reads are constrained to the requested system plus master or current-user ownership.

Starting-equipment options exclusively own an optional character-eligibility facet through the unique `starting_equipment_options.eligibility_facet_id`. Upsert the facet before its option, hydrate it back into the authored option, and let the option update/delete cleanup triggers remove the prior owned facet. The facet is authored content, not a Builder-only row shape; it cannot be shared between options.

## Upsert and replacement semantics

Aggregate upserts use this sequence:

1. reuse the caller's transaction or open one, and lock the root row when concurrency matters;
2. insert or update the root with `onConflict` (for characters, `stream_version` can be checked/incremented);
3. delete owned child rows for the aggregate;
4. insert the current child collections in dependency order;
5. validate references such as equipment containers and feature-acquisition parents;
6. return from the transaction callback; the outermost owner commits or rolls back.

`upsertCharacter` is the clearest example: it replaces profile, intent, state, inventory, grant selections, spell selections, resources, ability-generation state, and starting-equipment sessions as one aggregate write. Replacement means omitted children are removed; callers must pass the complete authored aggregate, not a patch.

Character hit-point history is normalized in `character_hitpoint_levels`. Its `(character_id, char_level)` order is canonical, while `(character_id, class_id, class_level)` is unique and references the selected character class. The database therefore persists interleaved multiclass progression without reconstructing it from grouped `character_classes.class_level` totals.

The legacy `character_hitpoint_state.max_override` column is deprecated. The Phase 00 migration backfills non-null values idempotently into `character_hitpoint_adjustments`; current repositories hydrate and write maximum overrides only through typed adjustment storage while leaving the legacy column null. Column removal is a later deployment cleanup, not part of the backfill migration.

Chosen grant selections are unique by character, grant, provenance identity, and optional progression level. Acquisition timing and source class level remain metadata and do not create a second answer to the same grant choice. Schema and application preflight checks provide repairable errors, while the `NULLS NOT DISTINCT` database index prevents ambiguous first-record-wins state from being persisted.

For authored roots, the immutable full-payload revision is canonical and normalized domain rows are the active query projection. Readable detail validates the selected canonical revision directly; lists, engine workflows, relational filters, and other projection-oriented reads continue to use normalized rows. Activation replaces the projection and promotes the exact draft revision inside one transaction. Seed/source data follows the same typed authored/upsert path and synchronizes master definitions/revisions with their projections. Baseline synchronization is authoritative only for master roots in the target system: stale masters and their route identities are pruned transactionally, while owned records and other systems are untouched.

## Concurrency and ownership

Character commit locks the active row, checks the draft’s `baseActiveUpdatedAt` (and/or expected stream version), then upserts and increments the stream version. Conflicts become a tRPC `CONFLICT`. Sheet adjustment/preference tables enforce owner/admin access through character-owner RLS and participate in the existing versioned command/event transaction. Master/seed records are protected by ownership/status checks in services and repositories; copies become user-owned drafts.

Copying an authored root regenerates the root ID and every nested owned entity identity, then rewrites references that point to those owned identities before the copy is saved as a draft. External vocabulary and authored-definition references remain unchanged. Identity is scoped by the persisted entity type: different nested types may reuse the same replacement UUID text without sharing a row, ownership, or mutable object. Source and copy have independent definition/revision histories, so revising either payload cannot mutate the other payload or revision identity. The SRD integration gate applies the ownership invariant path-for-path to the full corpus and rejects retained source identities, inconsistent internal remaps, cross-clone identity collisions, stale source references, shared mutable object structure, revision coupling, or persistence/hydration loss.

## Projection recovery (target/manual)

An active projection is conceptually disposable. The repository exposes a typed selected active/draft revision read for product detail, but no projection-rebuild use case. Recovery therefore remains an operator/manual database procedure: read and validate the active revision payload, then run the owning aggregate upsert in a controlled transaction. Do not repair nested projection rows piecemeal.

The remaining target is a typed projection-rebuild service with focused cross-domain tests. SQL remains the schema source of truth; generated types must be refreshed after migrations.
