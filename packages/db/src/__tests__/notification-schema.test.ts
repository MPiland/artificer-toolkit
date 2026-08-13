import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8')

const canonical = read('packages/db/src/domains/notifications/tables/notifications.sql')
const phase05Migration = read('supabase/migrations/20260811010000_phase_05_notifications.sql')
const feedMigration = read('supabase/migrations/20260812222601_supabase_notification_feed.sql')
const profiles = read('packages/db/src/domains/utils/tables/user_management.sql')
const bootstrap = read('packages/db/src/domains/utils/create_database.sql')
const generatedBundle = read(
  'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'
)
const generatedTypes = read('packages/db/src/types/supabase.database.ts')
const repository = read('packages/db/src/repositories/notifications.ts')

describe('notification persistence', () => {
  it('keeps one server-only outbox table under forced RLS', () => {
    for (const source of [canonical, phase05Migration]) {
      expect(source).toMatch(
        /CREATE TABLE(?: IF NOT EXISTS)? public\.notification_delivery_intents \(/
      )
      expect(source).toContain(
        'ALTER TABLE public.notification_delivery_intents ENABLE ROW LEVEL SECURITY'
      )
      expect(source).toContain(
        'ALTER TABLE public.notification_delivery_intents FORCE ROW LEVEL SECURITY'
      )
      expect(source).toContain(
        'REVOKE ALL ON TABLE public.notification_delivery_intents FROM anon, authenticated'
      )
      expect(source).not.toContain('source_version')
    }
  })

  it('constrains identity, idempotency, due work, and terminal state', () => {
    expect(profiles).toContain('notification_recipient_id uuid NOT NULL DEFAULT gen_random_uuid()')
    expect(profiles).toContain('profiles_notification_recipient_id_key')
    for (const source of [canonical, phase05Migration]) {
      expect(source).not.toContain('social-invitation-ended')
      expect(source).toContain(
        'UNIQUE (recipient_notification_id, source_kind, source_public_id, workflow_key, operation)'
      )
      expect(source).toContain('notification_delivery_intents_due_idx')
      expect(source).toContain('WHERE delivered_at IS NULL AND failed_at IS NULL')
      expect(source).toContain('CHECK (attempt_count BETWEEN 0 AND 10)')
      expect(source).toContain('CHECK (num_nonnulls(delivered_at, failed_at) <= 1)')
    }
  })

  it('keeps bootstrap, generated bundle, and database types in parity', () => {
    expect(bootstrap).toContain('notifications/tables/notifications.sql')
    expect(generatedBundle).toMatch(
      /CREATE TABLE(?: IF NOT EXISTS)? public\.notification_delivery_intents \(/
    )
    expect(generatedBundle).toContain(
      'notification_recipient_id uuid NOT NULL DEFAULT gen_random_uuid()'
    )
    expect(generatedTypes).toContain('notification_delivery_intents: {')
    expect(generatedTypes).toContain('notification_recipient_id: string')
  })

  it('keeps feed and preferences private while service-only dispatcher RPCs claim intents', () => {
    for (const source of [canonical, feedMigration]) {
      expect(source).toContain('CREATE TABLE')
      expect(source).toContain('notification_preferences')
      expect(source).toContain('notification_feed_items')
      expect(source).toContain('FORCE ROW LEVEL SECURITY')
      expect(source).toContain(
        'REVOKE ALL ON TABLE public.notification_feed_items FROM anon, authenticated'
      )
      expect(source).toContain(
        'CREATE OR REPLACE FUNCTION public.claim_notification_delivery_intents'
      )
      expect(source).toContain('FOR UPDATE SKIP LOCKED')
      expect(source).toContain(
        'GRANT EXECUTE ON FUNCTION public.claim_notification_delivery_intents'
      )
      expect(source).toContain('TO service_role')
      expect(source).toContain('notification_expire_due_campaign_invites')
      expect(source).toContain('notification_realtime_topics')
      expect(source).toContain("'notifications:' || changed.recipient_user_id::text")
    }
    expect(generatedBundle).toContain('notification_feed_items')
    expect(generatedBundle).toContain('notification_preferences')
  })

  it('claims concurrently, reclaims stale leases, and terminates exhausted claims', () => {
    expect(repository).toContain('for update skip locked')
    expect(repository).toContain('claimed_at <= ${input.staleBefore}::timestamptz')
    expect(repository).toContain('attempt_count = intent.attempt_count + 1')
    expect(repository).toContain('and intent.attempt_count < 10')
    expect(repository).toContain("last_error_code = 'ATTEMPTS_EXHAUSTED'")
    expect(repository).toContain('and attempt_count >= 10')
    expect(repository).toContain("last_error_code = 'SOURCE_CANCELLED'")
    expect(repository).toContain("intent.operation <> 'TRIGGER'")
    expect(repository).toContain("intent.operation <> 'CANCEL'")
  })
})
