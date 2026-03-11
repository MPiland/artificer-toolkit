/* ──────────────────────────────────────────────
 * MOMENT DIRECT DAMAGE
 * One row per DIRECT moment payload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.moment_direct_damages (
  effect_id uuid NOT NULL REFERENCES public.effects(id) DEFERRABLE INITIALLY DEFERRED,
  trigger_code text NOT NULL,
  moment_code text NOT NULL,

  damage_id uuid NOT NULL
    REFERENCES public.damages(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (effect_id, trigger_code, moment_code),

  CONSTRAINT moment_direct_damage_fk
    FOREIGN KEY (effect_id, trigger_code, moment_code)
    REFERENCES public.effect_moments(effect_id, trigger_code, moment_code)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_moment_direct_damages_damage_id
  ON public.moment_direct_damages(damage_id);

ALTER TABLE public.moment_direct_damages ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * MOMENT DIRECT CONDITION
 * One row per DIRECT moment payload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.moment_direct_conditions (
  effect_id uuid NOT NULL REFERENCES public.effects(id) DEFERRABLE INITIALLY DEFERRED,
  trigger_code text NOT NULL,
  moment_code text NOT NULL,

  condition_id uuid NOT NULL
    REFERENCES public.conditions(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (effect_id, trigger_code, moment_code),

  CONSTRAINT moment_direct_condition_fk
    FOREIGN KEY (effect_id, trigger_code, moment_code)
    REFERENCES public.effect_moments(effect_id, trigger_code, moment_code)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_moment_direct_conditions_condition_id
  ON public.moment_direct_conditions(condition_id);

ALTER TABLE public.moment_direct_conditions ENABLE ROW LEVEL SECURITY;