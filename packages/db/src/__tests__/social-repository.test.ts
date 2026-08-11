import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const repositoryPath = join(process.cwd(), 'packages/db/src/repositories')
const readRepository = (path: string) => readFileSync(join(repositoryPath, path), 'utf8')

describe('Social repository', () => {
  it('keeps discovery public, moderated, capacity-derived, stable, and symmetrically blocked', () => {
    const source = readRepository('social/listings.ts')

    expect(source).toContain("listing.status = 'OPEN'")
    expect(source).toContain("listing.audience = 'PUBLIC'")
    expect(source).toContain("listing.moderation_status = 'VISIBLE'")
    expect(source).toContain("host.status = 'ACTIVE'")
    expect(source).toContain('block.blocker_profile_id = ${viewerProfileId}::uuid')
    expect(source).toContain('block.blocked_profile_id = ${viewerProfileId}::uuid')
    expect(source).toContain("membership.role = 'PLAYER'")
    expect(source).toContain("membership.status = 'ACTIVE'")
    expect(source).toContain("websearch_to_tsquery('simple', ${filters.query})")
    expect(source).toContain(
      '(listing.published_at, listing.id) < (${filters.cursor.publishedAt}::timestamptz, ${filters.cursor.listingId}::uuid)'
    )
    expect(source).toContain('order by listing.published_at desc, listing.id desc')
  })

  it('keeps Social and campaign invitation repositories free of bearer credentials', () => {
    const source = [
      readRepository('campaignInvites.ts'),
      readRepository('social/profiles.ts'),
      readRepository('social/listings.ts'),
      readRepository('social/applications.ts'),
      readRepository('social/reports.ts'),
      readRepository('social/moderation.ts'),
      readRepository('social/rateLimits.ts')
    ].join('\n')

    expect(source).not.toContain('token_digest')
    expect(source).not.toContain('raw_token')
    expect(source).not.toContain('target_email')
    expect(source).not.toContain('getAuthEmail')
    expect(source).not.toContain('authorization')
  })

  it('keeps the moderation queue metadata-only and evidence reads separate', () => {
    const reports = readRepository('social/reports.ts')
    const moderation = readRepository('social/moderation.ts')
    const queue = moderation.slice(
      moderation.indexOf('async listSocialModerationQueue'),
      moderation.indexOf('async lockSocialReport')
    )

    expect(queue).not.toContain('evidence_snapshot')
    expect(queue).not.toContain('report.details')
    expect(reports).toContain('async findReportableSocialEvidence')
    expect(moderation).toContain('async insertSocialModerationAction')
  })

  it('counts only open public Social listings for entitlements', () => {
    const source = readRepository('accountEntitlements.ts')

    expect(source).toContain('from social_listings listing')
    expect(source).toContain("listing.status = 'OPEN'")
    expect(source).toContain("listing.audience = 'PUBLIC'")
    expect(source).not.toContain("visibility = 'PUBLIC'")
  })
})
