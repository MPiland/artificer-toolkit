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

`createDb` builds a Postgres Kysely instance from `DATABASE_URL`/`DATABASE_CONNECTION_STRING` and a bounded `pg` pool. `withUserContext(db, userId, fn)` starts a transaction, sets `request.jwt.claim.sub` with `set_config(..., true)`, and invokes `fn` with the transaction handle. This is how API calls execute under the caller’s Supabase RLS identity.

Do not call repository writes outside the context selected by the API/service layer. A transaction can be passed as `DBLike` (`Kysely<Database> | Transaction<Database>`). Transactional repository operations reuse an incoming transaction and open one only for a top-level Kysely instance.

## Repository boundary

Repository contracts expose authored-shaped operations: `findById`, `findByIds`, `findAll`, and `upsert`. Equipment and race repositories additionally expose resolved reads. A repository may issue many SQL statements, but callers receive one domain aggregate and never raw Kysely builders.

Hydration loads the root and related rows, reorders dependent collections where necessary, and reconstructs authored intent/provenance. Keep DTO validation at the API seam; keep row mapping and authored hydration in DB.

Ordered authored collections must persist their source order explicitly. For example, `creature_speeds.sort_order` preserves the authored `speeds` array; repositories must not rely on physical row order or vocabulary IDs to reconstruct it.

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

Chosen grant selections are unique by character, grant, provenance identity, and optional progression level. Acquisition timing and source class level remain metadata and do not create a second answer to the same grant choice. Schema and application preflight checks provide repairable errors, while the `NULLS NOT DISTINCT` database index prevents ambiguous first-record-wins state from being persisted.

For authored roots, the immutable full-payload revision is canonical and normalized domain rows are the active query projection. Activation replaces the projection and promotes the exact draft revision inside one transaction. Seed/source data follows the same typed authored/upsert path and synchronizes master definitions/revisions with their projections. Baseline synchronization is authoritative only for master roots in the target system: stale masters and their route identities are pruned transactionally, while owned records and other systems are untouched.

## Concurrency and ownership

Character commit locks the active row, checks the draft’s `baseActiveUpdatedAt` (and/or expected stream version), then upserts and increments the stream version. Conflicts become a tRPC `CONFLICT`. Master/seed records are protected by ownership/status checks in services and repositories; copies become user-owned drafts.

Copying an authored root regenerates the root ID and every nested owned entity identity, then rewrites references that point to those owned identities before the copy is saved as a draft. External vocabulary and authored-definition references remain unchanged. Identity is scoped by the persisted entity type: different nested types may reuse the same replacement UUID text without sharing a row, ownership, or mutable object. Source and copy have independent definition/revision histories, so revising either payload cannot mutate the other payload or revision identity. The SRD integration gate applies the ownership invariant path-for-path to the full corpus and rejects retained source identities, inconsistent internal remaps, cross-clone identity collisions, stale source references, shared mutable object structure, revision coupling, or persistence/hydration loss.

## Projection recovery (target/manual)

An active projection is conceptually disposable, but the current repository does not expose a typed active/arbitrary-revision payload read or projection-rebuild use case. Until that seam exists, recovery is an operator/manual database procedure: identify and validate the active revision payload, then run the owning aggregate upsert in a controlled transaction. Do not repair nested projection rows piecemeal.

The target is a typed revision read/rebuild service with focused cross-domain tests. SQL remains the schema source of truth; generated types must be refreshed after migrations.
