import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CreateSocialReportInput,
  SocialReportReceiptDto,
  SubmitSocialApplicationInput,
  SocialApplicationDto
} from '@artificer-toolkit/schema/api/socialHub'
import { fixture } from '../../tests/fixtures/socialWriters'
import { fixture as admissionFixture } from '../../tests/fixtures/socialAdmission'
import { api } from '../_generated/api'
import * as rateLimits from './rateLimits'

const create = makeFunctionReference<
  'mutation',
  { input: CreateSocialReportInput },
  SocialReportReceiptDto
>('social/reports:create')
const submit = makeFunctionReference<
  'mutation',
  SubmitSocialApplicationInput,
  SocialApplicationDto
>('social/applications:submit')

async function setup() {
  const base = await fixture()
  const profiles = await base.t.run((ctx) => ctx.db.query('socialProfiles').take(3))
  const host = profiles.find((profile) => profile.userId === base.owner.userId)!
  const player = profiles.find((profile) => profile.userId === base.other.userId)!
  const snapshot = () =>
    base.t.run(async (ctx) => ({
      reports: await ctx.db.query('socialReports').take(30),
      rates: await ctx.db.query('socialActionRateLimits').take(30)
    }))
  return { ...base, host, player, reportSnapshot: snapshot }
}

describe('native Social report capture', () => {
  it('returns only receipts and captures bounded, unmasked server evidence for every target kind', async () => {
    const base = await setup()
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'CurrentHost',
      bio: 'PRIVATE ACCOUNT BIO'
    })
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'A shitstorm application'
    })
    for (const [targetKind, targetPublicId] of [
      ['PROFILE', base.host.id],
      ['LISTING', base.listing.listingPublicId],
      ['APPLICATION', application.applicationPublicId]
    ] as const) {
      const receipt = await base.other.caller.mutation(create, {
        input: {
          targetKind,
          targetPublicId: targetPublicId.toUpperCase(),
          reason: 'OTHER',
          details: '  Report details  '
        }
      })
      expect(Object.keys(receipt).sort()).toEqual(['createdAt', 'reportPublicId', 'status'])
      expect(receipt.status).toBe('SUBMITTED')
    }
    const before = await base.reportSnapshot()
    expect(before.reports).toHaveLength(3)
    const reportsForListing = await base.t.run((ctx) =>
      ctx.db
        .query('socialReports')
        .withIndex('by_evidenceListingPublicId', (q) =>
          q.eq('evidenceSnapshot.listingPublicId', base.listing.listingPublicId)
        )
        .collect()
    )
    expect(reportsForListing.map((report) => report.id).sort()).toEqual(
      before.reports
        .filter((report) => report.targetKind !== 'PROFILE')
        .map((report) => report.id)
        .sort()
    )
    const evidence = before.reports.map((report) => report.evidenceSnapshot)
    expect(evidence[0]).toEqual({
      profilePublicId: base.host.id,
      username: 'CurrentHost',
      status: 'ACTIVE'
    })
    expect(evidence[1]).toMatchObject({
      listingPublicId: base.listing.listingPublicId,
      title: 'A shitstorm campaign',
      hostUsername: 'CurrentHost',
      expectations: { contentGuidance: 'A shitstorm of adventure' }
    })
    expect(evidence[2]).toMatchObject({
      applicationPublicId: application.applicationPublicId,
      message: 'A shitstorm application',
      hostUsername: 'CurrentHost',
      applicantUsername: 'AdmissionPlayer'
    })
    expect(Object.keys(evidence[1]!).sort()).toEqual([
      'audience',
      'capturedAt',
      'contentMaturity',
      'expectations',
      'format',
      'hostProfilePublicId',
      'hostUsername',
      'listingPublicId',
      'location',
      'moderationStatus',
      'playMode',
      'schedule',
      'status',
      'summary',
      'systemId',
      'title',
      'toneDetails',
      'toneTags',
      'version'
    ])
    expect(Object.keys(evidence[2]!).sort()).toEqual([
      'applicantProfilePublicId',
      'applicantUsername',
      'applicationPublicId',
      'capturedAt',
      'expectations',
      'hostProfilePublicId',
      'hostUsername',
      'listingPublicId',
      'listingTitle',
      'listingVersion',
      'message',
      'respondedAt',
      'status',
      'submittedAt',
      'version'
    ])
    for (const report of before.reports) {
      expect(report).toMatchObject({
        reporterProfileId: base.player.id,
        details: 'Report details',
        version: 0,
        queuePriority: 0
      })
      expect(JSON.stringify(report.evidenceSnapshot)).not.toContain(base.owner.userId)
      expect(JSON.stringify(report.evidenceSnapshot)).not.toContain(base.campaign.id)
      expect(JSON.stringify(report.evidenceSnapshot)).not.toContain('PRIVATE ACCOUNT BIO')
      expect(JSON.stringify(report.evidenceSnapshot)).not.toContain('@example.invalid')
    }
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'RenamedHost',
      bio: null
    })
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
        .unique()
      if (!row) throw new Error('Missing application.')
      await ctx.db.patch(row._id, { message: 'Changed later' })
    })
    expect((await base.reportSnapshot()).reports).toEqual(before.reports)
  })

  it('rejects forged evidence, identity, rate overrides and invalid or oversized input without writes', async () => {
    const base = await setup()
    const input = {
      targetKind: 'PROFILE',
      targetPublicId: base.host.id,
      reason: 'OTHER',
      details: 'Report'
    } as const
    const forged = makeFunctionReference<
      'mutation',
      { input: Record<string, unknown> },
      SocialReportReceiptDto
    >('social/reports:create')
    const before = await base.reportSnapshot()
    for (const extra of [
      { evidenceSnapshot: { username: 'Forged' } },
      { reporterProfileId: base.host.id },
      { rateLimit: 100 },
      { details: 'x'.repeat(4001) },
      { details: ' ' },
      { targetPublicId: 'invalid' },
      { targetKind: 'CAMPAIGN' }
    ])
      await expect(
        base.other.caller.mutation(forged, { input: { ...input, ...extra } })
      ).rejects.toThrow()
    await expect(base.t.mutation(create, { input })).rejects.toThrow('Unauthenticated')
    await expect(
      base.other.caller.mutation(create, {
        input: { ...input, targetPublicId: crypto.randomUUID() }
      })
    ).rejects.toThrow('not found')
    await expect(
      base.other.caller.mutation(create, { input: { ...input, targetPublicId: base.player.id } })
    ).rejects.toThrow('not found')
    expect(await base.reportSnapshot()).toEqual(before)
    await base.t.run((ctx) => ctx.db.patch(base.player._id, { status: 'SUSPENDED' }))
    await expect(base.other.caller.mutation(create, { input })).rejects.toThrow(
      'active Social profile'
    )
    expect(await base.reportSnapshot()).toEqual(before)
  })

  it.each([true, false])(
    'permits a suspended profile only with an existing block (host blocks player=%s)',
    async (hostBlocksPlayer) => {
      const base = await setup()
      const input = {
        targetKind: 'PROFILE',
        targetPublicId: base.host.id,
        reason: 'HARASSMENT',
        details: 'Report'
      } as const
      await base.t.run((ctx) => ctx.db.patch(base.host._id, { status: 'SUSPENDED' }))
      await expect(base.other.caller.mutation(create, { input })).rejects.toThrow('not found')
      await base.t.run((ctx) =>
        ctx.db.insert('socialBlocks', {
          blockerProfileId: hostBlocksPlayer ? base.host.id : base.player.id,
          blockedProfileId: hostBlocksPlayer ? base.player.id : base.host.id,
          createdAt: new Date().toISOString()
        })
      )
      await expect(base.other.caller.mutation(create, { input })).resolves.toMatchObject({
        status: 'SUBMITTED'
      })
    }
  )

  it.each(['CLOSED', 'PRIVATE', 'HIDDEN', 'ARCHIVED', 'SUSPENDED', 'BLOCKED'] as const)(
    'denies unrelated listing reporters when the current source is %s',
    async (state) => {
      const base = await setup()
      await base.t.run(async (ctx) => {
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
          .unique()
        const campaign = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
          .unique()
        if (!listing || !campaign) throw new Error('Missing source.')
        if (state === 'CLOSED') await ctx.db.patch(listing._id, { status: 'CLOSED' })
        if (state === 'PRIVATE') await ctx.db.patch(listing._id, { audience: 'PRIVATE' })
        if (state === 'HIDDEN') await ctx.db.patch(listing._id, { moderationStatus: 'HIDDEN' })
        if (state === 'ARCHIVED') await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
        if (state === 'SUSPENDED') await ctx.db.patch(base.host._id, { status: 'SUSPENDED' })
        if (state === 'BLOCKED')
          await ctx.db.insert('socialBlocks', {
            blockerProfileId: base.host.id,
            blockedProfileId: base.player.id,
            createdAt: new Date().toISOString()
          })
      })
      const before = await base.reportSnapshot()
      await expect(
        base.other.caller.mutation(create, {
          input: {
            targetKind: 'LISTING',
            targetPublicId: base.listing.listingPublicId,
            reason: 'OTHER',
            details: 'Report'
          }
        })
      ).rejects.toThrow('not found')
      expect(await base.reportSnapshot()).toEqual(before)
    }
  )

  it.each(['OWNER', 'APPLICATION', 'INVITATION'] as const)(
    'retains %s listing-report authority for closed, hidden, private, archived sources',
    async (relationship) => {
      const base = await admissionFixture()
      await base.t.run(async (ctx) => {
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
          .unique()
        const campaign = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
          .unique()
        const host = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
        const player = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
        if (!listing || !campaign || !host || !player) throw new Error('Missing source.')
        await ctx.db.patch(listing._id, {
          status: 'CLOSED',
          audience: 'PRIVATE',
          moderationStatus: 'HIDDEN'
        })
        await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
        if (relationship !== 'OWNER') await ctx.db.patch(host._id, { status: 'SUSPENDED' })
        await ctx.db.insert('socialBlocks', {
          blockerProfileId: host.id,
          blockedProfileId: player.id,
          createdAt: campaign.updatedAt
        })
        for (const row of await ctx.db.query('socialApplications').take(3)) {
          if (relationship === 'INVITATION') await ctx.db.delete(row._id)
          else await ctx.db.patch(row._id, { status: 'WITHDRAWN', withdrawnAt: campaign.updatedAt })
        }
        for (const row of await ctx.db.query('campaignInvites').take(3)) {
          if (relationship === 'APPLICATION') await ctx.db.delete(row._id)
          else await ctx.db.patch(row._id, { status: 'DECLINED', respondedAt: campaign.updatedAt })
        }
      })
      await expect(
        (relationship === 'OWNER' ? base.owner : base.other).caller.mutation(create, {
          input: {
            targetKind: 'LISTING',
            targetPublicId: base.listingId,
            reason: 'OTHER',
            details: 'Historical report'
          }
        })
      ).resolves.toMatchObject({ status: 'SUBMITTED' })
    }
  )

  it.each(['OWNER', 'APPLICANT'] as const)(
    'allows the %s to report a blocked application with the other profile suspended',
    async (reporter) => {
      const base = await setup()
      const application = await base.other.caller.mutation(submit, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        message: 'Application'
      })
      const outsider = await base.addActor('ReportOutsider')
      const input = {
        targetKind: 'APPLICATION',
        targetPublicId: application.applicationPublicId,
        reason: 'OTHER',
        details: 'Report'
      } as const
      await expect(outsider.caller.mutation(create, { input })).rejects.toThrow('not found')
      await base.t.run(async (ctx) => {
        await ctx.db.patch((reporter === 'OWNER' ? base.player : base.host)._id, {
          status: 'SUSPENDED'
        })
        await ctx.db.insert('socialBlocks', {
          blockerProfileId: base.host.id,
          blockedProfileId: base.player.id,
          createdAt: new Date().toISOString()
        })
        const row = await ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
          .unique()
        if (!row) throw new Error('Missing application.')
        await ctx.db.patch(row._id, { status: 'BLOCKED', blockedAt: new Date().toISOString() })
      })
      await expect(
        (reporter === 'OWNER' ? base.owner : base.other).caller.mutation(create, { input })
      ).resolves.toMatchObject({ status: 'SUBMITTED' })
    }
  )

  it('uses the current Campaign owner, not the former owner, for application report authority', async () => {
    const base = await setup()
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Application before transfer'
    })
    const successor = await base.addActor('SuccessorHost')
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
        .unique()
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
        )
        .unique()
      if (!campaign || !listing || !membership) throw new Error('Missing transfer source.')
      await ctx.db.patch(campaign._id, { ownerUserId: successor.userId })
      await ctx.db.patch(listing._id, { ownerUserId: successor.userId })
      await ctx.db.patch(membership._id, { role: 'PLAYER' })
      await ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: successor.userId,
        role: 'OWNER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    })
    const input = {
      targetKind: 'APPLICATION',
      targetPublicId: application.applicationPublicId,
      reason: 'OTHER',
      details: 'Report after transfer'
    } as const
    const before = await base.reportSnapshot()
    await expect(base.owner.caller.mutation(create, { input })).rejects.toThrow('not found')
    expect(await base.reportSnapshot()).toEqual(before)
    await expect(successor.caller.mutation(create, { input })).resolves.toMatchObject({
      status: 'SUBMITTED'
    })
    await expect(base.other.caller.mutation(create, { input })).resolves.toMatchObject({
      status: 'SUBMITTED'
    })
    expect((await base.reportSnapshot()).reports[0]?.evidenceSnapshot).toMatchObject({
      hostUsername: 'SuccessorHost'
    })
  })

  it('enforces five reports per hour across targets and rolls back late errors and day-limit failures', async () => {
    const base = await setup()
    const input = {
      targetKind: 'PROFILE',
      targetPublicId: base.host.id,
      reason: 'OTHER',
      details: 'Report'
    } as const
    const before = await base.reportSnapshot()
    const consume = rateLimits.consumeSocialRateLimit
    const fault = vi
      .spyOn(rateLimits, 'consumeSocialRateLimit')
      .mockImplementationOnce(async (...args) => {
        await consume(...args)
        throw new Error('Injected post-counter failure')
      })
    try {
      await expect(base.other.caller.mutation(create, { input })).rejects.toThrow(
        'Injected post-counter failure'
      )
    } finally {
      fault.mockRestore()
    }
    expect(await base.reportSnapshot()).toEqual(before)
    for (let index = 0; index < 5; index++) {
      await base.other.caller.mutation(create, {
        input:
          index % 2 === 0
            ? input
            : {
                ...input,
                targetKind: 'LISTING',
                targetPublicId: base.listing.listingPublicId
              }
      })
    }
    const full = await base.reportSnapshot()
    expect(full.reports).toHaveLength(5)
    expect(full.rates.filter((row) => row.action === 'REPORT').map((row) => row.count)).toEqual([
      5, 5
    ])
    await expect(base.other.caller.mutation(create, { input })).rejects.toThrow(
      'Too many Social actions'
    )
    expect(await base.reportSnapshot()).toEqual(full)
    await base.t.run(async (ctx) => {
      for (const row of full.rates.filter((row) => row.action === 'REPORT')) {
        await ctx.db.patch(row._id, { count: row.window === 'DAY' ? 19 : 1 })
      }
    })
    await base.other.caller.mutation(create, { input })
    const dayFull = await base.reportSnapshot()
    expect(
      dayFull.rates.find((row) => row.action === 'REPORT' && row.window === 'DAY')?.count
    ).toBe(20)
    await expect(base.other.caller.mutation(create, { input })).rejects.toThrow(
      'Too many Social actions'
    )
    expect(await base.reportSnapshot()).toEqual(dayFull)
  })
})
