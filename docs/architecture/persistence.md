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

`user_roll_history` stores the latest 20 private roll records per user, including the character label and ruleset snapshot needed to interpret old evidence after source changes. Inserts and trimming share a transaction and user-scoped advisory lock. A hit-die roll is marked consumed atomically with the completed rest so its evidence cannot be replayed; it remains visible in history. RLS permits authenticated users to read only their own rows; application writes remain service-owned.

Repository contracts expose authored-shaped operations: `findById`, `findByIds`, `findAll`, and `upsert`. Equipment and race repositories additionally expose resolved reads. `createAuthoredContentRepository` owns cross-domain active metadata, JSON draft storage, and timestamp-conflict locking while each domain repository remains responsible for hydrating and writing its aggregate. A repository may issue many SQL statements, but callers receive one domain aggregate and never raw Kysely builders.

`createAccountProfileRepository` exposes the signed-in account's optional username, name, and bio. Every auth-user insert creates its private profile immediately, including Dashboard invitations; the migration backfills any pre-existing auth user without one. A username, when set, is display-cased and 3–30 characters. Validation, moderation, and uniqueness compare usernames case-insensitively; `profiles_username_key` is a unique `lower(username)` index and permits multiple nulls. Account creation, invitation completion, and sign-in do not require a username. Profile SELECT, INSERT, and UPDATE policies require `auth.uid() = profiles.id`; profile rows are not a public directory. Hard-deleting `auth.users` cascades through the profile, owned authored content, classes, drafts, characters, and current Sheet state. Sheet actor foreign keys also cascade under the current invariant that users edit only their own Sheet state; shared Campaign editing must revisit that audit-retention rule before it ships.

Hydration loads the root and related rows, reorders dependent collections where necessary, and reconstructs authored intent/provenance. Keep DTO validation at the API seam; keep row mapping and authored hydration in DB.

Effect outcomes with dedicated relational query needs retain dedicated tables. Closed resolver rules, manual exceptions, and the other non-damage/non-condition outcomes use the generic JSON outcome row and are validated back into the shared authored union during hydration. This is the existing persistence seam for new values of a closed discriminant; a new payload field still requires explicit schema, hydration, copy, and compiler coverage.

Base equipment may omit weight when the SRD supplies no standalone weight, such as an item that appears only inside an equipment pack. Equipment variants still require their parent-derived weight. Repositories preserve the omission as `undefined`; they must not invent a zero-pound value.

Vehicles preserve SRD table weights independently from cost, and `vehicles.speed` is numeric rather than integer so fractional miles-per-hour values such as the rowboat's 1½ mph and warship's 2½ mph survive persistence and hydration.

Line width reuses the existing characteristic-dimension rows with `WIDTH`; it does not require a parallel shape table. Spell grants persist their optional six-value casting ability in `spell_grants.casting_ability_code` and validate it again during hydration.

Creature spell references use the same feature-to-spell-grant rows as every other authored feature. Persistence does not duplicate class spellcasting tables or add creature-only spell rows.

Authored charges use one relational aggregate for both owned pools and nested source consumption. Owned pools persist their reset and limit payload normally. A nested `SOURCE_CHARGES` record persists a positive integer `charge_limits.cost`, keeps `charges.reset_kind` null, and must not persist bonuses or scaling levels. Repositories permit that discriminator only while hydrating features and charge-capable grants; root authored subjects continue to hydrate owned pools only. Compilers preserve source consumption symbolically and never materialize it as a second runtime resource. For active equipment features, the engine binds that symbolic use to the parent equipment charge and exact owned item instance; the Sheet action spends the authored cost from that `ITEM_INSTANCE` resource. Source-charged grant categories without a current play action remain symbolic until their owning Sheet projection provides a consumer.

Ordered authored collections must persist their source order explicitly. For example, `creature_speeds.sort_order` preserves the authored `speeds` array, while spell-grant spell links preserve root and per-level `spellIds`; repositories must not rely on physical row order or vocabulary IDs to reconstruct them.

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

For authored roots, normalized domain rows are canonical active content. `authored_drafts` stores complete JSON drafts separately; readable draft detail validates that payload while active detail hydrates the domain aggregate. Activation locks the draft, rejects a stale `base_active_updated_at`, replaces the active aggregate, and deletes the draft inside one transaction. Seed/source data follows the typed aggregate upsert path without creating parallel definition or revision records. Baseline synchronization is authoritative only for master roots in the target system: stale masters and their route identities are pruned transactionally, while owned records and other systems are untouched.

The committed SRD semantic ledger has exactly one entry per seeded root. It records the reviewed text/PDF source location, tracked-source hashes, canonical authored-data hash, prose/mechanics status, and exact manual-exception IDs. `yarn audit:srd` rejects missing, duplicate, unmatched, or stale entries before auditing the persisted corpus. There is intentionally no checked-in auto-update command: changed SRD or authored data requires a new human semantic review before the ledger hash is replaced.

Creation of a previously unseen owned root consumes the account's fixed UTC creation windows in the same transaction as its first draft: at most 25 per minute and 100 per hour across all eight domains. The minute window permits one maximum-size import batch without bypassing the shared limiter. The private authored-content creation-rate row is locked before increment, has RLS enabled with no client policies or grants, and is not deleted when an authored root is deleted. Existing-root saves and other lifecycle mutations do not consume it, and there is no lifetime authored-record quota.

## Concurrency and ownership

Character commit locks the active row, checks the draft’s `baseActiveUpdatedAt` (and/or expected stream version), then upserts and increments the stream version. Conflicts become a tRPC `CONFLICT`. Sheet adjustment/preference tables enforce owner/admin access through character-owner RLS and participate in the existing versioned command/event transaction. Master/seed records are protected by ownership/status checks in services and repositories; copies become user-owned drafts.

Copying an authored root regenerates the root ID and every nested owned entity identity, then rewrites references that point to those owned identities before the copy is saved as a draft. External vocabulary and authored-root references remain unchanged. Identity is scoped by the persisted entity type: different nested types may reuse the same replacement UUID text without sharing a row, ownership, or mutable object. Source and copy have independent active aggregates and drafts, so editing either cannot mutate the other. The SRD integration gate applies the ownership invariant path-for-path to the full corpus and rejects retained source identities, inconsistent internal remaps, cross-clone identity collisions, stale source references, shared mutable object structure, or persistence/hydration loss.

## Import identity

`authored_import_refs` stores exact user-scoped source identities for authored roots and characters. Its unique user/source/subject-kind/external-ID key prevents ambiguous matches without adding provider-specific columns to domain tables. Imports may match native owned IDs, exact external mappings, or exact seeded provenance; labels are display fallbacks only.

SQL remains the schema source of truth; generated types must be refreshed after migrations.
