-- psql runner for ETL schema setup
-- Abort on first error
\set QUIET 1
SET client_min_messages TO error;

\set ON_ERROR_STOP off
-- Adjust this to the absolute path of your repo
\set etl_root 'c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/sql/etl'
-- Recommended: gen_random_uuid support
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Keep object creation consistent
SET LOCAL search_path = public, pg_catalog;

-- Harmless for DDL; effective only for DEFERRABLE constraints during DML
SET CONSTRAINTS ALL DEFERRED;

-- 1) Shared primitives (types/functions/views used by others)
\i :etl_root'/shared/utils.sql'
\i :etl_root'/systems.sql'
\i :etl_root'/shared/shared.sql'
\i :etl_root'/shared/actions.sql'
\i :etl_root'/shared/charges.sql'
\i :etl_root'/shared/save_DC.sql'
\i :etl_root'/shared/damages.sql'
\i :etl_root'/shared/starting_equipment.sql'
\i :etl_root'/shared/prerequisites.sql'
\i :etl_root'/subfeature_proficiencies.sql'
\i :etl_root'/subfeature_expertise.sql'
\i :etl_root'/subfeature_senses.sql'
\i :etl_root'/subfeature_spells.sql'
\i :etl_root'/subfeature_modifiers.sql'
\i :etl_root'/subfeature_feats.sql'
\i :etl_root'/subfeature_options.sql'
\i :etl_root'/spells.sql'

\i :etl_root'/features.sql'
\i :etl_root'/equipment.sql'

\i :etl_root'/feats.sql'
\i :etl_root'/classes.sql'
\i :etl_root'/races.sql'
\i :etl_root'/spells.sql'
\i :etl_root'/backgrounds.sql'
