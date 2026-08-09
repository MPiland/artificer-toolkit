import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('Campaign Realtime authorization schema', () => {
  const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
  const conversationsMigration = read(
    'supabase/migrations/20260807161701_campaign_conversations.sql'
  )

  it('authorizes exact owner topics only for active Campaign owners', () => {
    const ownerPredicate =
      "':owner:' || membership.user_id || ':' || ((extract(epoch FROM date_trunc('milliseconds', membership.access_started_at)) * 1000)::bigint)::text AND membership.role = 'OWNER'"

    expect(canonical).toContain(ownerPredicate)
    expect(conversationsMigration).toContain(ownerPredicate)
  })
})
