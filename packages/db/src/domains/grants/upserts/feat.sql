/* ──────────────────────────────────────────────
 * UPSERT: FEAT GRANT (ROOT)
 *
 * Idempotence:
 *   - Root row: upsert by id
 *   - Child collections: authoritative rebuild (delete then insert)
 *   - Scaling: authoritative rebuild based on current scalingType
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.upsert_feat_grant (
  json_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := COALESCE(NULLIF(json_data ->> 'id', '')::uuid, gen_random_uuid());

  v_selection_type text := json_data ->> 'selectionType';
  v_scaling_type text := json_data ->> 'scalingType';

  v_payload_mode text := COALESCE(
    json_data #>> '{payload,mode}',
    json_data #>> '{value,mode}',              -- tolerate older naming if present
    'ALL'
  );

  v_selection_count integer := NULLIF(json_data #>> '{payload,count}', '')::int;

  v_charge_id uuid;
  v_level_id uuid;
BEGIN
  IF json_data IS NULL THEN
    RETURN NULL;
  END IF;

  /* ─────────────────────────────
   * ROOT
   * ───────────────────────────── */

  INSERT INTO public.feat_grants (
    id,
    sort_order,
    selection_type,
    scaling_type,
    payload_mode,
    selection_count,
    scaling_source,
    class_id,
    spell_id
  )
  VALUES (
    v_id,
    (json_data ->> 'order')::int,
    v_selection_type,
    v_scaling_type,
    v_payload_mode,
    CASE
      WHEN v_selection_type = 'CHOSEN' AND v_scaling_type = 'NONE' THEN v_selection_count
      ELSE NULL
    END,
    NULLIF(json_data #>> '{scaling,scalingSource}', ''),
    NULLIF(json_data #>> '{scaling,classId}', '')::uuid,
    NULLIF(json_data #>> '{scaling,spellId}', '')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    sort_order      = EXCLUDED.sort_order,
    selection_type  = EXCLUDED.selection_type,
    scaling_type    = EXCLUDED.scaling_type,
    payload_mode    = EXCLUDED.payload_mode,
    selection_count = EXCLUDED.selection_count,
    scaling_source  = EXCLUDED.scaling_source,
    class_id        = EXCLUDED.class_id,
    spell_id        = EXCLUDED.spell_id;

  /* ─────────────────────────────
   * TRAITS (codes, ordered)
   * ───────────────────────────── */

  DELETE FROM public.feat_grant_traits
  WHERE feat_grant_id = v_id;

  INSERT INTO public.feat_grant_traits (
    feat_grant_id,
    trait_code,
    sort_order
  )
  SELECT
    v_id,
    (x)::text,
    ord
  FROM jsonb_array_elements_text(
    COALESCE(json_data -> 'traits', '[]'::jsonb)
  ) WITH ORDINALITY AS t(x, ord);

  /* ─────────────────────────────
   * RESTRICTIONS (owned, ordered)
   * ───────────────────────────── */

  DELETE FROM public.feat_grant_restrictions
  WHERE feat_grant_id = v_id;

  INSERT INTO public.feat_grant_restrictions (
    feat_grant_id,
    restriction_id,
    sort_order
  )
  SELECT
    v_id,
    public.upsert_restriction(obj),
    ord
  FROM jsonb_array_elements(
    COALESCE(json_data -> 'restrictions', '[]'::jsonb)
  ) WITH ORDINALITY AS r(obj, ord);

  /* ─────────────────────────────
   * CHARGES (owned, optional 1:1)
   * ───────────────────────────── */

  IF json_data ? 'charges' AND (json_data -> 'charges') IS NOT NULL THEN
    v_charge_id := public.upsert_charge(json_data -> 'charges');

    INSERT INTO public.feat_grant_charges (feat_grant_id, charge_id)
    VALUES (v_id, v_charge_id)
    ON CONFLICT (feat_grant_id) DO UPDATE SET
      charge_id = EXCLUDED.charge_id;
  ELSE
    DELETE FROM public.feat_grant_charges
    WHERE feat_grant_id = v_id;
  END IF;

  /* ─────────────────────────────
   * PAYLOAD + SCALING
   * ───────────────────────────── */

  -- Always clear both payload stores; we will repopulate the relevant one.
  DELETE FROM public.feat_grant_feats
  WHERE feat_grant_id = v_id;

  DELETE FROM public.feat_grant_scaling_level_feats
  WHERE scaling_level_id IN (
    SELECT id FROM public.feat_grant_scaling_levels WHERE feat_grant_id = v_id
  );

  DELETE FROM public.feat_grant_scaling_levels
  WHERE feat_grant_id = v_id;

  IF v_scaling_type = 'NONE' THEN

    -- Root payload feats (SELECTED only)
    IF v_payload_mode = 'SELECTED' THEN
      INSERT INTO public.feat_grant_feats (feat_grant_id, feat_id)
      SELECT
        v_id,
        (x)::uuid
      FROM jsonb_array_elements_text(
        COALESCE(json_data #> '{payload,featIds}', '[]'::jsonb)
      ) x;
    END IF;

  ELSIF v_scaling_type = 'PER_LEVEL' THEN

    -- Insert each scaling level, then its feats (if SELECTED)
    FOR v_level_id IN
      SELECT gen_random_uuid()
      FROM jsonb_array_elements(COALESCE(json_data #> '{scaling,levels}', '[]'::jsonb))
      LIMIT 0
    LOOP
      -- no-op placeholder; real loop below uses a FOR .. IN SELECT with ordinality
      NULL;
    END LOOP;

    -- Deterministic rebuild using WITH ORDINALITY
    WITH levels AS (
      SELECT
        obj,
        ord
      FROM jsonb_array_elements(COALESCE(json_data #> '{scaling,levels}', '[]'::jsonb))
      WITH ORDINALITY AS t(obj, ord)
    ),
    inserted AS (
      INSERT INTO public.feat_grant_scaling_levels (
        id,
        feat_grant_id,
        level,
        sort_order,
        payload_mode,
        selection_count
      )
      SELECT
        gen_random_uuid(),
        v_id,
        (l.obj ->> 'level')::int,
        (l.obj ->> 'order')::int,
        COALESCE(l.obj #>> '{value,mode}', 'ALL'),
        CASE
          WHEN v_selection_type = 'CHOSEN' THEN NULLIF(l.obj #>> '{value,count}', '')::int
          ELSE NULL
        END
      FROM levels l
      RETURNING id, payload_mode
    )
    SELECT 1;

    -- Now insert feats for SELECTED payload levels
    INSERT INTO public.feat_grant_scaling_level_feats (scaling_level_id, feat_id)
    SELECT
      sl.id,
      (fid)::uuid
    FROM public.feat_grant_scaling_levels sl
    JOIN LATERAL (
      SELECT obj
      FROM jsonb_array_elements(COALESCE(json_data #> '{scaling,levels}', '[]'::jsonb)) obj
      WHERE (obj ->> 'level')::int = sl.level
        AND (obj ->> 'order')::int = sl.sort_order
      LIMIT 1
    ) src ON true
    JOIN LATERAL jsonb_array_elements_text(
      COALESCE(src.obj #> '{value,featIds}', '[]'::jsonb)
    ) fid ON true
    WHERE sl.feat_grant_id = v_id
      AND sl.payload_mode = 'SELECTED';

  ELSE
    RAISE EXCEPTION 'Unknown scalingType: %', v_scaling_type;
  END IF;

  RETURN v_id;
END;
$$;
