ALTER TABLE public.media_assets
ADD COLUMN IF NOT EXISTS target_key text;

ALTER TABLE public.media_assets
DROP CONSTRAINT IF EXISTS media_assets_owner_user_id_fkey,
ADD CONSTRAINT media_assets_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id)
    ON DELETE CASCADE;

UPDATE public.media_assets
SET target_key = profile || ':legacy:' || id
WHERE target_key IS NULL;

ALTER TABLE public.media_assets
ALTER COLUMN target_key SET NOT NULL,
DROP CONSTRAINT IF EXISTS media_assets_target_key_chk,
ADD CONSTRAINT media_assets_target_key_chk
  CHECK (length(btrim(target_key)) > 0),
ADD COLUMN IF NOT EXISTS unreferenced_at timestamptz;

UPDATE public.media_assets
SET unreferenced_at = now()
WHERE status = 'READY' AND unreferenced_at IS NULL;

UPDATE public.media_assets
SET unreferenced_at = NULL
WHERE
  id IN (
    SELECT avatar_asset_id
    FROM public.profiles
    WHERE avatar_asset_id IS NOT NULL
    UNION
    SELECT portrait_asset_id
    FROM public.characters
    WHERE portrait_asset_id IS NOT NULL
    UNION
    SELECT asset_id FROM public.authored_image_slots WHERE asset_id IS NOT NULL
  );

CREATE TABLE IF NOT EXISTS public.media_object_deletions (
  object_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.media_object_deletions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.media_object_deletions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_media_object_deletions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.media_object_deletions (object_key)
  VALUES (OLD.raw_object_key)
  ON CONFLICT (object_key) DO NOTHING;

  INSERT INTO public.media_object_deletions (object_key)
  SELECT object_key
  FROM public.media_variants
  WHERE asset_id = OLD.id
  ON CONFLICT (object_key) DO NOTHING;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS media_assets_enqueue_object_deletions_trigger ON public.media_assets;
CREATE TRIGGER media_assets_enqueue_object_deletions_trigger
BEFORE DELETE ON public.media_assets
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_media_object_deletions();

CREATE OR REPLACE FUNCTION public.sync_media_asset_unreferenced_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_asset_id uuid;
  new_asset_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_asset_id := (to_jsonb(OLD) ->> TG_ARGV[0])::uuid;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_asset_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  END IF;

  IF new_asset_id IS NOT NULL THEN
    UPDATE public.media_assets
    SET unreferenced_at = NULL
    WHERE id = new_asset_id;
  END IF;

  IF old_asset_id IS NOT NULL AND old_asset_id IS DISTINCT FROM new_asset_id THEN
    UPDATE public.media_assets
    SET unreferenced_at = COALESCE(unreferenced_at, now())
    WHERE id = old_asset_id
      AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE avatar_asset_id = old_asset_id)
      AND NOT EXISTS (SELECT 1 FROM public.characters WHERE portrait_asset_id = old_asset_id)
      AND NOT EXISTS (SELECT 1 FROM public.authored_image_slots WHERE asset_id = old_asset_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_media_asset_reference_trigger ON public.profiles;
CREATE TRIGGER profiles_media_asset_reference_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_media_asset_unreferenced_at('avatar_asset_id');

DROP TRIGGER IF EXISTS characters_media_asset_reference_trigger ON public.characters;
CREATE TRIGGER characters_media_asset_reference_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.characters
FOR EACH ROW
EXECUTE FUNCTION public.sync_media_asset_unreferenced_at('portrait_asset_id');

DROP TRIGGER IF EXISTS authored_image_slots_media_asset_reference_trigger ON public.authored_image_slots;
CREATE TRIGGER authored_image_slots_media_asset_reference_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.authored_image_slots
FOR EACH ROW
EXECUTE FUNCTION public.sync_media_asset_unreferenced_at('asset_id');

ALTER TABLE public.authored_image_slots
DROP CONSTRAINT IF EXISTS authored_image_slots_asset_id_fkey;

ALTER TABLE public.authored_image_slots
ADD CONSTRAINT authored_image_slots_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES public.media_assets (id)
    ON DELETE CASCADE;

UPDATE storage.buckets
SET file_size_limit = 6291456
WHERE id = 'media';
