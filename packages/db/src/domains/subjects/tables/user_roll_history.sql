CREATE TABLE IF NOT EXISTS public.user_roll_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  character_label text NOT NULL,
  source jsonb NOT NULL,
  system_id uuid NOT NULL REFERENCES public.systems(id),
  ruleset_code text NOT NULL,
  ruleset_version text NOT NULL,
  normalized_expression text NOT NULL,
  evidence jsonb NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roll_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own roll history." ON public.user_roll_history;
CREATE POLICY "Users can read own roll history."
  ON public.user_roll_history FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_user_roll_history_user_created
  ON public.user_roll_history (user_id, created_at DESC, id DESC);
