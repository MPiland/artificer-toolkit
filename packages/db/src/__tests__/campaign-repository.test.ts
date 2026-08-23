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

  it('qualifies joined archive version increments with their target aliases', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages/db/src/repositories/campaignLifecycle.ts'),
      'utf8'
    )
    const applicationsStart = source.indexOf('update social_applications application')
    const invitesStart = source.indexOf('update campaign_invites invite')

    expect(applicationsStart).toBeGreaterThan(-1)
    expect(invitesStart).toBeGreaterThan(applicationsStart)

    const applicationsUpdate = source.slice(applicationsStart, invitesStart)
    const invitesUpdate = source.slice(invitesStart)

    expect(applicationsUpdate).toContain('version = application.version + 1')
    expect(applicationsUpdate).not.toContain('version = version + 1')
    expect(invitesUpdate).toContain('version = invite.version + 1')
    expect(invitesUpdate).not.toContain('version = version + 1')
  })

  it('keeps invite identity lookup nonlocking before the exact mutation lock', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages/db/src/repositories/campaignInvites.ts'),
      'utf8'
    )
    const findStart = source.indexOf('async findInviteById')
    const lockStart = source.indexOf('async lockInvite')

    expect(findStart).toBeGreaterThan(-1)
    expect(lockStart).toBeGreaterThan(findStart)
    expect(source.slice(findStart, lockStart)).not.toContain('for update')
    expect(source.slice(lockStart)).toContain('for update of invite')
  })
})
