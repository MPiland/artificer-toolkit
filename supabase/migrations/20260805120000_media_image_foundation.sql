CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  profile text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_UPLOAD',
  idempotency_key uuid NOT NULL,
  original_file_name text NOT NULL,
  declared_mime_type text NOT NULL,
  declared_bytes BIGINT NOT NULL,
  raw_object_key text NOT NULL UNIQUE,
  verified_mime_type text,
  verified_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  crop_x NUMERIC,
  crop_y NUMERIC,
  crop_width NUMERIC,
  crop_height NUMERIC,
  rejection_reason text,
  processing_started_at timestamptz,
  ready_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_profile_chk
    CHECK (
      profile IN ('ACCOUNT_AVATAR', 'CHARACTER_PORTRAIT', 'AUTHORED_IMAGE')
    ),
  CONSTRAINT media_assets_status_chk
    CHECK (
      status IN ('PENDING_UPLOAD', 'PROCESSING', 'READY', 'REJECTED', 'DELETED')
    ),
  CONSTRAINT media_assets_declared_mime_type_chk
    CHECK (declared_mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT media_assets_verified_mime_type_chk
    CHECK (
      verified_mime_type IS NULL
      OR verified_mime_type IN ('image/jpeg', 'image/png', 'image/webp')
    ),
  CONSTRAINT media_assets_original_file_name_chk
    CHECK (length(btrim(original_file_name)) BETWEEN 1 AND 255),
  CONSTRAINT media_assets_declared_bytes_chk
    CHECK (declared_bytes BETWEEN 1 AND 6291456),
  CONSTRAINT media_assets_verified_bytes_chk
    CHECK (verified_bytes IS NULL OR verified_bytes > 0),
  CONSTRAINT media_assets_dimensions_chk
    CHECK (
      num_nonnulls(width, height) IN (0, 2)
      AND (width IS NULL OR (width > 0 AND height > 0))
    ),
  CONSTRAINT media_assets_crop_chk
    CHECK (
      num_nonnulls(crop_x, crop_y, crop_width, crop_height) IN (0, 4)
      AND (
        crop_x IS NULL
        OR (
          crop_x >= 0
          AND crop_x <= 1
          AND crop_y >= 0
          AND crop_y <= 1
          AND crop_width > 0
          AND crop_width <= 1
          AND crop_height > 0
          AND crop_height <= 1
          AND crop_x + crop_width <= 1
          AND crop_y + crop_height <= 1
        )
      )
    ),
  CONSTRAINT media_assets_ready_state_chk
    CHECK (
      status != 'READY'
      OR (
        verified_mime_type IS NOT NULL
        AND verified_bytes IS NOT NULL
        AND width IS NOT NULL
        AND height IS NOT NULL
        AND ready_at IS NOT NULL
      )
    ),
  CONSTRAINT media_assets_owner_idempotency_unique
    UNIQUE (owner_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_media_assets_owner_status ON public.media_assets (
  owner_user_id,
  status
);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.media_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.media_assets (id)
    ON DELETE CASCADE,
  kind text NOT NULL,
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size BIGINT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_variants_kind_chk
    CHECK (kind IN ('SOURCE', 'DISPLAY', 'THUMBNAIL')),
  CONSTRAINT media_variants_mime_type_chk
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT media_variants_size_chk CHECK (byte_size > 0),
  CONSTRAINT media_variants_dimensions_chk CHECK (width > 0 AND height > 0),
  CONSTRAINT media_variants_asset_kind_unique UNIQUE (asset_id, kind)
);

ALTER TABLE public.media_variants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.authored_image_slots (
  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,
  scope text NOT NULL,
  asset_id uuid REFERENCES public.media_assets (id)
    ON DELETE SET NULL,
  alt_text text,
  is_decorative BOOLEAN NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_kind, subject_id, scope),
  CONSTRAINT authored_image_slots_route_fk
    FOREIGN KEY (
      subject_kind,
      subject_id
    ) REFERENCES public.authored_route_ids (subject_kind, subject_id)
      ON DELETE CASCADE,
  CONSTRAINT authored_image_slots_subject_kind_chk
    CHECK (
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
  CONSTRAINT authored_image_slots_scope_chk
    CHECK (scope IN ('ACTIVE', 'DRAFT')),
  CONSTRAINT authored_image_slots_alt_text_chk
    CHECK (alt_text IS NULL OR (length(btrim(alt_text)) BETWEEN 1 AND 240)),
  CONSTRAINT authored_image_slots_accessibility_chk
    CHECK (
      (asset_id IS NULL AND alt_text IS NULL AND is_decorative = FALSE)
      OR (
        asset_id IS NOT NULL
        AND (
          (is_decorative = TRUE AND alt_text IS NULL)
          OR (is_decorative = FALSE AND alt_text IS NOT NULL)
        )
      )
    )
);

ALTER TABLE public.authored_image_slots ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_asset_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_avatar_asset_fk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_avatar_asset_fk
      FOREIGN KEY (avatar_asset_id) REFERENCES public.media_assets (id) ON DELETE SET NULL;
  END IF;
END;
$$;

ALTER TABLE public.characters
ADD COLUMN IF NOT EXISTS portrait_asset_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_portrait_asset_fk'
  ) THEN
    ALTER TABLE public.characters
      ADD CONSTRAINT characters_portrait_asset_fk
      FOREIGN KEY (portrait_asset_id) REFERENCES public.media_assets (id) ON DELETE SET NULL;
  END IF;
END;
$$;

INSERT INTO storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'media',
    'media',
    FALSE,
    12582912,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  )
ON CONFLICT (id) DO UPDATE
  SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

SELECT public.apply_updated_at_triggers();

REVOKE ALL
ON TABLE public.media_assets, public.media_variants, public.authored_image_slots
FROM anon, authenticated;
