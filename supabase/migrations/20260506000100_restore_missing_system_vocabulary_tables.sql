CREATE TABLE IF NOT EXISTS public.heritages (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.heritages ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('heritages');

CREATE UNIQUE INDEX IF NOT EXISTS uq_heritages_system_code
  ON public.heritages(system_id, code);

CREATE INDEX IF NOT EXISTS idx_heritages_system
  ON public.heritages(system_id);

CREATE TABLE IF NOT EXISTS public.lifestyles (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lifestyles ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('lifestyles');

CREATE UNIQUE INDEX IF NOT EXISTS uq_lifestyles_system_code
  ON public.lifestyles(system_id, code);

CREATE INDEX IF NOT EXISTS idx_lifestyles_system
  ON public.lifestyles(system_id);
