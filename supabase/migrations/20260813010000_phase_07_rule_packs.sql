CREATE TABLE public.rule_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_code text NOT NULL CHECK (char_length(btrim(ruleset_code)) BETWEEN 1 AND 80),
  version text NOT NULL CHECK (char_length(btrim(version)) BETWEEN 1 AND 80),
  active_revision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ruleset_code, version)
);

CREATE TABLE public.rule_pack_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_pack_id uuid NOT NULL REFERENCES public.rule_packs (id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  activated_by uuid REFERENCES auth.users (id) ON DELETE RESTRICT,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_pack_id, revision),
  CHECK (
    (activated_by IS NULL AND activated_at IS NULL)
    OR (activated_by IS NOT NULL AND activated_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX rule_pack_revisions_one_draft_per_pack_idx
  ON public.rule_pack_revisions (rule_pack_id)
  WHERE activated_at IS NULL;
CREATE INDEX rule_pack_revisions_rule_pack_idx
  ON public.rule_pack_revisions (rule_pack_id, revision DESC);

ALTER TABLE public.rule_packs
  ADD CONSTRAINT rule_packs_active_revision_fk
  FOREIGN KEY (active_revision_id) REFERENCES public.rule_pack_revisions (id) ON DELETE RESTRICT;

CREATE FUNCTION public.validate_rule_pack_active_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.active_revision_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.rule_pack_revisions revision
    WHERE revision.id = NEW.active_revision_id
      AND revision.rule_pack_id = NEW.id
      AND revision.activated_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Rule pack active revision must be activated and belong to its rule pack.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER rule_packs_validate_active_revision
  BEFORE INSERT OR UPDATE OF active_revision_id ON public.rule_packs
  FOR EACH ROW EXECUTE FUNCTION public.validate_rule_pack_active_revision();

CREATE FUNCTION public.reject_activated_rule_pack_revision_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.activated_at IS NOT NULL THEN
    RAISE EXCEPTION 'Activated rule pack revisions are immutable.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER rule_pack_revisions_immutable
  BEFORE UPDATE OR DELETE ON public.rule_pack_revisions
  FOR EACH ROW EXECUTE FUNCTION public.reject_activated_rule_pack_revision_mutation();

ALTER TABLE public.rule_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_packs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rule_packs FROM anon, authenticated;
ALTER TABLE public.rule_pack_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_pack_revisions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rule_pack_revisions FROM anon, authenticated;

ALTER TABLE public.encounters
  ADD COLUMN rule_pack_revision_id uuid REFERENCES public.rule_pack_revisions (id) ON DELETE RESTRICT;

DROP TRIGGER IF EXISTS encounter_events_trim ON public.encounter_events;
DROP FUNCTION IF EXISTS public.trim_encounter_events();

SELECT public.apply_updated_at_triggers();
