/* --------------------------------------------------
 * AUTHORED SUBJECT DRAFTS
 *
 * Generic sidecar storage for incomplete authored-domain work.
 * Normalized domain tables remain the source of truth for complete
 * active records; this table stores editor JSON until activation.
 * -------------------------------------------------- */

CREATE TABLE IF NOT EXISTS public.authored_subject_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,

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
  payload jsonb NOT NULL,
  base_active_updated_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT authored_subject_drafts_status_chk CHECK (status = 'DRAFT'),
  CONSTRAINT authored_subject_drafts_kind_chk CHECK (
    subject_kind IN (
      'BACKGROUND',
      'CLASS',
      'CREATURE',
      'EQUIPMENT',
      'FEAT',
      'RACE',
      'SPELL',
      'VEHICLE'
    )
  ),
  CONSTRAINT authored_subject_drafts_unique_subject_user UNIQUE (
    subject_kind,
    subject_id,
    user_id
  )
);

ALTER TABLE public.authored_subject_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own authored drafts" ON public.authored_subject_drafts;
CREATE POLICY "Users can select own authored drafts"
  ON public.authored_subject_drafts FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own authored drafts" ON public.authored_subject_drafts;
CREATE POLICY "Users can insert own authored drafts"
  ON public.authored_subject_drafts FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own authored drafts" ON public.authored_subject_drafts;
CREATE POLICY "Users can update own authored drafts"
  ON public.authored_subject_drafts FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own authored drafts" ON public.authored_subject_drafts;
CREATE POLICY "Users can delete own authored drafts"
  ON public.authored_subject_drafts FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_authored_subject_drafts_user
  ON public.authored_subject_drafts(user_id);

CREATE INDEX IF NOT EXISTS idx_authored_subject_drafts_system
  ON public.authored_subject_drafts(system_id);

CREATE INDEX IF NOT EXISTS idx_authored_subject_drafts_subject
  ON public.authored_subject_drafts(subject_kind, subject_id);
