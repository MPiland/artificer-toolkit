/* ──────────────────────────────────────────────
 * UPSERT HELPERS — VOCABULARY (PER TABLE)
 *
 * Idempotence:
 *   - Root: UPSERT by id
 *   - Caller performs stale deletes per surface by id.
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_alignment(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.alignments (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_condition(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.conditions (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_currency(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.currencies (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_damage_type(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.damage_types (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_language(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.languages (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_magic_school(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.magic_schools (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_passive(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.passives (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_rarity(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.rarities (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_sense(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.senses (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_skill(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.skills (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_speed(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.speeds (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_terrain(
  json_data jsonb,
  p_system_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.terrains (id, system_id, code, label, description, tooltip, short)
  VALUES (
    v_id,
    p_system_id,
    json_data ->> 'code',
    json_data ->> 'label',
    NULLIF(json_data ->> 'description',''),
    NULLIF(json_data ->> 'tooltip',''),
    NULLIF(json_data ->> 'short','')
  )
  ON CONFLICT (id) DO UPDATE SET
    system_id    = excluded.system_id,
    code         = excluded.code,
    label        = excluded.label,
    description  = excluded.description,
    tooltip      = excluded.tooltip,
    short        = excluded.short;

  RETURN v_id;
END;
$$;


/* ──────────────────────────────────────────────
 * UPSERT: SYSTEM (ROOT + VOCABULARIES)
 *
 * Idempotence:
 *  - Root: UPSERT by id
 *  - Each vocabulary surface:
 *      stale-delete by authored ids
 *      loop through array and upsert rows
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_system (
  json_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id','')::uuid, gen_random_uuid());
  v_user_id uuid := (json_data ->> 'userId')::uuid;
  obj jsonb;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* root */
  INSERT INTO public.systems (id, user_id, label, description)
  VALUES (
    v_id,
    v_user_id,
    json_data ->> 'label',
    NULLIF(json_data ->> 'description','')
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id      = excluded.user_id,
    label        = excluded.label,
    description  = excluded.description;

  /* ─────────────────────────────
   * alignments
   * ───────────────────────────── */

  DELETE FROM public.alignments a
  WHERE a.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'alignments','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = a.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'alignments','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_alignment(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * conditions
   * ───────────────────────────── */

  DELETE FROM public.conditions c
  WHERE c.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'conditions','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = c.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'conditions','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_condition(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * currencies
   * ───────────────────────────── */

  DELETE FROM public.currencies c
  WHERE c.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'currencies','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = c.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'currencies','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_currency(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * damageTypes
   * ───────────────────────────── */

  DELETE FROM public.damage_types d
  WHERE d.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'damageTypes','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = d.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'damageTypes','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_damage_type(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * languages
   * ───────────────────────────── */

  DELETE FROM public.languages l
  WHERE l.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'languages','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = l.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'languages','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_language(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * magicSchools
   * ───────────────────────────── */

  DELETE FROM public.magic_schools m
  WHERE m.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'magicSchools','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = m.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'magicSchools','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_magic_school(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * passives
   * ───────────────────────────── */

  DELETE FROM public.passives p
  WHERE p.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'passives','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = p.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'passives','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_passive(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * rarities
   * ───────────────────────────── */

  DELETE FROM public.rarities r
  WHERE r.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'rarities','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = r.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'rarities','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_rarity(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * senses
   * ───────────────────────────── */

  DELETE FROM public.senses s
  WHERE s.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'senses','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = s.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'senses','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_sense(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * skills
   * ───────────────────────────── */

  DELETE FROM public.skills s
  WHERE s.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'skills','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = s.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'skills','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_skill(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * speeds
   * ───────────────────────────── */

  DELETE FROM public.speeds s
  WHERE s.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'speeds','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = s.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'speeds','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_speed(obj, v_id);
  END LOOP;

  /* ─────────────────────────────
   * terrains
   * ───────────────────────────── */

  DELETE FROM public.terrains t
  WHERE t.system_id = v_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(json_data -> 'terrains','[]'::jsonb)) x(obj)
      WHERE (x.obj ->> 'id')::uuid = t.id
    );

  FOR obj IN
    SELECT x FROM jsonb_array_elements(COALESCE(json_data -> 'terrains','[]'::jsonb)) x(x)
  LOOP
    PERFORM public.upsert_terrain(obj, v_id);
  END LOOP;

  RETURN v_id;
END;
$$;
