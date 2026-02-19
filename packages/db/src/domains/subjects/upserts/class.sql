/* ──────────────────────────────────────────────
 * UPSERT: CLASS
 *
 * Idempotence:
 *   - Root: UPSERT by id
 *   - Children: stale-only deletes + loops
 *   - Bridges: ON CONFLICT updates sort_order
 *   - Owned FK: starting_equipment_id uses owned cleanup triggers
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_class (
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_category text := json_data ->> 'category';
  v_child_id uuid;
  v_starting_equipment_id uuid;
  v_spellcasting_id uuid;
  v_multiclass_id uuid;
  v_resource_id uuid;
  obj jsonb;
  ord integer;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* ─────────────────────────────
   * startingEquipment (owned, BASE only)
   * ───────────────────────────── */

  IF v_category = 'BASE' AND json_data ? 'startingEquipment' AND (json_data -> 'startingEquipment') IS NOT NULL THEN
    v_starting_equipment_id :=
      public.upsert_starting_equipment(json_data -> 'startingEquipment', p_system_id);
  ELSE
    v_starting_equipment_id := NULL;
  END IF;

  /* ─────────────────────────────
   * ROOT
   * ───────────────────────────── */

  INSERT INTO public.classes (
    id,
    system_id,
    user_id,
    category,
    parent_class_id,
    label,
    description,
    starting_equipment_id
  )
  VALUES (
    v_id,
    p_system_id,
    (json_data ->> 'userId')::uuid,
    v_category,
    NULLIF(json_data ->> 'parentClassId','')::uuid,
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    v_starting_equipment_id
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id             = excluded.system_id,
    user_id               = excluded.user_id,
    category              = excluded.category,
    parent_class_id       = excluded.parent_class_id,
    label                 = excluded.label,
    description           = excluded.description,
    starting_equipment_id = excluded.starting_equipment_id;

  /* ─────────────────────────────
   * TRAITS (authoritative array)
   * ───────────────────────────── */

  DELETE FROM public.class_traits ct
  WHERE ct.class_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(json_data -> 'traits','[]'::jsonb)) t(x)
      WHERE t.x = ct.trait_code
    );

  INSERT INTO public.class_traits (class_id, trait_code, sort_order)
  SELECT v_id, x, ord
  FROM jsonb_array_elements_text(COALESCE(json_data -> 'traits','[]'::jsonb))
  WITH ORDINALITY AS t(x, ord)
  ON CONFLICT (class_id, trait_code) DO UPDATE
  SET sort_order = excluded.sort_order;

  /* ─────────────────────────────
   * DETAILS (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.class_details cd
  WHERE cd.class_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'details','[]'::jsonb)) d(x)
      WHERE (d.x ->> 'id')::uuid = cd.detail_id
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'details','[]'::jsonb))
    WITH ORDINALITY AS d(x, ord)
  LOOP
    v_child_id := public.upsert_detail(obj, p_system_id);

    INSERT INTO public.class_details (class_id, detail_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (class_id, detail_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * PROFICIENCIES (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.class_proficiency_grants cpg
  WHERE cpg.class_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'proficiencies','[]'::jsonb)) p(x)
      WHERE (p.x ->> 'id')::uuid = cpg.proficiency_grant_id
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'proficiencies','[]'::jsonb))
    WITH ORDINALITY AS p(x, ord)
  LOOP
    v_child_id := public.upsert_proficiency_grant(obj, p_system_id);

    INSERT INTO public.class_proficiency_grants (class_id, proficiency_grant_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (class_id, proficiency_grant_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * FEATURES (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.class_features cf
  WHERE cf.class_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'features','[]'::jsonb)) f(x)
      WHERE (f.x ->> 'id')::uuid = cf.feature_id
    );

  FOR obj, ord IN
    SELECT x, ord
    FROM jsonb_array_elements(COALESCE(json_data -> 'features','[]'::jsonb))
    WITH ORDINALITY AS f(x, ord)
  LOOP
    v_child_id := public.upsert_feature(obj, p_system_id);

    INSERT INTO public.class_features (class_id, feature_id, sort_order)
    VALUES (v_id, v_child_id, ord)
    ON CONFLICT (class_id, feature_id) DO UPDATE
    SET sort_order = excluded.sort_order;
  END LOOP;

  /* ─────────────────────────────
   * BASE-ONLY: hitpoint, startingGold, spellcasting, multiclass, resources
   * ───────────────────────────── */

  IF v_category = 'BASE' THEN

    /* hitpoint */
    IF json_data ? 'hitpoint' THEN
      INSERT INTO public.class_hitpoints (class_id, ability_code, die_config)
      VALUES (
        v_id,
        json_data #>> '{hitpoint,ability}',
        json_data #>> '{hitpoint,dieConfig}'
      )
      ON CONFLICT (class_id) DO UPDATE SET
        ability_code = excluded.ability_code,
        die_config   = excluded.die_config;
    ELSE
      DELETE FROM public.class_hitpoints WHERE class_id = v_id;
    END IF;

    /* startingGold */
    IF json_data ? 'startingGold' THEN
      INSERT INTO public.class_starting_gold (class_id, multiplier, currency_id, die_config)
      VALUES (
        v_id,
        (json_data #>> '{startingGold,multiplier}')::int,
        (json_data #>> '{startingGold,currencyId}')::uuid,
        json_data #>> '{startingGold,dieConfig}'
      )
      ON CONFLICT (class_id) DO UPDATE SET
        multiplier  = excluded.multiplier,
        currency_id = excluded.currency_id,
        die_config  = excluded.die_config;
    ELSE
      DELETE FROM public.class_starting_gold WHERE class_id = v_id;
    END IF;

    /* resources (owned + owned charges) */
    IF json_data ? 'resources' AND (json_data -> 'resources') IS NOT NULL THEN
      v_child_id := public.upsert_charge(json_data #> '{resources,charges}', p_system_id);

      INSERT INTO public.class_resources (id, class_id, label, description, level_available, charge_id)
      VALUES (
        COALESCE(NULLIF(json_data #>> '{resources,id}','')::uuid, gen_random_uuid()),
        v_id,
        json_data #>> '{resources,label}',
        NULLIF(json_data #>> '{resources,description}',''),
        (json_data #>> '{resources,levelAvailable}')::int,
        v_child_id
      )
      ON CONFLICT (class_id) DO UPDATE SET
        label          = excluded.label,
        description    = excluded.description,
        level_available= excluded.level_available,
        charge_id      = excluded.charge_id;

    ELSE
      DELETE FROM public.class_resources WHERE class_id = v_id;
    END IF;

    /* spellcasting subtree */
    IF json_data ? 'spellcasting' AND (json_data -> 'spellcasting') IS NOT NULL THEN
      v_spellcasting_id :=
        COALESCE(
          (SELECT id FROM public.class_spellcasting WHERE class_id = v_id),
          gen_random_uuid()
        );

      /* spellcasting charges optional */
      IF (json_data #> '{spellcasting,charges}') IS NOT NULL THEN
        v_child_id := public.upsert_charge(json_data #> '{spellcasting,charges}', p_system_id);
      ELSE
        v_child_id := NULL;
      END IF;

      INSERT INTO public.class_spellcasting (id, class_id, magic_name, ability_code, max_spell_level, charge_id)
      VALUES (
        v_spellcasting_id,
        v_id,
        NULLIF(json_data #>> '{spellcasting,magicName}',''),
        NULLIF(json_data #>> '{spellcasting,ability}',''),
        (json_data #>> '{spellcasting,maxSpellLevel}')::int,
        v_child_id
      )
      ON CONFLICT (class_id) DO UPDATE SET
        magic_name     = excluded.magic_name,
        ability_code   = excluded.ability_code,
        max_spell_level= excluded.max_spell_level,
        charge_id      = excluded.charge_id;

      /* spellcasting traits (codes) */
      DELETE FROM public.class_spellcasting_traits sct
      WHERE sct.spellcasting_id = v_spellcasting_id
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(json_data #> '{spellcasting,traits}','[]'::jsonb)) t(x)
          WHERE t.x = sct.trait_code
        );

      INSERT INTO public.class_spellcasting_traits (spellcasting_id, trait_code, sort_order)
      SELECT v_spellcasting_id, x, ord
      FROM jsonb_array_elements_text(COALESCE(json_data #> '{spellcasting,traits}','[]'::jsonb))
      WITH ORDINALITY AS t(x, ord)
      ON CONFLICT (spellcasting_id, trait_code) DO UPDATE
      SET sort_order = excluded.sort_order;

      /* prepareLimit (optional) */
      IF json_data #> '{spellcasting,prepareLimit}' IS NOT NULL THEN
        INSERT INTO public.class_spellcasting_prepare_limit (spellcasting_id, scaling, rounding)
        VALUES (
          v_spellcasting_id,
          NULLIF(json_data #>> '{spellcasting,prepareLimit,scaling}',''),
          NULLIF(json_data #>> '{spellcasting,prepareLimit,rounding}','')
        )
        ON CONFLICT (spellcasting_id) DO UPDATE SET
          scaling  = excluded.scaling,
          rounding = excluded.rounding;

        /* methods (authoritative array) */
        DELETE FROM public.class_spellcasting_prepare_limit_methods m
        WHERE m.spellcasting_id = v_spellcasting_id
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(json_data #> '{spellcasting,prepareLimit,methods}','[]'::jsonb)) t(x)
            WHERE t.x = m.method_code
          );

        INSERT INTO public.class_spellcasting_prepare_limit_methods (spellcasting_id, method_code, sort_order)
        SELECT v_spellcasting_id, x, ord
        FROM jsonb_array_elements_text(COALESCE(json_data #> '{spellcasting,prepareLimit,methods}','[]'::jsonb))
        WITH ORDINALITY AS t(x, ord)
        ON CONFLICT (spellcasting_id, method_code) DO UPDATE
        SET sort_order = excluded.sort_order;

      ELSE
        DELETE FROM public.class_spellcasting_prepare_limit_methods WHERE spellcasting_id = v_spellcasting_id;
        DELETE FROM public.class_spellcasting_prepare_limit WHERE spellcasting_id = v_spellcasting_id;
      END IF;

      /* spellLimits + slots (owned subtree) */
      DELETE FROM public.class_spell_slots css
      WHERE css.spell_limit_id IN (
        SELECT id FROM public.class_spell_limits WHERE spellcasting_id = v_spellcasting_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(json_data #> '{spellcasting,spellLimits}','[]'::jsonb)) sl(x)
        JOIN jsonb_array_elements(COALESCE(sl.x -> 'slots','[]'::jsonb)) s(y) ON true
        WHERE (sl.x ->> 'classLevel')::int = (
          SELECT l.class_level FROM public.class_spell_limits l WHERE l.id = css.spell_limit_id
        )
        AND (s.y ->> 'spellLevel')::int = css.spell_level
      );

      DELETE FROM public.class_spell_limits l
      WHERE l.spellcasting_id = v_spellcasting_id
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(json_data #> '{spellcasting,spellLimits}','[]'::jsonb)) sl(x)
          WHERE (sl.x ->> 'classLevel')::int = l.class_level
        );

      FOR obj IN
        SELECT x
        FROM jsonb_array_elements(COALESCE(json_data #> '{spellcasting,spellLimits}','[]'::jsonb)) sl(x)
      LOOP
        /* upsert limit row keyed by (spellcasting_id, class_level) */
        INSERT INTO public.class_spell_limits (
          id,
          spellcasting_id,
          class_level,
          learned_spells_limit,
          prepared_spells_limit,
          cantrips_limit
        )
        VALUES (
          gen_random_uuid(),
          v_spellcasting_id,
          (obj ->> 'classLevel')::int,
          NULLIF(obj ->> 'learnedSpellsLimit','')::int,
          NULLIF(obj ->> 'preparedSpellsLimit','')::int,
          NULLIF(obj ->> 'cantripsLimit','')::int
        )
        ON CONFLICT (spellcasting_id, class_level) DO UPDATE SET
          learned_spells_limit  = excluded.learned_spells_limit,
          prepared_spells_limit = excluded.prepared_spells_limit,
          cantrips_limit        = excluded.cantrips_limit;

        /* slots */
        INSERT INTO public.class_spell_slots (spell_limit_id, spell_level, slot_count)
        SELECT
          l.id,
          (s ->> 'spellLevel')::int,
          (s ->> 'slotCount')::int
        FROM public.class_spell_limits l
        JOIN jsonb_array_elements(COALESCE(obj -> 'slots','[]'::jsonb)) s ON true
        WHERE l.spellcasting_id = v_spellcasting_id
          AND l.class_level = (obj ->> 'classLevel')::int
        ON CONFLICT (spell_limit_id, spell_level) DO UPDATE
        SET slot_count = excluded.slot_count;
      END LOOP;

    ELSE
      /* remove entire subtree */
      DELETE FROM public.class_spellcasting WHERE class_id = v_id;
    END IF;

    /* multiclass subtree */
    IF json_data ? 'multiclass' AND (json_data -> 'multiclass') IS NOT NULL THEN
      v_multiclass_id :=
        COALESCE(
          (SELECT id FROM public.class_multiclass WHERE class_id = v_id),
          gen_random_uuid()
        );

      INSERT INTO public.class_multiclass (id, class_id)
      VALUES (v_multiclass_id, v_id)
      ON CONFLICT (class_id) DO NOTHING;

      /* multiclass proficiencies (owned, ordered) */
      DELETE FROM public.class_multiclass_proficiency_grants mpg
      WHERE mpg.multiclass_id = v_multiclass_id
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(json_data #> '{multiclass,proficiencies}','[]'::jsonb)) p(x)
          WHERE (p.x ->> 'id')::uuid = mpg.proficiency_grant_id
        );

      FOR obj, ord IN
        SELECT x, ord
        FROM jsonb_array_elements(COALESCE(json_data #> '{multiclass,proficiencies}','[]'::jsonb))
        WITH ORDINALITY AS p(x, ord)
      LOOP
        v_child_id := public.upsert_proficiency_grant(obj, p_system_id);

        INSERT INTO public.class_multiclass_proficiency_grants (multiclass_id, proficiency_grant_id, sort_order)
        VALUES (v_multiclass_id, v_child_id, ord)
        ON CONFLICT (multiclass_id, proficiency_grant_id) DO UPDATE
        SET sort_order = excluded.sort_order;
      END LOOP;

      /* requirements tree: replace-by-id + cascade handles structure.
         We keep this simple and deterministic: delete all existing root(s),
         then insert the authored tree (ids are authored, so stable). */

      DELETE FROM public.class_multiclass_requirements
      WHERE multiclass_id = v_multiclass_id;

      /* recursive insert helper */
      PERFORM public.upsert_class_multiclass_requirement(
        json_data #> '{multiclass,requirements}',
        v_multiclass_id,
        NULL
      );

    ELSE
      DELETE FROM public.class_multiclass WHERE class_id = v_id;
    END IF;

  ELSE
    /* ─────────────────────────────
     * SUBCLASS-ONLY: subtypes
     * ───────────────────────────── */

    DELETE FROM public.class_hitpoints WHERE class_id = v_id;
    DELETE FROM public.class_starting_gold WHERE class_id = v_id;
    DELETE FROM public.class_resources WHERE class_id = v_id;
    DELETE FROM public.class_spellcasting WHERE class_id = v_id;
    DELETE FROM public.class_multiclass WHERE class_id = v_id;

    /* subtypes (authoritative) */
    DELETE FROM public.class_subtypes st
    WHERE st.class_id = v_id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(json_data -> 'subtypes','[]'::jsonb)) s(x)
        WHERE (s.x ->> 'id')::uuid = st.id
      );

    FOR obj, ord IN
      SELECT x, ord
      FROM jsonb_array_elements(COALESCE(json_data -> 'subtypes','[]'::jsonb))
      WITH ORDINALITY AS s(x, ord)
    LOOP
      INSERT INTO public.class_subtypes (id, class_id, label, sort_order)
      VALUES (
        (obj ->> 'id')::uuid,
        v_id,
        obj ->> 'label',
        (obj ->> 'order')::int
      )
      ON CONFLICT (id) DO UPDATE SET
        label      = excluded.label,
        sort_order = excluded.sort_order;
    END LOOP;

  END IF;

  RETURN v_id;
END;
$$;


/* ──────────────────────────────────────────────
 * UPSERT: MULTICLASS REQUIREMENT (RECURSIVE)
 *
 * Notes:
 *   - Uses authored ids for determinism.
 *   - Inserts one node, then recurses into children for GROUP.
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_class_multiclass_requirement (
  json_data jsonb,
  p_multiclass_id uuid,
  p_parent_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_type text := json_data ->> 'type';
  child jsonb;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.class_multiclass_requirements (
    id,
    multiclass_id,
    parent_id,
    requirement_type,
    ability_code,
    min,
    logic
  )
  VALUES (
    v_id,
    p_multiclass_id,
    p_parent_id,
    v_type,
    NULLIF(json_data ->> 'ability',''),
    NULLIF(json_data ->> 'min','')::int,
    NULLIF(json_data ->> 'logic','')
  )
  ON CONFLICT (id) DO UPDATE SET
    parent_id        = excluded.parent_id,
    requirement_type = excluded.requirement_type,
    ability_code     = excluded.ability_code,
    min       = excluded.min,
    logic            = excluded.logic;

  IF v_type = 'GROUP' THEN
    FOR child IN
      SELECT x
      FROM jsonb_array_elements(COALESCE(json_data -> 'children','[]'::jsonb)) c(x)
    LOOP
      PERFORM public.upsert_class_multiclass_requirement(child, p_multiclass_id, v_id);
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;
