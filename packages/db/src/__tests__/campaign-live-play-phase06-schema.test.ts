import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
const media = read('packages/db/src/domains/subjects/tables/media.sql')
const notifications = read('packages/db/src/domains/notifications/tables/notifications.sql')
const migration = read('supabase/migrations/20260812170022_phase_06_live_campaign_play.sql')
const directSharesMigration = read('supabase/migrations/20260822020730_campaign_content_shares.sql')
const bundle = read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql')

const normalizeSql = (source: string) =>
  source.replace(/\s+/gu, ' ').replace(/\(\s+/gu, '(').replace(/\s+\)/gu, ')').trim().toLowerCase()

describe('Phase 06 Campaign play persistence', () => {
  it('keeps server-owned tables protected', () => {
    for (const table of [
      'campaign_play_settings',
      'campaign_vehicles',
      'campaign_attachments',
      'campaign_clock_segments',
      'campaign_announcements'
    ]) {
      for (const source of [canonical, migration, bundle].map(normalizeSql)) {
        expect(source).toContain(`public.${table}`)
        expect(source).toContain(`alter table public.${table} enable row level security`)
        expect(source).toContain(`alter table public.${table} force row level security`)
        expect(source).toContain(`revoke all on table public.${table} from anon, authenticated`)
      }
    }
  })

  it('references current Vehicle roots and generates one Vehicle inventory owner', () => {
    for (const source of [canonical, bundle].map(normalizeSql)) {
      expect(source).toContain(
        'vehicle_definition_id uuid not null references public.vehicles (id) on delete restrict'
      )
      expect(source).not.toContain('content_version_id')
      expect(source).toContain('inventory_owners_vehicle_idx')
      expect(source).toContain('campaign_vehicles_create_inventory_owner')
    }
    const normalizedMigration = normalizeSql(directSharesMigration)
    expect(normalizedMigration).toContain('drop column if exists content_version_id')
    expect(normalizedMigration).toContain(
      'add column vehicle_definition_id uuid not null references public.vehicles (id) on delete restrict'
    )
  })

  it('keeps attachments Campaign-scoped and protects ready asset references', () => {
    for (const source of [canonical, migration, bundle].map(normalizeSql)) {
      expect(source).toContain('foreign key (session_id, campaign_id)')
      expect(source).toContain('foreign key (note_section_id, campaign_id)')
      expect(source).toContain('campaign_attachments_validate_ready')
      expect(source).toContain('media_assets_protect_campaign_reference')
    }
    expect(media).toContain("'CAMPAIGN_FILE', 'CAMPAIGN_HANDOUT_MAP'")
    expect(media).toContain("'image/jpeg', 'image/png', 'image/webp', 'text/plain'")
  })

  it('persists correction audit, monotonic segments, and announcement delivery vocabulary', () => {
    for (const source of [canonical, migration, bundle].map(normalizeSql)) {
      expect(source).toContain('correction_reason text')
      expect(source).toContain('campaign_clock_segments_one_open_idx')
      expect(source).toContain("command_type in ('rewind_clock', 'reset_clock')")
      expect(source).toContain(
        "command_type in ('rewind_clock', 'reset_clock') and correction_reason is not null"
      )
      expect(source).toContain('campaign_announcements_immutable')
      expect(source).toContain('unique (campaign_id, command_id)')
    }
    for (const source of [notifications, migration, bundle].map(normalizeSql)) {
      expect(source).toContain("'campaign-announcement'")
      expect(source).toContain("'campaign_announcement'")
    }
  })
})
