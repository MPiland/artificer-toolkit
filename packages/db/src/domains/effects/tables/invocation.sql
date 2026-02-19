/* ──────────────────────────────────────────────
 * EFFECT INVOCATIONS — TABLE
 * One invocation per effect
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.effect_invocations (
  effect_id uuid PRIMARY KEY
    REFERENCES public.effects(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  trigger_code text NOT NULL,

  activation_type text NOT NULL,
  activation_value integer,

  range_characteristic_id uuid NOT NULL
    REFERENCES public.characteristics(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,

  shape_characteristic_id uuid
    REFERENCES public.characteristics(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  saving_throw_id uuid
    REFERENCES public.saving_throws(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_effect_invocations_trigger
  ON public.effect_invocations(trigger_code);

CREATE INDEX IF NOT EXISTS idx_effect_invocations_range
  ON public.effect_invocations(range_characteristic_id);

CREATE INDEX IF NOT EXISTS idx_effect_invocations_shape
  ON public.effect_invocations(shape_characteristic_id);

CREATE INDEX IF NOT EXISTS idx_effect_invocations_saving_throw
  ON public.effect_invocations(saving_throw_id);

ALTER TABLE public.effect_invocations ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * EFFECT INVOCATIONS — OWNERSHIP CLEANUP
 * ────────────────────────────────────────────── */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_invocations_owned'
      AND tgrelid = 'public.effect_invocations'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_invocations_owned
      AFTER DELETE ON public.effect_invocations
      FOR EACH ROW
      EXECUTE FUNCTION public.cleanup_owned_rows('[
        { "table": "public.characteristics", "columns": ["range_characteristic_id", "shape_characteristic_id"] },
        { "table": "public.saving_throws", "columns": ["saving_throw_id"] }
      ]');
  END IF;
END;
$$;