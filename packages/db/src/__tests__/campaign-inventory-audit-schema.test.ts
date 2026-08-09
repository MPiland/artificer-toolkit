import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('Campaign inventory audit schema', () => {
  const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
  const migration = read('supabase/migrations/20260807181000_campaign_party_inventory_audit.sql')

  it('keeps inventory mutations and custody transfers in the owner audit stream', () => {
    for (const kind of [
      'CUSTODY_TRANSFER',
      'PARTY_ITEM_ADD',
      'PARTY_ITEM_UPDATE',
      'PARTY_ITEM_CONSUME',
      'PARTY_ITEM_REMOVE',
      'PARTY_CURRENCY_ADJUST'
    ]) {
      expect(canonical).toContain(`'${kind}'`)
      expect(migration).toContain(`'${kind}'`)
    }
    expect(migration).toContain("SET visibility = 'OWNER'")
  })

  it('prunes owner inventory audit events after 180 days in the database', () => {
    expect(canonical).toContain('prune_campaign_inventory_audit_events')
    expect(canonical).toContain("interval '180 days'")
    expect(canonical).toContain('campaign_events_prune_inventory_audit')
    expect(migration).toContain("interval '180 days'")
    expect(migration).toContain('AFTER INSERT ON public.campaign_events')
  })
})
