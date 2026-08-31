-- Gate 1 rules-runtime rebaseline: server-owned catalogue/source/definition foundation.
CREATE TABLE IF NOT EXISTS public.rules_catalogues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_system_id uuid NOT NULL REFERENCES public.systems (id)
    ON DELETE RESTRICT,
  code text NOT NULL CHECK (char_length(btrim(code)) BETWEEN 1 AND 80),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  description text CHECK (
    description IS NULL
    OR char_length(description) <= 4000
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_system_id, code),
  UNIQUE (id, game_system_id)
);
CREATE TABLE IF NOT EXISTS public.content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_system_id uuid NOT NULL REFERENCES public.systems (id)
    ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('PLATFORM', 'USER')),
  owner_user_id uuid REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  code text CHECK (code IS NULL OR char_length(btrim(code)) BETWEEN 1 AND 80),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  description text CHECK (
    description IS NULL
    OR char_length(description) <= 4000
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'PLATFORM' AND owner_user_id IS NULL AND code IS NOT NULL)
    OR (kind = 'USER' AND owner_user_id IS NOT NULL)
  ),
  UNIQUE (id, game_system_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS content_sources_platform_code_idx ON public.content_sources (
  game_system_id,
  code
)
WHERE kind = 'PLATFORM';
CREATE TABLE IF NOT EXISTS public.rules_catalogue_content_sources (
  catalogue_id uuid NOT NULL,
  content_source_id uuid NOT NULL,
  game_system_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (catalogue_id, content_source_id),
  FOREIGN KEY (
    catalogue_id,
    game_system_id
  ) REFERENCES public.rules_catalogues (id, game_system_id)
    ON DELETE CASCADE,
  FOREIGN KEY (
    content_source_id,
    game_system_id
  ) REFERENCES public.content_sources (id, game_system_id)
    ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.reusable_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_system_id uuid NOT NULL,
  content_source_id uuid NOT NULL,
  definition_family_key text NOT NULL CHECK (
    definition_family_key ~ '^[a-z][a-z0-9.-]{0,79}$'
  ),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  description text CHECK (
    description IS NULL
    OR char_length(description) <= 4000
  ),
  current_document jsonb,
  current_checksum text,
  current_contract_version INTEGER,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (
    content_source_id,
    game_system_id
  ) REFERENCES public.content_sources (id, game_system_id)
    ON DELETE RESTRICT,
  UNIQUE (id, game_system_id),
  CHECK (
    (
      current_document IS NULL
      AND current_checksum IS NULL
      AND current_contract_version IS NULL
      AND published_at IS NULL
      AND published_by IS NULL
    )
    OR (
      current_document IS NOT NULL
      AND current_checksum IS NOT NULL
      AND current_contract_version IS NOT NULL
      AND published_at IS NOT NULL
      AND published_by IS NOT NULL
      AND jsonb_typeof(current_document) = 'object'
      AND current_checksum ~ '^[0-9a-f]{64}$'
      AND current_contract_version BETWEEN 1 AND 10000
    )
  )
);
CREATE TABLE IF NOT EXISTS public.reusable_definition_drafts (
  definition_id uuid PRIMARY KEY,
  game_system_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  base_definition_version INTEGER NOT NULL CHECK (base_definition_version >= 0),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (
    definition_id,
    game_system_id
  ) REFERENCES public.reusable_definitions (id, game_system_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS reusable_definitions_source_idx ON public.reusable_definitions (
  content_source_id,
  id
);
ALTER TABLE public.rules_catalogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules_catalogues FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rules_catalogues FROM anon, authenticated;
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sources FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.content_sources FROM anon, authenticated;
ALTER TABLE public.rules_catalogue_content_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules_catalogue_content_sources FORCE ROW LEVEL SECURITY;
REVOKE ALL
ON TABLE public.rules_catalogue_content_sources
FROM anon, authenticated;
ALTER TABLE public.reusable_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reusable_definitions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reusable_definitions FROM anon, authenticated;
ALTER TABLE public.reusable_definition_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reusable_definition_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reusable_definition_drafts FROM anon, authenticated;
SELECT public.apply_updated_at_triggers();
