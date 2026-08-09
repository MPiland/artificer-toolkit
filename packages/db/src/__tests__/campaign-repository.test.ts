import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Campaign repository', () => {
  it('keeps locking explicit and stores invite digests instead of raw tokens', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages/db/src/repositories/campaign.ts'),
      'utf8'
    )

    expect(source).toContain('.forUpdate()')
    expect(source).toContain('where token_digest = ${tokenDigest}')
    expect(source).toContain(
      '(campaign_id, created_by, kind, token_digest, target_user_id, target_email, expires_at)'
    )
    expect(source).toContain("membership.status = 'ACTIVE'")
    expect(source).toContain("case when campaign.status = 'ACTIVE' then 0 else 1 end")
    expect(source).not.toContain("campaign.status = 'ACTIVE' and membership.status")
    expect(source).not.toContain('withTransaction')
  })
})
