import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('media image persistence schema', () => {
  const canonical = read('packages/db/src/domains/subjects/tables/media.sql')
  const generated = read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql')
  const migration = read('supabase/migrations/20260805120000_media_image_foundation.sql')
  const hardening = read('supabase/migrations/20260805130000_media_image_hardening.sql')
  const vttMigration = read('supabase/migrations/20260815212103_phase_08_vtt_scenes.sql')
  const campaignSceneCutover = read('supabase/migrations/20260830090000_campaign_live_scenes.sql')
  const sceneReferenceOptimization = read(
    'supabase/migrations/20260820010000_avoid_unchanged_encounter_scene_map_writes.sql'
  )

  it('keeps canonical, bootstrap, and migration media constraints aligned', () => {
    for (const source of [canonical, generated, migration]) {
      expect(source).toContain('CREATE TABLE IF NOT EXISTS public.media_assets')
      expect(source).toContain('CREATE TABLE IF NOT EXISTS public.media_variants')
      expect(source).toContain('CREATE TABLE IF NOT EXISTS public.authored_image_slots')
      expect(source).toContain("'ACCOUNT_AVATAR', 'CHARACTER_PORTRAIT', 'AUTHORED_IMAGE'")
      expect(source).toContain("'PENDING_UPLOAD', 'PROCESSING', 'READY', 'REJECTED', 'DELETED'")
      expect(source).toContain("'SOURCE', 'DISPLAY', 'THUMBNAIL'")
      expect(source).toContain('media_assets_owner_idempotency_unique')
      expect(source).toContain('num_nonnulls(crop_x, crop_y, crop_width, crop_height) IN (0, 4)')
      expect(source).toContain('media_assets_ready_state_chk')
      expect(source).toContain('ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY')
      expect(source).toContain('ALTER TABLE public.media_variants ENABLE ROW LEVEL SECURITY')
      expect(source).toContain('ALTER TABLE public.authored_image_slots ENABLE ROW LEVEL SECURITY')
      expect(source).toContain("'media'")
      expect(source).not.toMatch(/CREATE POLICY[\s\S]*storage\.objects/i)
    }

    for (const source of [canonical, generated]) {
      expect(source).toMatch(
        /owner_user_id uuid NOT NULL\s+REFERENCES auth\.users \(id\)\s+ON DELETE CASCADE/
      )
      expect(source).toContain('target_key text NOT NULL')
      expect(source).toContain('media_assets_target_key_chk')
      expect(source).toContain('unreferenced_at timestamptz')
      expect(source).toContain('CREATE TABLE IF NOT EXISTS public.media_object_deletions')
      expect(source).toContain(
        'ALTER TABLE public.media_object_deletions ENABLE ROW LEVEL SECURITY'
      )
      expect(source).toContain('sync_media_asset_unreferenced_at')
      expect(source).toContain('enqueue_media_object_deletions')
      expect(source).toContain('BEFORE DELETE ON public.media_assets')
      expect(source).toContain("sync_media_asset_unreferenced_at('avatar_asset_id')")
      expect(source).toContain("sync_media_asset_unreferenced_at('portrait_asset_id')")
      expect(source).toContain("sync_media_asset_unreferenced_at('asset_id')")
      expect(source).toMatch(
        /asset_id uuid\s+REFERENCES public\.media_assets \(id\)\s+ON DELETE CASCADE/
      )
      expect(source).toContain('6291456')
    }

    expect(migration).toMatch(
      /asset_id uuid\s+REFERENCES public\.media_assets \(id\)\s+ON DELETE SET NULL/
    )
    expect(migration).toContain('12582912')
    expect(hardening).toContain('authored_image_slots_asset_id_fkey')
    expect(hardening).toContain('ON DELETE CASCADE')
    expect(hardening).toContain('file_size_limit = 6291456')
    expect(hardening).toContain('DROP CONSTRAINT IF EXISTS media_assets_owner_user_id_fkey')
    expect(hardening).toMatch(
      /FOREIGN KEY \(owner_user_id\)\s+REFERENCES auth\.users \(id\)\s+ON DELETE CASCADE/
    )
    expect(hardening).toContain('enqueue_media_object_deletions')
    expect(hardening).toContain('BEFORE DELETE ON public.media_assets')
    expect(hardening).toContain('ADD COLUMN IF NOT EXISTS target_key text')
    expect(hardening).toContain("profile || ':legacy:' || id")
    expect(hardening).toContain('ALTER COLUMN target_key SET NOT NULL')
    expect(hardening).toContain('media_assets_target_key_chk')
    expect(hardening).toContain('ADD COLUMN IF NOT EXISTS unreferenced_at timestamptz')
    expect(hardening).toContain("WHERE status = 'READY' AND unreferenced_at IS NULL")
    expect(hardening).toContain('CREATE TABLE IF NOT EXISTS public.media_object_deletions')
    expect(hardening).toMatch(
      /REVOKE ALL\s+ON TABLE public\.media_object_deletions\s+FROM anon, authenticated/
    )

    expect(generated).toContain('-- BEGIN INCLUDE: src\\domains\\subjects\\tables\\media.sql')
    expect(canonical).toMatch(
      /ALTER TABLE public\.characters\s+ADD COLUMN IF NOT EXISTS portrait_asset_id uuid/
    )
    expect(canonical).not.toContain('ALTER TABLE public.character_profile\n  ADD COLUMN')
  })

  it('keeps VTT map tiles and scene references protected', () => {
    const encounterTables = read('packages/db/src/domains/encounters/tables/encounters.sql')

    for (const source of [canonical, generated, vttMigration]) {
      expect(source).toContain("'VTT_MAP'")
      expect(source).toContain('vtt_map_tiles')
      expect(source).toContain('26214400')
    }

    for (const source of [encounterTables, generated, vttMigration]) {
      expect(source).toContain('validate_vtt_scene_map_asset')
      expect(source).toContain('campaign_scene_definitions_validate_vtt_map_trigger')
      expect(source).toContain('protect_referenced_vtt_map_asset')
      expect(source).toContain('media_assets_protect_referenced_vtt_map_update_trigger')
      expect(source).toContain('media_assets_protect_referenced_vtt_map_delete_trigger')
      expect(source).toContain('sync_vtt_scene_map_reference')
      expect(source).toContain('campaign_scene_definitions_sync_vtt_map_reference_trigger')
    }

    for (const source of [encounterTables, generated]) {
      expect(source).toContain('sync_campaign_live_scene_map_reference')
      expect(source).toContain('campaign_live_scenes_sync_vtt_map_reference_trigger')
    }

    expect(campaignSceneCutover).toContain('sync_campaign_live_scene_map_reference')
    expect(campaignSceneCutover).toContain('campaign_live_scenes scene')
    expect(campaignSceneCutover).not.toContain('FROM public.encounter_scenes scene')
    expect(campaignSceneCutover).toContain('ADD CONSTRAINT campaign_live_scenes_campaign_fk')
    expect(campaignSceneCutover).toContain(
      'FOREIGN KEY (campaign_id) REFERENCES public.campaigns (id) ON DELETE CASCADE'
    )

    for (const source of [vttMigration]) {
      expect(source).toContain('sync_encounter_scene_map_reference')
      expect(source).toContain('encounter_scenes_sync_vtt_map_reference_trigger')
    }

    for (const source of [encounterTables, sceneReferenceOptimization]) {
      expect(source).toContain(
        "new_asset_id IS NOT NULL AND (TG_OP = 'INSERT' OR old_asset_id IS DISTINCT FROM new_asset_id)"
      )
    }

    expect(canonical).toContain('FROM public.vtt_map_tiles')
  })
})
