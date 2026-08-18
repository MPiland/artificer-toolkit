CREATE TABLE IF NOT EXISTS public.encounter_current_projections (
  encounter_id uuid PRIMARY KEY REFERENCES public.encounters (id) ON DELETE CASCADE,
  stream_version integer NOT NULL CHECK (stream_version >= 0),
  projection_schema_version integer NOT NULL CHECK (projection_schema_version > 0),
  projection_checksum text NOT NULL CHECK (projection_checksum ~ '^[0-9a-f]{64}$'),
  projection jsonb NOT NULL CHECK (jsonb_typeof(projection) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.encounter_current_projections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.encounter_current_projections FROM anon, authenticated;
