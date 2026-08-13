import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
const media = read('packages/db/src/domains/subjects/tables/media.sql')
const notifications = read('packages/db/src/domains/notifications/tables/notifications.sql')
const migration = read('supabase/migrations/20260812170022_phase_06_live_campaign_play.sql')
const bundle = read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql')

describe('Phase 06 Campaign play persistence', () => {
  it('keeps server-owned tables protected', () => {
    for (const table of [
      'campaign_play_settings',
      'campaign_vehicles',
      'campaign_attachments',
      'campaign_clock_segments',
      'campaign_announcements'
    ]) {
      for (const source of [canonical, migration, bundle]) {
        expect(source).toContain(`public.${table}`)
        expect(source).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
        expect(source).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`)
        expect(source).toContain(`REVOKE ALL ON TABLE public.${table} FROM anon, authenticated`)
      }
    }
  })

  it('pins approved Vehicle revisions and generates one Vehicle inventory owner', () => {
    for (const source of [canonical, migration, bundle]) {
      expect(source).toContain("version.subject_kind = 'VEHICLE'")
      expect(source).toContain("version.state = 'APPROVED'")
      expect(source).toContain('inventory_owners_vehicle_idx')
      expect(source).toContain('campaign_vehicles_create_inventory_owner')
    }
  })

  it('keeps attachments Campaign-scoped and protects ready asset references', () => {
    for (const source of [canonical, migration, bundle]) {
      expect(source).toContain('FOREIGN KEY (session_id, campaign_id)')
      expect(source).toContain('FOREIGN KEY (note_section_id, campaign_id)')
      expect(source).toContain('campaign_attachments_validate_ready')
      expect(source).toContain('media_assets_protect_campaign_reference')
    }
    expect(media).toContain("'CAMPAIGN_FILE', 'CAMPAIGN_HANDOUT_MAP'")
    expect(media).toContain("'image/jpeg', 'image/png', 'image/webp', 'text/plain'")
  })

  it('persists correction audit, monotonic segments, and announcement delivery vocabulary', () => {
    for (const source of [canonical, migration, bundle]) {
      expect(source).toContain('correction_reason text')
      expect(source).toContain('campaign_clock_segments_one_open_idx')
      expect(source).toContain("command_type IN ('REWIND_CLOCK', 'RESET_CLOCK')")
      expect(source).toContain(
        "command_type IN ('REWIND_CLOCK', 'RESET_CLOCK') AND correction_reason IS NOT NULL"
      )
      expect(source).toContain('campaign_announcements_immutable')
      expect(source).toContain('UNIQUE (campaign_id, command_id)')
    }
    for (const source of [notifications, migration, bundle]) {
      expect(source).toContain("'campaign-announcement'")
      expect(source).toContain("'CAMPAIGN_ANNOUNCEMENT'")
    }
  })
})
