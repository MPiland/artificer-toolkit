/* sql-formatter-disable */
\set QUIET 1
SET client_min_messages TO error;

\set ON_ERROR_STOP on
/* sql-formatter-enable */

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

/***************************
* System (Master)
***************************/
/* sql-formatter-disable */
\set system_jsonfile `powershell -NoProfile -Command "Get-Content 'c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/sql/source_data/Systems.json' -Raw -Encoding UTF8"`
/* sql-formatter-enable */

DROP TABLE IF EXISTS tmp_system_json;

CREATE TEMP TABLE tmp_system_json (data jsonb);

INSERT INTO tmp_system_json (data)
VALUES (:'system_jsonfile'::jsonb);

DO $$
DECLARE r jsonb;
BEGIN
  FOR r IN
    SELECT elem
    FROM tmp_system_json
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(data, jsonb_build_array(data))) AS elem
    WHERE jsonb_typeof(elem) = 'object'
  LOOP
    PERFORM public.upsert_systems(r);
  END LOOP;
END $$;

/***************************
* Races
***************************/
/* sql-formatter-disable */
\set races_jsonfile `powershell -NoProfile -Command "Get-Content 'c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/sql/source_data/Races.json' -Raw -Encoding UTF8"`
/* sql-formatter-enable */
-- Stage JSON
DROP TABLE IF EXISTS tmp_races_json;

CREATE TEMP TABLE tmp_races_json (data jsonb);

INSERT INTO
  tmp_races_json (data)
VALUES
  (:'races_jsonfile'::jsonb);

DROP TABLE IF EXISTS tmp_races_flat;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT elem AS obj
    FROM tmp_races_json
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(data, jsonb_build_array(data))) AS elem
    WHERE jsonb_typeof(elem) = 'object'
  LOOP
    PERFORM public.upsert_races(r.obj);
  END LOOP;
END $$;

/***************************
* Equipment
***************************/
/* sql-formatter-disable */
\set equip_jsonfile `powershell -NoProfile -Command "Get-Content 'c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/sql/source_data/Equipments.json' -Raw -Encoding UTF8"`
/* sql-formatter-enable */
DROP TABLE IF EXISTS tmp_equip_json;

CREATE TEMP TABLE tmp_equip_json (data jsonb);

INSERT INTO
  tmp_equip_json (data)
VALUES
  (:'equip_jsonfile'::jsonb);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT elem AS obj
    FROM tmp_equip_json
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(data, jsonb_build_array(data))) AS elem
    WHERE jsonb_typeof(elem) = 'object'
  LOOP
    PERFORM public.upsert_equipment(r.obj);
  END LOOP;
END $$;

/***************************
* Feats
***************************/
/* sql-formatter-disable */
\set jsonfile `powershell -NoProfile -Command "Get-Content 'c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/sql/source_data/Feats.json' -Raw -Encoding UTF8"`
/* sql-formatter-enable */
DROP TABLE IF EXISTS tmp_feats_json;

CREATE TEMP TABLE tmp_feats_json (data jsonb);

INSERT INTO
  tmp_feats_json (data)
VALUES
  (:'jsonfile'::jsonb);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT elem AS obj
    FROM tmp_feats_json
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(data, jsonb_build_array(data))) AS elem
    WHERE jsonb_typeof(elem) = 'object'
  LOOP
    PERFORM public.upsert_feats(r.obj);
  END LOOP;
END $$;

/***************************
* Classes
***************************/
/* sql-formatter-disable */
\set class_jsonfile `powershell -NoProfile -Command "Get-Content 'C:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/sql/source_data/Classes.json' -Raw -Encoding UTF8"`
/* sql-formatter-enable */
DROP TABLE IF EXISTS tmp_classes_json;

CREATE TEMP TABLE tmp_classes_json (data jsonb);

INSERT INTO
  tmp_classes_json (data)
VALUES
  (:'class_jsonfile'::jsonb);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT elem AS obj
    FROM tmp_classes_json
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(data, jsonb_build_array(data))) AS elem
    WHERE jsonb_typeof(elem) = 'object'
  LOOP
    PERFORM public.upsert_classes(r.obj);
  END LOOP;
END $$;

/***************************
* Spells
***************************/
/* sql-formatter-disable */
\set jsonfile `powershell -NoProfile -Command "Get-Content 'c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/sql/source_data/Spells.json' -Raw -Encoding UTF8"`
/* sql-formatter-enable */
DROP TABLE IF EXISTS tmp_spells_json;

CREATE TEMP TABLE tmp_spells_json (data jsonb);

INSERT INTO
  tmp_spells_json (data)
VALUES
  (:'jsonfile'::jsonb);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT elem AS obj
    FROM tmp_spells_json
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(data, jsonb_build_array(data))) AS elem
    WHERE jsonb_typeof(elem) = 'object'
  LOOP
    PERFORM public.upsert_spells(r.obj);
  END LOOP;
END $$;

/***************************
* Backgrounds
***************************/
/* sql-formatter-disable */
\set jsonfile `powershell -NoProfile -Command "Get-Content 'c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/sql/source_data/Backgrounds.json' -Raw -Encoding UTF8"`
/* sql-formatter-enable */
DROP TABLE IF EXISTS tmp_backgrounds_json;

CREATE TEMP TABLE tmp_backgrounds_json (data jsonb);

INSERT INTO
  tmp_backgrounds_json (data)
VALUES
  (:'jsonfile'::jsonb);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT elem AS obj
    FROM tmp_backgrounds_json
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(data, jsonb_build_array(data))) AS elem
    WHERE jsonb_typeof(elem) = 'object'
  LOOP
    PERFORM public.upsert_backgrounds(r.obj);
  END LOOP;
END $$;

COMMIT;