-- psql runner for ETL schema setup
-- Abort on first error
\set QUIET 1
SET client_min_messages TO error;

\set ON_ERROR_STOP off
-- Adjust this to the absolute path of your repo
\set etl_root 'c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/domains'
-- Recommended: gen_random_uuid support
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Keep object creation consistent
SET LOCAL search_path = public, pg_catalog;

-- Harmless for DDL; effective only for DEFERRABLE constraints during DML
SET CONSTRAINTS ALL DEFERRED;

-- 1) Shared primitives (types/functions/views used by others)
\i :etl_root'/utils/tables/utils.sql'
\i :etl_root'/utils/tables/user_management.sql'
\i :etl_root'/notifications/tables/notifications.sql'
\i :etl_root'/subjects/tables/systems.sql'
\i :etl_root'/subjects/tables/authored_content.sql'
\i :etl_root'/subjects/tables/character_builder_drafts.sql'
\i :etl_root'/shared/tables/charges.sql'
\i :etl_root'/shared/tables/details.sql'
\i :etl_root'/shared/tables/characteristics.sql'
\i :etl_root'/shared/tables/facets.sql'
\i :etl_root'/shared/tables/saving_throws.sql'
\i :etl_root'/shared/tables/starting_equipment.sql'
\i :etl_root'/effects/tables/effects.sql'
\i :etl_root'/effects/tables/conditions.sql'
\i :etl_root'/effects/tables/damages.sql'
\i :etl_root'/effects/tables/invocations.sql'
\i :etl_root'/effects/tables/paths.sql'
\i :etl_root'/features/tables/features.sql'
\i :etl_root'/features/tables/options.sql'
\i :etl_root'/grants/tables/feats.sql'
\i :etl_root'/grants/tables/modifiers.sql'
\i :etl_root'/grants/tables/proficiencies.sql'
\i :etl_root'/grants/tables/senses.sql'
\i :etl_root'/grants/tables/spells.sql'
\i :etl_root'/subjects/tables/backgrounds.sql'
\i :etl_root'/subjects/tables/classes.sql'
\i :etl_root'/subjects/tables/creatures.sql'
\i :etl_root'/subjects/tables/equipment.sql'
\i :etl_root'/subjects/tables/feats.sql'
\i :etl_root'/subjects/tables/races.sql'
\i :etl_root'/subjects/tables/spells.sql'
\i :etl_root'/subjects/tables/vehicles.sql'
\i :etl_root'/subjects/tables/characters.sql'
\i :etl_root'/subjects/tables/versioned_projections.sql'
\i :etl_root'/subjects/tables/authored_route_ids.sql'
\i :etl_root'/subjects/tables/media.sql'
\i :etl_root'/subjects/tables/user_roll_history.sql'
\i :etl_root'/subjects/tables/character_events.sql'
\i :etl_root'/rules/tables/rule_packs.sql'
\i :etl_root'/campaigns/tables/campaigns.sql'
\i :etl_root'/social/tables/social.sql'
\i :etl_root'/subjects/tables/character_sheet_adjustments.sql'
\i :etl_root'/encounters/tables/encounters.sql'
\i :etl_root'/bootstrap/constraints/cross_domain_foreign_keys.sql'

SELECT
  public.apply_updated_at_triggers ();

\i :etl_root'/bootstrap/security/public_api_access.sql'
