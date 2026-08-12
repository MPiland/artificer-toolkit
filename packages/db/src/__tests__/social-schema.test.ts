import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8')

const canonical = read('packages/db/src/domains/social/tables/social.sql')
const campaigns = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
const bootstrap = read('packages/db/src/domains/utils/create_database.sql')
const migration = read('supabase/migrations/20260810113601_phase_04_social_hub.sql')
const removeUsAttestation = read(
  'supabase/migrations/20260811162000_remove_social_us_attestation.sql'
)
const generatedTypes = read('packages/db/src/types/supabase.database.ts')

const socialTables = [
  'social_profiles',
  'social_listings',
  'social_applications',
  'social_blocks',
  'social_reports',
  'social_moderation_actions',
  'social_action_rate_limits',
  'campaign_invites'
]

describe('Phase 04 Social Hub schema', () => {
  it('keeps every Social table server-only under forced RLS', () => {
    for (const source of [canonical, migration]) {
      for (const table of socialTables) {
        expect(source).toMatch(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? public\\.${table} \\(`))
        expect(source).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
        expect(source).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`)
        expect(source).toContain(`REVOKE ALL ON TABLE public.${table} FROM anon, authenticated`)
      }
    }
  })

  it('keeps Social persistence constrained without privileged database helpers', () => {
    for (const source of [canonical, migration]) {
      expect(source).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION/i)
      expect(source).not.toMatch(/CREATE(?: OR REPLACE)? VIEW/i)
      expect(source).not.toMatch(/CREATE TRIGGER/i)
      expect(source).not.toMatch(/SECURITY DEFINER/i)
      expect(source).toContain(
        "status IN ('SUBMITTED', 'WITHDRAWN', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'BLOCKED')"
      )
      expect(source).toContain("WHERE status IN ('SUBMITTED', 'ACCEPTED')")
      expect(source).toContain(
        'num_nonnulls(target_profile_id, target_listing_id, target_application_id) = 1'
      )
      expect(source).toContain('CHECK (blocker_profile_id <> blocked_profile_id)')
      expect(source).toContain('PRIMARY KEY (user_id, action_kind, window_kind, window_started_at)')
      expect(source).toContain("content_preference IN ('STANDARD', 'MATURE')")
      expect(source).toContain("content_preference text NOT NULL DEFAULT 'STANDARD'")
      expect(source).not.toContain('birth_date')
      expect(source).not.toContain('date_of_birth')
    }
  })

  it('enforces free listings, location and schedule shapes, and indexed discovery', () => {
    for (const source of [canonical, migration]) {
      expect(source).toContain(
        'CHECK (is_free = true AND price_amount IS NULL AND price_currency IS NULL)'
      )
      expect(source).toContain("play_mode = 'ONLINE' AND city IS NULL AND state_code IS NULL")
      expect(source).toContain("play_mode IN ('IN_PERSON', 'HYBRID')")
      expect(source).toContain("schedule_kind = 'FLEXIBLE'")
      expect(source).toContain("schedule_kind = 'ONE_TIME'")
      expect(source).toContain("schedule_kind = 'RECURRING'")
      expect(source).toContain('social_listings_discovery_cursor_idx')
      expect(source).toContain('(published_at DESC, id DESC)')
      expect(source).toContain('USING gin (search_vector)')
      expect(source).toContain('USING gin (safety_practices)')
    }
  })

  it('removes Campaign visibility and cuts over outstanding token invitations', () => {
    const campaignColumns = campaigns.match(
      /CREATE TABLE IF NOT EXISTS public\.campaigns \(([\s\S]*?)\n\);/
    )?.[1]

    expect(campaignColumns).toBeDefined()
    expect(campaignColumns).not.toContain('visibility')
    expect(campaigns).not.toContain('campaigns_public_active_idx')
    expect(campaigns).not.toContain('CREATE TABLE IF NOT EXISTS public.campaign_invites')
    expect(migration).toContain("SET visibility = 'PRIVATE'")
    expect(migration).toContain('ALTER TABLE public.campaigns DROP COLUMN visibility')
    expect(migration).toContain('DELETE FROM public.campaign_invites')
    expect(migration).toContain('DROP TABLE public.campaign_invites')

    for (const source of [canonical, migration]) {
      expect(source).toContain('campaign_invites_one_pending_idx')
      expect(source).toContain('recipient_user_id uuid NOT NULL')
      expect(source).toContain('recipient_username text NOT NULL')
      expect(source).not.toContain('token_digest')
      expect(source).not.toContain('target_email')
      expect(source).not.toContain("kind IN ('LINK', 'USERNAME', 'EMAIL')")
    }
  })

  it('loads the Social schema after Campaigns and exposes matching generated types', () => {
    expect(bootstrap.indexOf('campaigns/tables/campaigns.sql')).toBeLessThan(
      bootstrap.indexOf('social/tables/social.sql')
    )

    for (const table of socialTables) expect(generatedTypes).toContain(`      ${table}: {`)

    const campaignType = generatedTypes.match(
      /      campaigns: \{([\s\S]*?)\n      [a-z_]+: \{/
    )?.[1]
    expect(campaignType).toBeDefined()
    expect(campaignType).not.toContain('visibility')
    expect(generatedTypes).not.toContain('token_digest:')
    expect(generatedTypes).not.toContain('us_attested_at:')
    expect(canonical).not.toContain('us_attested_at')
    expect(removeUsAttestation).toContain('DROP COLUMN IF EXISTS us_attested_at')
    // Supabase's generated TypeScript uses unknown for PostgreSQL tsvector columns.
    expect(generatedTypes).toContain('search_vector: unknown')
    expect(generatedTypes).toContain('expectations_snapshot: Json')
    expect(generatedTypes).toContain('evidence_snapshot: Json')
  })
})
