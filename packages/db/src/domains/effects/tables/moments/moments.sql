/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * branches â€” TABLES
 * NOTE:
 * - BRANCH containers do have authored IDs.
 * - We keep the authored id on the row, while also preserving the composite
 *   parent key shape that the existing payload tables already reference:
 *     (effect_id, trigger_code, branch_code)
 * - Payload is NOT stored here. Payload tables will FK to:
 *     - DIRECT: (effect_id, trigger_code, branch_code)
 *     - ROLL_TABLE: branch_roll_table_entries.id
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

CREATE TABLE IF NOT EXISTS public.effect_branches (
  id uuid NOT NULL UNIQUE,
  effect_id uuid NOT NULL REFERENCES public.effects(id) DEFERRABLE INITIALLY DEFERRED,
  trigger_code text NOT NULL,
  branch_code text NOT NULL,

  group_type text NOT NULL,
  resolution_kind text NOT NULL,

  -- Optional, only for DIRECT
  duration_id uuid REFERENCES public.characteristics(id) DEFERRABLE INITIALLY DEFERRED,

  -- Optional, only for ROLL_TABLE
  roll_table_kind text,
  die text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (effect_id, trigger_code, branch_code)
);

CREATE INDEX IF NOT EXISTS idx_effect_branches_effect_id
  ON public.effect_branches(effect_id);

CREATE INDEX IF NOT EXISTS idx_effect_branches_trigger_code
  ON public.effect_branches(trigger_code);

ALTER TABLE public.effect_branches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_branches_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_branches_owned_on_update
    AFTER UPDATE ON public.effect_branches
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
    WHERE tgname = 'trg_cleanup_effect_branches_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_branches_owned
    AFTER DELETE ON public.effect_branches
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.characteristics",
      "columns": ["duration_id"]
    }]');
  END IF;
END;
$$;

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * BRANCH ROLL TABLE ENTRIES â€” TABLES
 * One row per authored roll-table entry (entry has an authored id)
 * Payload is NOT stored here; payload tables will FK to entry_id.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

CREATE TABLE IF NOT EXISTS public.branch_roll_table_entries (
  id uuid PRIMARY KEY,

  effect_id uuid NOT NULL REFERENCES public.effects(id) DEFERRABLE INITIALLY DEFERRED,
  trigger_code text NOT NULL,
  branch_code text NOT NULL,

  description text,
  sort_order integer NOT NULL,

  duration_id uuid REFERENCES public.characteristics(id) DEFERRABLE INITIALLY DEFERRED,

  -- EXACT table uses roll_value, RANGE table uses roll_min/roll_max
  roll_value integer,
  roll_min integer,
  roll_max integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT branch_roll_table_entry_parent_fk
    FOREIGN KEY (effect_id, trigger_code, branch_code)
    REFERENCES public.effect_branches(effect_id, trigger_code, branch_code)
    ON DELETE CASCADE,

  CONSTRAINT branch_roll_table_entry_roll_shape_chk CHECK (
    (roll_value IS NOT NULL AND roll_min IS NULL AND roll_max IS NULL)
    OR
    (roll_value IS NULL AND roll_min IS NOT NULL AND roll_max IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_branch_roll_table_entries_parent
  ON public.branch_roll_table_entries(effect_id, trigger_code, branch_code);

ALTER TABLE public.branch_roll_table_entries ENABLE ROW LEVEL SECURITY;
