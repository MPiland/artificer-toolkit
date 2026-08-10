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

`createDb` builds a Postgres Kysely instance from `DATABASE_CONNECTION_STRING` and a bounded `pg` pool. `withUserContext(db, userId, fn)` starts a transaction, sets `request.jwt.claim.sub` with `set_config(..., true)`, and invokes `fn` with the transaction handle. This is how ordinary API calls execute under the caller’s Supabase RLS identity. Campaign procedures instead use explicit service authorization with the top-level server handle so their service-owned transaction commits before Broadcast; direct browser access to those product tables remains revoked.

Do not call repository writes outside the context selected by the API/service layer. A transaction can be passed as `DBLike` (`Kysely<Database> | Transaction<Database>`). Transactional repository operations reuse an incoming transaction and open one only for a top-level Kysely instance.

## Repository boundary

`user_roll_history` stores the latest 20 private roll records per user, including the character label and ruleset snapshot needed to interpret old evidence after source changes. Inserts and trimming share a transaction and user-scoped advisory lock. A hit-die roll is marked consumed atomically with the completed rest so its evidence cannot be replayed; it remains visible in history. RLS permits authenticated users to read only their own rows; application writes remain service-owned.

Repository contracts expose authored-shaped operations: `findById`, `findByIds`, `findAll`, and `upsert`. Equipment and race repositories additionally expose resolved reads. `createAuthoredContentRepository` owns cross-domain active metadata, JSON draft storage, and timestamp-conflict locking while each domain repository remains responsible for hydrating and writing its aggregate. A repository may issue many SQL statements, but callers receive one domain aggregate and never raw Kysely builders.

`createAccountProfileRepository` exposes the signed-in account's username and bio. Username is the one public account name: new accounts require it, account creation claims it, and a user may rename it immediately from Profile. Dashboard invitations temporarily create a private profile with a null username; invitation completion claims the username before marking the account complete, and pending invite sessions cannot use product-data procedures. Usernames preserve display casing and contain 3–30 characters. Validation, moderation, lookup, and uniqueness compare them case-insensitively; `profiles_username_key` is a unique `lower(username)` index, so old names become immediately reusable and concurrent rename races return a conflict. Profile SELECT, INSERT, and UPDATE policies require `auth.uid() = profiles.id`; profile rows are not a public directory. Hard-deleting `auth.users` cascades through the profile, owned authored content, classes, drafts, characters, and current Sheet state only after any owned Campaigns have been transferred or explicitly deleted through reconciliation. Campaign authority and audit use Campaign-owned records rather than widening Character-owner RLS.

## Campaign foundation

`account_entitlements` is a protected account projection with a Free default. Application services lock it while enforcing character, homebrew, media, hosted-Campaign, seat, and public-listing limits; browser code receives only the schema-validated plan, usage, pricing, limits, and capabilities projection.

Campaign lifecycle is normalized across `campaigns`, memberships, invites, ownership transfers, and Character assignments. Database constraints enforce one owner, one membership per user, one assigned Character per Campaign member, and at most one active Campaign assignment per Character. The owner foreign key is restrictive: account deletion must first transfer or explicitly delete owned Campaigns through reconciliation rather than cascading through other users' assignments and party custody. Raw invite secrets never persist; only digests and expiry metadata do. Lifecycle services lock the Campaign and relevant entitlement rows before role, seat, listing, or ownership mutations.

Approved `campaign_content_versions` are immutable schema-validated root snapshots. `campaign_character_content_bindings` uses a composite foreign key so a binding cannot point to a version from another Campaign or subject. The Campaign owner may inspect every submission; players may inspect approved content plus only their own pending or rejected submissions. Departure deletes these bindings before Builder reconciliation; creators retain access through ordinary content ownership.

Inventory custody is first-class through `inventory_owners` for both Characters and Campaigns. Transfers lock both owners deterministically, require expected versions and an idempotency key, clear item equip/attune/container placement on custody change, and write correlated Campaign custody events in the same transaction. A player may mutate only the assigned Character's inventory; direct Campaign-owned inventory mutations remain owner-only, while the transfer policy may authorize a player to target a Campaign or assigned Character owner. The legacy inventory cutover aborts when one item has multiple creature or vehicle placements because the canonical Sheet model permits exactly one placement; those assignments must be reconciled before migration rather than silently discarded. Campaign currency systems have at most five denominations; row locks serialize denomination replacement and conversions reject any non-exact balance.

Campaign adjustments and conditions are separate overlays keyed by Campaign, Character, family, and slot, so GM precedence never overwrites the player's stored Sheet adjustment. Campaign events retain the actor UUID and visibility needed for owner, subject, and table audit projections.

TABLE, PARTY, and DIRECT conversation entries, Campaign notes, sessions, and session sections are durable Postgres history. TABLE admits the active owner and players; PARTY admits active players only and uses player-access cutoffs after leave, removal, or ownership changes. OWNER and USER are recipient-specific invalidation scopes rather than conversation scopes; USER is allowed only for the exact active membership. Chat insertion and newest-500 trimming share a conversation advisory lock. A Session has an immutable Campaign-scoped number, optional scheduled start/end plus IANA timezone, self-owned member RSVP rows, GM-recorded Character attendance, scoped rich-text sections, and identity-only reference pins. Session sections use optimistic versions; `GM_PRIVATE` sections never enter player projections, while shared collaborative sections remain editable after the Session is finished. Reference pins retain only an authorized target identity and fresh display label, so they cannot grant or freeze access to mutable content.

Encounter templates contain enemy definitions only. Template creation persists a Campaign-scoped command ID and fingerprint behind a unique constraint, so identical retries return the existing template while divergent command reuse is rejected even under a concurrent insert race. A Session-bound run snapshots the bounded template enemy set and present Characters, then owns mutable initiative, current turn, round, enemy HP, resources, reminders, and GM notes. Enemy action roll definitions are authored Feature data persisted as validated JSON, copied into the immutable enemy snapshot, and evaluated once inside the versioned Encounter command. Exact roll evidence and an optional charge spend are written in the same transaction; TABLE publication inserts that same evidence into the Campaign conversation without rerolling. Encounter events retain the newest 2,000 entries, and current-actor constraints reject an actor from another Encounter. Actor visibility is part of the event repository query: the TABLE predicate is applied before cursor ordering and page limits.

Campaign product tables enable RLS and revoke direct browser product access. The narrow private Realtime SELECT policy calls a locked-search-path `SECURITY DEFINER` predicate that returns only whether the authenticated user's exact topic is allowed; it does not grant table reads. Topics include the recipient user and membership access-start epoch; fan-out targets only current eligible memberships, so a removed player or promoted owner's cached old channel receives no later PARTY traffic. Broadcast contains committed identifiers only and never stores durable data.

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
