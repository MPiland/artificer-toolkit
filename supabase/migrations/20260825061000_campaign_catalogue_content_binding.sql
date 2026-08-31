-- Gate 1 rules-runtime rebaseline: bind Campaigns, Characters, and authored roots
-- to one Game System, Rules Catalogue baseline, and exact Content Source.
-- This migration fails closed rather than inventing cross-System provenance.

DO $$
DECLARE
  stable_dnd_system_id constant uuid := '00000000-0000-0000-0000-000000000001';
  dnd_2014_catalogue_id constant uuid := '00000000-0000-4000-8000-000000000301';
  srd_51_source_id constant uuid := '00000000-0000-4000-8000-000000000302';
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.rules_catalogues
    WHERE id = dnd_2014_catalogue_id
      AND (game_system_id <> stable_dnd_system_id OR code <> 'dnd-2014')
  ) THEN
    RAISE EXCEPTION 'Deterministic D&D 2014 Rules Catalogue ID is already bound incompatibly.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.rules_catalogues
    WHERE game_system_id = stable_dnd_system_id
      AND code = 'dnd-2014'
      AND id <> dnd_2014_catalogue_id
  ) THEN
    RAISE EXCEPTION 'D&D 2014 Rules Catalogue identity is already bound to a different ID.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.content_sources
    WHERE id = srd_51_source_id
      AND (game_system_id <> stable_dnd_system_id OR kind <> 'PLATFORM' OR code <> 'srd-5.1')
  ) THEN
    RAISE EXCEPTION 'Deterministic SRD 5.1 Content Source ID is already bound incompatibly.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.content_sources
    WHERE game_system_id = stable_dnd_system_id
      AND kind = 'PLATFORM'
      AND code = 'srd-5.1'
      AND id <> srd_51_source_id
  ) THEN
    RAISE EXCEPTION 'SRD 5.1 Content Source identity is already bound to a different ID.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.systems WHERE id = stable_dnd_system_id) THEN
    INSERT INTO public.rules_catalogues (id, game_system_id, code, label, description)
    VALUES (dnd_2014_catalogue_id, stable_dnd_system_id, 'dnd-2014', 'D&D 2014', 'D&D 5e 2014 catalogue.')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.content_sources (id, game_system_id, kind, owner_user_id, code, label, description)
    VALUES (srd_51_source_id, stable_dnd_system_id, 'PLATFORM', NULL, 'srd-5.1', 'SRD 5.1', 'D&D 5e SRD 5.1 platform source.')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.rules_catalogue_content_sources (catalogue_id, content_source_id, game_system_id)
    VALUES (dnd_2014_catalogue_id, srd_51_source_id, stable_dnd_system_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

CREATE UNIQUE INDEX content_sources_default_user_source_idx
  ON public.content_sources (game_system_id, owner_user_id)
  WHERE kind = 'USER' AND code = 'default';

ALTER TABLE public.campaigns ADD COLUMN game_system_id uuid;
ALTER TABLE public.campaigns ADD COLUMN primary_rules_catalogue_id uuid;
ALTER TABLE public.characters ADD COLUMN primary_rules_catalogue_id uuid;
ALTER TABLE public.authored_drafts ADD COLUMN content_source_id uuid;
ALTER TABLE public.backgrounds ADD COLUMN content_source_id uuid;
ALTER TABLE public.classes ADD COLUMN content_source_id uuid;
ALTER TABLE public.creatures ADD COLUMN content_source_id uuid;
ALTER TABLE public.equipment ADD COLUMN content_source_id uuid;
ALTER TABLE public.feats ADD COLUMN content_source_id uuid;
ALTER TABLE public.races ADD COLUMN content_source_id uuid;
ALTER TABLE public.spells ADD COLUMN content_source_id uuid;
ALTER TABLE public.vehicles ADD COLUMN content_source_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT system_id, user_id, is_master FROM public.backgrounds
      UNION ALL SELECT system_id, user_id, is_master FROM public.classes
      UNION ALL SELECT system_id, user_id, is_master FROM public.creatures
      UNION ALL SELECT system_id, user_id, is_master FROM public.equipment
      UNION ALL SELECT system_id, user_id, is_master FROM public.feats
      UNION ALL SELECT system_id, user_id, is_master FROM public.races
      UNION ALL SELECT system_id, user_id, is_master FROM public.spells
      UNION ALL SELECT system_id, user_id, is_master FROM public.vehicles
    ) root
    WHERE coalesce(root.is_master, false) AND root.system_id <> '00000000-0000-0000-0000-000000000001'::uuid
  ) THEN
    RAISE EXCEPTION 'Cannot backfill master authored roots outside the SRD Game System.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT user_id FROM public.backgrounds WHERE NOT coalesce(is_master, false)
      UNION ALL SELECT user_id FROM public.classes WHERE NOT coalesce(is_master, false)
      UNION ALL SELECT user_id FROM public.creatures WHERE NOT coalesce(is_master, false)
      UNION ALL SELECT user_id FROM public.equipment WHERE NOT coalesce(is_master, false)
      UNION ALL SELECT user_id FROM public.feats WHERE NOT coalesce(is_master, false)
      UNION ALL SELECT user_id FROM public.races WHERE NOT coalesce(is_master, false)
      UNION ALL SELECT user_id FROM public.spells WHERE NOT coalesce(is_master, false)
      UNION ALL SELECT user_id FROM public.vehicles WHERE NOT coalesce(is_master, false)
      UNION ALL SELECT user_id FROM public.authored_drafts
    ) owner_check WHERE user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill user-authored content without an exact owner.';
  END IF;
END;
$$;

WITH owners AS (
  SELECT system_id, user_id FROM public.backgrounds WHERE NOT coalesce(is_master, false)
  UNION SELECT system_id, user_id FROM public.classes WHERE NOT coalesce(is_master, false)
  UNION SELECT system_id, user_id FROM public.creatures WHERE NOT coalesce(is_master, false)
  UNION SELECT system_id, user_id FROM public.equipment WHERE NOT coalesce(is_master, false)
  UNION SELECT system_id, user_id FROM public.feats WHERE NOT coalesce(is_master, false)
  UNION SELECT system_id, user_id FROM public.races WHERE NOT coalesce(is_master, false)
  UNION SELECT system_id, user_id FROM public.spells WHERE NOT coalesce(is_master, false)
  UNION SELECT system_id, user_id FROM public.vehicles WHERE NOT coalesce(is_master, false)
  UNION SELECT system_id, user_id FROM public.authored_drafts
)
INSERT INTO public.content_sources (game_system_id, kind, owner_user_id, code, label, description)
SELECT system_id, 'USER', user_id, 'default', 'Default homebrew source', NULL FROM owners
ON CONFLICT (game_system_id, owner_user_id) WHERE kind = 'USER' AND code = 'default' DO NOTHING;

UPDATE public.backgrounds SET content_source_id = '00000000-0000-4000-8000-000000000302'::uuid WHERE coalesce(is_master, false);
UPDATE public.classes SET content_source_id = '00000000-0000-4000-8000-000000000302'::uuid WHERE coalesce(is_master, false);
UPDATE public.creatures SET content_source_id = '00000000-0000-4000-8000-000000000302'::uuid WHERE coalesce(is_master, false);
UPDATE public.equipment SET content_source_id = '00000000-0000-4000-8000-000000000302'::uuid WHERE coalesce(is_master, false);
UPDATE public.feats SET content_source_id = '00000000-0000-4000-8000-000000000302'::uuid WHERE coalesce(is_master, false);
UPDATE public.races SET content_source_id = '00000000-0000-4000-8000-000000000302'::uuid WHERE coalesce(is_master, false);
UPDATE public.spells SET content_source_id = '00000000-0000-4000-8000-000000000302'::uuid WHERE coalesce(is_master, false);
UPDATE public.vehicles SET content_source_id = '00000000-0000-4000-8000-000000000302'::uuid WHERE coalesce(is_master, false);

UPDATE public.backgrounds root SET content_source_id = source.id FROM public.content_sources source WHERE NOT coalesce(root.is_master, false) AND source.game_system_id = root.system_id AND source.owner_user_id = root.user_id AND source.kind = 'USER' AND source.code = 'default';
UPDATE public.classes root SET content_source_id = source.id FROM public.content_sources source WHERE NOT coalesce(root.is_master, false) AND source.game_system_id = root.system_id AND source.owner_user_id = root.user_id AND source.kind = 'USER' AND source.code = 'default';
UPDATE public.creatures root SET content_source_id = source.id FROM public.content_sources source WHERE NOT coalesce(root.is_master, false) AND source.game_system_id = root.system_id AND source.owner_user_id = root.user_id AND source.kind = 'USER' AND source.code = 'default';
UPDATE public.equipment root SET content_source_id = source.id FROM public.content_sources source WHERE NOT coalesce(root.is_master, false) AND source.game_system_id = root.system_id AND source.owner_user_id = root.user_id AND source.kind = 'USER' AND source.code = 'default';
UPDATE public.feats root SET content_source_id = source.id FROM public.content_sources source WHERE NOT coalesce(root.is_master, false) AND source.game_system_id = root.system_id AND source.owner_user_id = root.user_id AND source.kind = 'USER' AND source.code = 'default';
UPDATE public.races root SET content_source_id = source.id FROM public.content_sources source WHERE NOT coalesce(root.is_master, false) AND source.game_system_id = root.system_id AND source.owner_user_id = root.user_id AND source.kind = 'USER' AND source.code = 'default';
UPDATE public.spells root SET content_source_id = source.id FROM public.content_sources source WHERE NOT coalesce(root.is_master, false) AND source.game_system_id = root.system_id AND source.owner_user_id = root.user_id AND source.kind = 'USER' AND source.code = 'default';
UPDATE public.vehicles root SET content_source_id = source.id FROM public.content_sources source WHERE NOT coalesce(root.is_master, false) AND source.game_system_id = root.system_id AND source.owner_user_id = root.user_id AND source.kind = 'USER' AND source.code = 'default';

UPDATE public.authored_drafts draft
SET content_source_id = root.content_source_id
FROM (
  SELECT 'BACKGROUND'::text AS subject_kind, id, content_source_id FROM public.backgrounds
  UNION ALL SELECT 'CLASS', id, content_source_id FROM public.classes
  UNION ALL SELECT 'CREATURE', id, content_source_id FROM public.creatures
  UNION ALL SELECT 'EQUIPMENT', id, content_source_id FROM public.equipment
  UNION ALL SELECT 'FEAT', id, content_source_id FROM public.feats
  UNION ALL SELECT 'RACE', id, content_source_id FROM public.races
  UNION ALL SELECT 'SPELL', id, content_source_id FROM public.spells
  UNION ALL SELECT 'VEHICLE', id, content_source_id FROM public.vehicles
) root
WHERE root.subject_kind = draft.subject_kind AND root.id = draft.subject_id;
UPDATE public.authored_drafts draft SET content_source_id = source.id FROM public.content_sources source WHERE draft.content_source_id IS NULL AND source.game_system_id = draft.system_id AND source.owner_user_id = draft.user_id AND source.kind = 'USER' AND source.code = 'default';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.backgrounds WHERE content_source_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.classes WHERE content_source_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.creatures WHERE content_source_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.equipment WHERE content_source_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.feats WHERE content_source_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.races WHERE content_source_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.spells WHERE content_source_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.vehicles WHERE content_source_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.authored_drafts WHERE content_source_id IS NULL)
  THEN RAISE EXCEPTION 'Authored root/draft Content Source backfill is incomplete.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.authored_drafts draft JOIN (
      SELECT 'BACKGROUND'::text AS subject_kind, id, content_source_id FROM public.backgrounds
      UNION ALL SELECT 'CLASS', id, content_source_id FROM public.classes
      UNION ALL SELECT 'CREATURE', id, content_source_id FROM public.creatures
      UNION ALL SELECT 'EQUIPMENT', id, content_source_id FROM public.equipment
      UNION ALL SELECT 'FEAT', id, content_source_id FROM public.feats
      UNION ALL SELECT 'RACE', id, content_source_id FROM public.races
      UNION ALL SELECT 'SPELL', id, content_source_id FROM public.spells
      UNION ALL SELECT 'VEHICLE', id, content_source_id FROM public.vehicles
    ) root ON root.subject_kind = draft.subject_kind AND root.id = draft.subject_id
    WHERE root.content_source_id <> draft.content_source_id
  ) THEN RAISE EXCEPTION 'Authored draft Content Source must match its root.'; END IF;
END;
$$;

UPDATE public.characters AS character SET primary_rules_catalogue_id = catalogue.id
FROM public.rules_catalogues catalogue
WHERE catalogue.game_system_id = character.system_id
  AND NOT EXISTS (
    SELECT 1 FROM public.rules_catalogues other
    WHERE other.game_system_id = catalogue.game_system_id
      AND other.id <> catalogue.id
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.characters WHERE primary_rules_catalogue_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill Character primary Rules Catalogue without exactly one approved catalogue for its Game System.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.campaigns campaign WHERE NOT EXISTS (
      SELECT 1 FROM public.campaign_character_assignments assignment WHERE assignment.campaign_id = campaign.id
    )
  ) THEN RAISE EXCEPTION 'Cannot backfill zero-assignment Campaign Game System.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.campaign_character_assignments assignment JOIN public.characters character ON character.id = assignment.character_id
    GROUP BY assignment.campaign_id HAVING count(DISTINCT character.system_id) <> 1
  ) THEN RAISE EXCEPTION 'Cannot backfill mixed-System Campaign.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.campaign_character_assignments assignment JOIN public.characters character ON character.id = assignment.character_id
    GROUP BY assignment.campaign_id HAVING count(DISTINCT character.primary_rules_catalogue_id) <> 1
  ) THEN RAISE EXCEPTION 'Cannot backfill Campaign with more than one Character primary Rules Catalogue.'; END IF;
END;
$$;

UPDATE public.campaigns campaign
SET game_system_id = assigned.system_id,
    primary_rules_catalogue_id = assigned.primary_rules_catalogue_id
FROM (
  SELECT DISTINCT assignment.campaign_id, character.system_id, character.primary_rules_catalogue_id
  FROM public.campaign_character_assignments assignment
  JOIN public.characters character ON character.id = assignment.character_id
) assigned WHERE assigned.campaign_id = campaign.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.campaigns WHERE game_system_id IS NULL OR primary_rules_catalogue_id IS NULL) THEN
    RAISE EXCEPTION 'Campaign Game System/primary Rules Catalogue backfill is incomplete.';
  END IF;
END;
$$;

ALTER TABLE public.backgrounds ALTER COLUMN content_source_id SET NOT NULL;
ALTER TABLE public.classes ALTER COLUMN content_source_id SET NOT NULL;
ALTER TABLE public.creatures ALTER COLUMN content_source_id SET NOT NULL;
ALTER TABLE public.equipment ALTER COLUMN content_source_id SET NOT NULL;
ALTER TABLE public.feats ALTER COLUMN content_source_id SET NOT NULL;
ALTER TABLE public.races ALTER COLUMN content_source_id SET NOT NULL;
ALTER TABLE public.spells ALTER COLUMN content_source_id SET NOT NULL;
ALTER TABLE public.vehicles ALTER COLUMN content_source_id SET NOT NULL;
ALTER TABLE public.authored_drafts ALTER COLUMN content_source_id SET NOT NULL;
ALTER TABLE public.characters ALTER COLUMN primary_rules_catalogue_id SET NOT NULL;
ALTER TABLE public.campaigns ALTER COLUMN game_system_id SET NOT NULL;
ALTER TABLE public.campaigns ALTER COLUMN primary_rules_catalogue_id SET NOT NULL;

ALTER TABLE public.backgrounds ADD CONSTRAINT backgrounds_content_source_system_fk FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (id, game_system_id) ON DELETE RESTRICT;
ALTER TABLE public.classes ADD CONSTRAINT classes_content_source_system_fk FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (id, game_system_id) ON DELETE RESTRICT;
ALTER TABLE public.creatures ADD CONSTRAINT creatures_content_source_system_fk FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (id, game_system_id) ON DELETE RESTRICT;
ALTER TABLE public.equipment ADD CONSTRAINT equipment_content_source_system_fk FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (id, game_system_id) ON DELETE RESTRICT;
ALTER TABLE public.feats ADD CONSTRAINT feats_content_source_system_fk FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (id, game_system_id) ON DELETE RESTRICT;
ALTER TABLE public.races ADD CONSTRAINT races_content_source_system_fk FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (id, game_system_id) ON DELETE RESTRICT;
ALTER TABLE public.spells ADD CONSTRAINT spells_content_source_system_fk FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (id, game_system_id) ON DELETE RESTRICT;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_content_source_system_fk FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (id, game_system_id) ON DELETE RESTRICT;
ALTER TABLE public.authored_drafts ADD CONSTRAINT authored_drafts_content_source_system_fk FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (id, game_system_id) ON DELETE RESTRICT;
ALTER TABLE public.characters ADD CONSTRAINT characters_primary_catalogue_system_fk FOREIGN KEY (primary_rules_catalogue_id, system_id) REFERENCES public.rules_catalogues (id, game_system_id) ON DELETE RESTRICT;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_id_game_system_key UNIQUE (id, game_system_id);
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_primary_catalogue_system_fk FOREIGN KEY (primary_rules_catalogue_id, game_system_id) REFERENCES public.rules_catalogues (id, game_system_id) ON DELETE RESTRICT;

CREATE TABLE public.campaign_additional_rules_catalogues (
  campaign_id uuid NOT NULL, rules_catalogue_id uuid NOT NULL, game_system_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (campaign_id, rules_catalogue_id),
  FOREIGN KEY (campaign_id, game_system_id) REFERENCES public.campaigns (id, game_system_id) ON DELETE CASCADE,
  FOREIGN KEY (rules_catalogue_id, game_system_id) REFERENCES public.rules_catalogues (id, game_system_id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION public.validate_campaign_additional_rules_catalogue() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Campaign additional Rules Catalogue ownership is immutable.'; END IF;
  PERFORM 1 FROM public.campaigns campaign WHERE campaign.id = NEW.campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign additional Rules Catalogue requires an existing Campaign.'; END IF;
  IF EXISTS (SELECT 1 FROM public.campaigns WHERE id = NEW.campaign_id AND game_system_id = NEW.game_system_id AND primary_rules_catalogue_id = NEW.rules_catalogue_id) THEN
    RAISE EXCEPTION 'Campaign primary Rules Catalogue must not be stored as an additional catalogue.';
  END IF;
  IF (SELECT count(*) FROM public.campaign_additional_rules_catalogues additional WHERE additional.campaign_id = NEW.campaign_id) >= 31 THEN
    RAISE EXCEPTION 'Campaign may enable at most 31 additional Rules Catalogues.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER campaign_additional_catalogues_validate BEFORE INSERT OR UPDATE OR DELETE ON public.campaign_additional_rules_catalogues FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_additional_rules_catalogue();
CREATE OR REPLACE FUNCTION public.reject_campaign_primary_catalogue_duplicate() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.primary_rules_catalogue_id IS DISTINCT FROM OLD.primary_rules_catalogue_id AND EXISTS (SELECT 1 FROM public.campaign_additional_rules_catalogues additional WHERE additional.campaign_id = NEW.id AND additional.rules_catalogue_id = NEW.primary_rules_catalogue_id) THEN
    RAISE EXCEPTION 'Campaign primary Rules Catalogue must not be stored as an additional catalogue.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER campaigns_reject_additional_primary BEFORE UPDATE OF primary_rules_catalogue_id ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.reject_campaign_primary_catalogue_duplicate();
CREATE OR REPLACE FUNCTION public.prevent_campaign_game_system_change() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.game_system_id IS DISTINCT FROM OLD.game_system_id THEN RAISE EXCEPTION 'Campaign Game System is immutable.'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER campaigns_prevent_game_system_change BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.prevent_campaign_game_system_change();

ALTER TABLE public.campaign_additional_rules_catalogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_additional_rules_catalogues FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_additional_rules_catalogues FROM anon, authenticated;
SELECT public.apply_updated_at_triggers();
