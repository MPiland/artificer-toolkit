# Phase 4 Bootstrap Audit

## Summary

The empty-database recreate blocker is not just a bad file order. The current table SQL contains real cross-domain cycles, so a pure reorder of `create_database.sql` is not sufficient.

The repo needs a two-pass bootstrap strategy:

1. create tables without the cross-domain foreign keys that participate in cycles
2. add those foreign keys in a later constraint pass after all root tables exist

## Confirmed Cycle Clusters

### Shared <-> Subjects

- `shared/tables/charges.sql`
  - `charge_limits.class_id -> public.classes`
  - `charge_limits.spell_id -> public.spells`
- `shared/tables/facets.sql`
  - references `classes`, `features`, `spells`, `equipment`, `feats`, `races`, `backgrounds`, `options`, `class_resources`, `race_ancestry_options`
- `shared/tables/starting_equipment.sql`
  - references `equipment`
  - references `currencies`

At the same time:

- `subjects/tables/classes.sql`
  - references `starting_equipment`
  - references `features`
  - references `proficiency_grants`
  - references `charges`
  - references `currencies`
- `subjects/tables/backgrounds.sql`
  - references `starting_equipment`
  - references `features`
  - references `proficiency_grants`
- `subjects/tables/equipment.sql`
  - references `charges`
  - references `facets`
  - references `features`
  - references `modifier_grants`
- `subjects/tables/feats.sql`
  - references `charges`
  - references `facets`
  - references `features`
  - references multiple grant tables
- `subjects/tables/spells.sql`
  - references `effects`
  - references `classes`

### Features / Options <-> Grants / Effects / Shared

- `features/tables/features.sql`
  - references `charges`
  - references `facets`
  - references `effects`
  - references all grant tables
  - references `options`
- `features/tables/options.sql`
  - references `charges`
  - references `facets`
  - references `effects`
  - references all grant tables

### Grants <-> Subjects / Shared

- `grants/tables/feats.sql`
  - references `charges`
  - references `facets`
  - references `feats`
- `grants/tables/spells.sql`
  - references `classes`
  - references `spells`
  - references `charges`
  - references `facets`
- `grants/tables/senses.sql`
  - references `classes`
  - references `spells`
  - references `charges`
  - references `facets`
- `grants/tables/proficiencies.sql`
  - references `equipment`
  - references `skills`
  - references `languages`
- `grants/tables/modifiers.sql`
  - references `classes`
  - references `spells`
  - references `skills`
  - references `speeds`
  - references `damage_types`
  - references `condition_types`
  - references `facets`

## Practical Conclusion

The current schema has at least these circular relationships:

- `charges -> classes/spells` while `classes -> charges`
- `starting_equipment -> equipment` while `classes/backgrounds -> starting_equipment`
- `features/options -> grant tables` while subject roots and grants also point back into features/options/subjects
- `facets -> many root subjects/features/options/resources` while those roots also reference `facets`

That means:

- reordering helps only for the acyclic subset
- reordering alone will not solve the bootstrap end to end
- the durable fix is a dedicated constraint-add pass

## Recommended Next Implementation

1. Split root table creation from cross-domain FK creation.
2. Keep intra-table-tree FKs that are acyclic inside the original files where safe.
3. Move cross-domain FKs into one or more `bootstrap/constraints/*.sql` files.
4. Update `create_database.sql` to run:
   - utility/functions
   - root and child table creation without cyclic FKs
   - deferred constraint pass
   - trigger/index finalization if needed

## Handoff Note

The important handoff decision is already made by the audit:

- do not spend more time trying to fix bootstrap only by reshuffling file order
- treat the bootstrap blocker as a schema-structure issue
- Phase 4 should now implement a two-pass DDL strategy
