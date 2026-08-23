import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function normalizeSql(source: string): string {
  return source
    .replace(/\s+/gu, ' ')
    .replace(/\(\s+/gu, '(')
    .replace(/\s+\)/gu, ')')
    .trim()
    .toLowerCase()
}

describe('Campaign Realtime authorization schema', () => {
  const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
  const userTopicsMigration = read(
    'supabase/migrations/20260809020000_campaign_user_realtime_topics.sql'
  )
  const bundle = read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql')

  it('authorizes exact user topics for every active Campaign member while owner topics remain owner-only', () => {
    const ownerPredicate = normalizeSql(
      "':owner:' || membership.user_id || ':' || ((extract(epoch FROM date_trunc('milliseconds', membership.access_started_at)) * 1000)::bigint)::text AND membership.role = 'OWNER'"
    )
    const userPredicate = normalizeSql(
      "requested_topic = 'campaign:' || membership.campaign_id || ':user:' || membership.user_id || ':' || ((extract(epoch FROM date_trunc('milliseconds', membership.access_started_at)) * 1000)::bigint)::text"
    )

    for (const schema of [canonical, userTopicsMigration, bundle]) {
      const normalized = normalizeSql(schema)
      expect(normalized).toContain(ownerPredicate)
      expect(normalized).toContain(userPredicate)
    }
  })
})
