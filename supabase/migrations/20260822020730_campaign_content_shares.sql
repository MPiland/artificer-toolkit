-- Gate 4 clean break: Campaign content is a live share of the current authored root.
-- Environments reset from canonical source; approval history and Character bindings are removed.
DROP TABLE IF EXISTS public.campaign_character_content_bindings;

DROP TRIGGER IF EXISTS campaign_vehicles_validate_version ON public.campaign_vehicles;
DROP FUNCTION IF EXISTS public.validate_campaign_vehicle_version();
ALTER TABLE public.campaign_vehicles DROP COLUMN IF EXISTS content_version_id;

DROP TABLE IF EXISTS public.campaign_content_versions;

CREATE TABLE public.campaign_content_shares (
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id)
    ON DELETE CASCADE,
  subject_kind text NOT NULL CHECK (
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
  subject_id uuid NOT NULL,
  shared_by uuid NOT NULL REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, subject_kind, subject_id)
);

CREATE INDEX campaign_content_shares_campaign_idx ON public.campaign_content_shares (
  campaign_id,
  created_at,
  subject_kind,
  subject_id
);
CREATE INDEX campaign_content_shares_author_idx ON public.campaign_content_shares (
  shared_by,
  campaign_id,
  subject_kind,
  subject_id
);

ALTER TABLE public.campaign_content_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_content_shares FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_content_shares FROM anon, authenticated;

ALTER TABLE public.campaign_vehicles
ADD COLUMN vehicle_definition_id uuid NOT NULL REFERENCES public.vehicles (id)
  ON DELETE RESTRICT;
