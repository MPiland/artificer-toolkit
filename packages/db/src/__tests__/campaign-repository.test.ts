import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Campaign repository', () => {
  it('keeps locking explicit and uses authenticated tokenless invitations', () => {
    const source = [
      'campaignLifecycle.ts',
      'campaignMembership.ts',
      'campaignInvites.ts',
      'campaignOwnershipTransfers.ts'
    ]
      .map((file) =>
        readFileSync(join(process.cwd(), 'packages/db/src/repositories', file), 'utf8')
      )
      .join('\n')

    expect(source).toContain('.forUpdate()')
    expect(source).toContain('where invite.id = ${inviteId}::uuid')
    expect(source).toContain('recipient_user_id, recipient_username')
    expect(source).toContain("and status = 'PENDING'")
    expect(source).not.toContain('token_digest')
    expect(source).not.toContain('target_email')
    expect(source).not.toContain('getAuthEmail')
    expect(source).toContain("membership.status = 'ACTIVE'")
    expect(source).toContain("case when campaign.status = 'ACTIVE' then 0 else 1 end")
    expect(source).not.toContain("campaign.status = 'ACTIVE' and membership.status")
    expect(source).not.toContain('withTransaction')
  })
})
