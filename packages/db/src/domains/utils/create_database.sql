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
\i :etl_root'/subjects/tables/system.sql'
\i :etl_root'/utils/tables/utils.sql'
\i :etl_root'/shared/tables/charge.sql'
\i :etl_root'/shared/tables/detail.sql'
\i :etl_root'/shared/tables/characteristic.sql'
\i :etl_root'/shared/tables/target.sql'
\i :etl_root'/shared/tables/saving_throw.sql'
\i :etl_root'/shared/tables/starting_equipment.sql'
\i :etl_root'/effects/tables/moment/direct.sql'
\i :etl_root'/effects/tables/moment/moment.sql'
\i :etl_root'/effects/tables/moment/roll_table.sql'
\i :etl_root'/effects/tables/condition.sql'
\i :etl_root'/effects/tables/damage.sql'
\i :etl_root'/effects/tables/effect.sql'
\i :etl_root'/effects/tables/invocation.sql'
\i :etl_root'/features/tables/feature.sql'
\i :etl_root'/features/tables/option.sql'
\i :etl_root'/grants/tables/feat.sql'
\i :etl_root'/grants/tables/modifier.sql'
\i :etl_root'/grants/tables/proficiency.sql'
\i :etl_root'/grants/tables/sense.sql'
\i :etl_root'/grants/tables/spell.sql'
\i :etl_root'/subjects/tables/background.sql'
\i :etl_root'/subjects/tables/class.sql'
\i :etl_root'/subjects/tables/equipment.sql'
\i :etl_root'/subjects/tables/feat.sql'
\i :etl_root'/subjects/tables/race.sql'
\i :etl_root'/subjects/tables/spell.sql'

SELECT
  public.apply_updated_at_triggers ();
