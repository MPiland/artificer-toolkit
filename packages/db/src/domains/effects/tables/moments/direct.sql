/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * BRANCH DIRECT DAMAGE
 * One row per DIRECT BRANCH payload
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

CREATE TABLE IF NOT EXISTS public.branch_direct_damages (
  effect_id uuid NOT NULL REFERENCES public.effects(id) DEFERRABLE INITIALLY DEFERRED,
  trigger_code text NOT NULL,
  branch_code text NOT NULL,

  damage_id uuid NOT NULL
    REFERENCES public.damages(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (effect_id, trigger_code, branch_code),

  CONSTRAINT branch_direct_damage_fk
    FOREIGN KEY (effect_id, trigger_code, branch_code)
    REFERENCES public.effect_branches(effect_id, trigger_code, branch_code)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_branch_direct_damages_damage_id
  ON public.branch_direct_damages(damage_id);

ALTER TABLE public.branch_direct_damages ENABLE ROW LEVEL SECURITY;

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * BRANCH DIRECT CONDITION
 * One row per DIRECT BRANCH payload
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

CREATE TABLE IF NOT EXISTS public.branch_direct_conditions (
  effect_id uuid NOT NULL REFERENCES public.effects(id) DEFERRABLE INITIALLY DEFERRED,
  trigger_code text NOT NULL,
  branch_code text NOT NULL,

  condition_id uuid NOT NULL
    REFERENCES public.conditions(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (effect_id, trigger_code, branch_code),

  CONSTRAINT branch_direct_condition_fk
    FOREIGN KEY (effect_id, trigger_code, branch_code)
    REFERENCES public.effect_branches(effect_id, trigger_code, branch_code)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_branch_direct_conditions_condition_id
  ON public.branch_direct_conditions(condition_id);

ALTER TABLE public.branch_direct_conditions ENABLE ROW LEVEL SECURITY;
