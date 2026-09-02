ALTER TABLE public.media_assets
ADD COLUMN storage_provider text NOT NULL DEFAULT 'SUPABASE',
ADD COLUMN storage_upload_id text;

ALTER TABLE public.media_assets
ADD CONSTRAINT media_assets_storage_provider_chk
  CHECK (
    storage_provider IN ('SUPABASE', 'R2')
    AND (storage_provider != 'R2' OR profile = 'VTT_MAP')
  ),
ADD CONSTRAINT media_assets_storage_upload_chk
  CHECK (storage_upload_id IS NULL OR storage_provider = 'R2');

ALTER TABLE public.media_object_deletions
ADD COLUMN storage_provider text NOT NULL DEFAULT 'SUPABASE';
ALTER TABLE public.media_object_deletions
ADD CONSTRAINT media_object_deletions_storage_provider_chk
  CHECK (storage_provider IN ('SUPABASE', 'R2'));
ALTER TABLE public.media_object_deletions
DROP CONSTRAINT media_object_deletions_pkey,
ADD PRIMARY KEY (storage_provider, object_key);

CREATE OR REPLACE FUNCTION public.enqueue_media_object_deletions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.media_object_deletions (storage_provider, object_key)
  VALUES (OLD.storage_provider, OLD.raw_object_key)
  ON CONFLICT (storage_provider, object_key) DO NOTHING;

  INSERT INTO public.media_object_deletions (storage_provider, object_key)
  SELECT OLD.storage_provider, object_key
  FROM public.media_variants
  WHERE asset_id = OLD.id
  ON CONFLICT (storage_provider, object_key) DO NOTHING;

  INSERT INTO public.media_object_deletions (storage_provider, object_key)
  SELECT OLD.storage_provider, object_key
  FROM public.vtt_map_tiles
  WHERE asset_id = OLD.id
  ON CONFLICT (storage_provider, object_key) DO NOTHING;

  RETURN OLD;
END;
$$;
