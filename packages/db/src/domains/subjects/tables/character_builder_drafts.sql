/* --------------------------------------------------------------------------
 * CHARACTER BUILDER DRAFTS
 *
 * JSONB sidecar for incomplete character builder work.
 * Normalized character rows are written only when the builder commit succeeds.
 * -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.character_builder_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL,
  user_id uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  mode text NOT NULL DEFAULT 'create',
  payload jsonb NOT NULL,
  base_active_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_builder_drafts_status_chk CHECK (status = 'DRAFT'),
  CONSTRAINT character_builder_drafts_mode_chk CHECK (mode IN ('create', 'edit')),
  CONSTRAINT character_builder_drafts_unique_character_user UNIQUE (character_id, user_id)
);

ALTER TABLE public.character_builder_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own character builder drafts" ON public.character_builder_drafts;
CREATE POLICY "Users can select own character builder drafts"
  ON public.character_builder_drafts FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own character builder drafts" ON public.character_builder_drafts;
CREATE POLICY "Users can insert own character builder drafts"
  ON public.character_builder_drafts FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own character builder drafts" ON public.character_builder_drafts;
CREATE POLICY "Users can update own character builder drafts"
  ON public.character_builder_drafts FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own character builder drafts" ON public.character_builder_drafts;
CREATE POLICY "Users can delete own character builder drafts"
  ON public.character_builder_drafts FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_character_builder_drafts_user
  ON public.character_builder_drafts(user_id);

CREATE INDEX IF NOT EXISTS idx_character_builder_drafts_system
  ON public.character_builder_drafts(system_id);

CREATE INDEX IF NOT EXISTS idx_character_builder_drafts_character
  ON public.character_builder_drafts(character_id);
