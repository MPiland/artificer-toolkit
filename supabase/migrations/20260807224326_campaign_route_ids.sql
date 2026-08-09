ALTER TABLE public.authored_route_ids
  DROP CONSTRAINT IF EXISTS authored_route_ids_subject_kind_chk;

ALTER TABLE public.authored_route_ids
  ADD CONSTRAINT authored_route_ids_subject_kind_chk CHECK (
    subject_kind IN (
      'BACKGROUND',
      'CAMPAIGN',
      'CHARACTER',
      'CLASS',
      'CREATURE',
      'EQUIPMENT',
      'FEAT',
      'RACE',
      'SPELL',
      'VEHICLE'
    )
  );

CREATE OR REPLACE FUNCTION public.can_access_authored_route_id(
  p_subject_kind text,
  p_subject_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND (
      ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
      OR EXISTS (
        SELECT 1
        FROM public.authored_drafts draft
        WHERE draft.subject_kind = p_subject_kind
          AND draft.subject_id = p_subject_id
          AND draft.user_id = (SELECT auth.uid())
      )
      OR (
        p_subject_kind = 'CHARACTER'
        AND (
          EXISTS (
            SELECT 1
            FROM public.characters character
            WHERE character.id = p_subject_id
              AND character.user_id = (SELECT auth.uid())
          )
          OR EXISTS (
            SELECT 1
            FROM public.character_builder_drafts draft
            WHERE draft.character_id = p_subject_id
              AND draft.user_id = (SELECT auth.uid())
          )
        )
      )
      OR (
        p_subject_kind = 'CAMPAIGN'
        AND EXISTS (
          SELECT 1
          FROM public.campaign_memberships membership
          WHERE membership.campaign_id = p_subject_id
            AND membership.user_id = (SELECT auth.uid())
            AND membership.status = 'ACTIVE'
        )
      )
      OR EXISTS (
        SELECT 1
        FROM (
          SELECT 'BACKGROUND'::text AS subject_kind, id, user_id, system_id, is_master
          FROM public.backgrounds WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'CLASS', id, user_id, system_id, is_master
          FROM public.classes WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'CREATURE', id, user_id, system_id, is_master
          FROM public.creatures WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'EQUIPMENT', id, user_id, system_id, is_master
          FROM public.equipment WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'FEAT', id, user_id, system_id, is_master
          FROM public.feats WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'RACE', id, user_id, system_id, is_master
          FROM public.races WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'SPELL', id, user_id, system_id, is_master
          FROM public.spells WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'VEHICLE', id, user_id, system_id, is_master
          FROM public.vehicles WHERE status = 'ACTIVE'
        ) root
        JOIN public.systems system ON system.id = root.system_id
        WHERE root.subject_kind = p_subject_kind
          AND root.id = p_subject_id
          AND (
            root.is_master = true
            OR root.user_id = (SELECT auth.uid())
            OR system.user_id = (SELECT auth.uid())
          )
      )
    );
$$;

INSERT INTO public.authored_route_ids (subject_kind, subject_id)
SELECT 'CAMPAIGN', campaign.id
FROM public.campaigns campaign
ON CONFLICT (subject_kind, subject_id) DO NOTHING;
