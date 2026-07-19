/* ----------------------------------------------------------------------------
 * EFFECT RESULT BLOCKS
 * Canonical persisted result wrapper for fixed paths, choice options, and roll rows.
 * ---------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS public.effect_result_blocks (
  id text PRIMARY KEY,

  result_kind text NOT NULL,
  duration_id uuid REFERENCES public.characteristics(id) DEFERRABLE INITIALLY DEFERRED,
  lifecycle_recurring_kind text,
  lifecycle_consume_on_first_event text,
  lifecycle_end_on_events text[],

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.effect_result_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_result_blocks_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_result_blocks_owned_on_update
    AFTER UPDATE ON public.effect_result_blocks
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[{
      "table": "public.characteristics",
      "columns": ["duration_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_result_blocks_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_result_blocks_owned
    AFTER DELETE ON public.effect_result_blocks
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.characteristics",
      "columns": ["duration_id"]
    }]');
  END IF;
END;
$$;

/* ----------------------------------------------------------------------------
 * EFFECT PATHS
 * Canonical persisted effect routing container.
 * ---------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS public.effect_paths (
  id uuid PRIMARY KEY,
  effect_id uuid NOT NULL REFERENCES public.effects(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  path_code text NOT NULL,
  group_type text NOT NULL,
  selection_kind text NOT NULL,
  origin_kind text,

  range_override_characteristic_id uuid
    REFERENCES public.characteristics(id) DEFERRABLE INITIALLY DEFERRED,

  target_selection_kind text,
  target_disposition_kind text,
  max_targets integer,
  max_targets_scaling jsonb,
  excluded_creature_type_ids uuid[],

  result_block_id text
    REFERENCES public.effect_result_blocks(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  roll_table_kind text,
  die text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_effect_paths_effect_id
  ON public.effect_paths(effect_id);

CREATE INDEX IF NOT EXISTS idx_effect_paths_path_code
  ON public.effect_paths(path_code);

ALTER TABLE public.effect_paths ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_paths_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_paths_owned_on_update
    AFTER UPDATE ON public.effect_paths
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[{
      "table": "public.characteristics",
      "columns": ["range_override_characteristic_id"]
    }, {
      "table": "public.effect_result_blocks",
      "columns": ["result_block_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_paths_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_paths_owned
    AFTER DELETE ON public.effect_paths
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.characteristics",
      "columns": ["range_override_characteristic_id"]
    }, {
      "table": "public.effect_result_blocks",
      "columns": ["result_block_id"]
    }]');
  END IF;
END;
$$;

/* ----------------------------------------------------------------------------
 * EFFECT PATH CHOICE OPTIONS
 * ---------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS public.effect_path_choice_options (
  id uuid PRIMARY KEY,
  path_id uuid NOT NULL
    REFERENCES public.effect_paths(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  label text,
  description text,
  sort_order integer NOT NULL,
  result_block_id text NOT NULL
    REFERENCES public.effect_result_blocks(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_effect_path_choice_options_path_id
  ON public.effect_path_choice_options(path_id);

ALTER TABLE public.effect_path_choice_options ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_path_choice_options_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_path_choice_options_owned
    AFTER DELETE ON public.effect_path_choice_options
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.effect_result_blocks",
      "columns": ["result_block_id"]
    }]');
  END IF;
END;
$$;

/* ----------------------------------------------------------------------------
 * EFFECT PATH ROLL TABLE ROWS
 * ---------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS public.effect_path_roll_table_rows (
  id uuid PRIMARY KEY,
  path_id uuid NOT NULL
    REFERENCES public.effect_paths(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,

  roll_value integer,
  roll_min integer,
  roll_max integer,

  result_block_id text NOT NULL
    REFERENCES public.effect_result_blocks(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT effect_path_roll_table_rows_roll_shape_chk CHECK (
    (roll_value IS NOT NULL AND roll_min IS NULL AND roll_max IS NULL)
    OR
    (roll_value IS NULL AND roll_min IS NOT NULL AND roll_max IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_effect_path_roll_table_rows_path_id
  ON public.effect_path_roll_table_rows(path_id);

ALTER TABLE public.effect_path_roll_table_rows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_path_roll_table_rows_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_path_roll_table_rows_owned
    AFTER DELETE ON public.effect_path_roll_table_rows
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.effect_result_blocks",
      "columns": ["result_block_id"]
    }]');
  END IF;
END;
$$;

/* ----------------------------------------------------------------------------
 * EFFECT GENERIC OUTCOMES
 * Non-damage / non-condition typed payloads.
 * ---------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS public.effect_generic_outcomes (
  id uuid PRIMARY KEY,
  effect_kind text NOT NULL,
  json_data jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_effect_generic_outcomes_effect_kind
  ON public.effect_generic_outcomes(effect_kind);

ALTER TABLE public.effect_generic_outcomes ENABLE ROW LEVEL SECURITY;

/* ----------------------------------------------------------------------------
 * EFFECT RESULT BLOCK OUTCOMES
 * Ordered owned outcome links for a result block.
 * ---------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS public.effect_result_block_outcomes (
  result_block_id text NOT NULL
    REFERENCES public.effect_result_blocks(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  outcome_id uuid NOT NULL,
  effect_kind text NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (result_block_id, outcome_id)
);

CREATE INDEX IF NOT EXISTS idx_effect_result_block_outcomes_outcome_id
  ON public.effect_result_block_outcomes(outcome_id);

CREATE INDEX IF NOT EXISTS idx_effect_result_block_outcomes_effect_kind
  ON public.effect_result_block_outcomes(effect_kind);

ALTER TABLE public.effect_result_block_outcomes ENABLE ROW LEVEL SECURITY;

