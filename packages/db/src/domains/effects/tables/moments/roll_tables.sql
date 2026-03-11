/* ──────────────────────────────────────────────
 * MOMENT ROLL TABLE DAMAGE
 * One row per roll-table entry payload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.moment_roll_table_damages (
  entry_id uuid PRIMARY KEY
    REFERENCES public.moment_roll_table_entries(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  damage_id uuid NOT NULL
    REFERENCES public.damages(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_moment_roll_table_damages_damage_id
  ON public.moment_roll_table_damages(damage_id);

ALTER TABLE public.moment_roll_table_damages ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * MOMENT ROLL TABLE CONDITION
 * One row per roll-table entry payload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.moment_roll_table_conditions (
  entry_id uuid PRIMARY KEY
    REFERENCES public.moment_roll_table_entries(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  condition_id uuid NOT NULL
    REFERENCES public.conditions(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_moment_roll_table_conditions_condition_id
  ON public.moment_roll_table_conditions(condition_id);

ALTER TABLE public.moment_roll_table_conditions ENABLE ROW LEVEL SECURITY;