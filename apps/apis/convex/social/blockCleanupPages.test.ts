import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import {
  socialStoredApplicationSchema,
  socialStoredListingSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { fixture } from '../../tests/fixtures/socialWriters'
import { api } from '../_generated/api'

const cleanup = makeFunctionReference<
  'mutation',
  {
    firstProfileId: string
    secondProfileId: string
    firstUserId: string
    secondUserId: string
    generation: number
    invalidatedAt: string
    phase: 'APPLICATION_FIRST' | 'APPLICATION_SECOND' | 'INVITATION_FIRST' | 'INVITATION_SECOND'
    cursor: string | null
  },
  null
>('social/blockCleanup:run')

describe('native Social block cleanup paging', () => {
  it('pages every phase and keeps the snapshot pair after counterpart profile deletion', async () => {
    vi.useFakeTimers()
    try {
      const base = await fixture()
      const unrelated = await base.addActor('CleanupUnrelated')
      const participantCampaign = await base.other.caller.mutation(api.campaigns.create.create, {
        name: 'Participant cleanup campaign',
        format: 'ONGOING',
        toneTags: ['HEROIC'],
        contentMaturity: 'STANDARD',
        gameSystemId: base.listing.system.systemId,
        primaryRulesCatalogueId: base.campaign.primaryRulesCatalogueId
      })
      const unrelatedCampaign = await unrelated.caller.mutation(api.campaigns.create.create, {
        name: 'Unrelated cleanup campaign',
        format: 'ONGOING',
        toneTags: ['HEROIC'],
        contentMaturity: 'STANDARD',
        gameSystemId: base.listing.system.systemId,
        primaryRulesCatalogueId: base.campaign.primaryRulesCatalogueId
      })
      const eventTime = '2030-04-01T00:00:00.000Z'
      const now = '2030-04-01T00:00:01.000Z'
      const ids = await base.t.run(async (ctx) => {
        const owner = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
        const participant = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
        const unrelatedProfile = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', unrelated.userId))
          .unique()
        if (!owner || !participant || !unrelatedProfile) throw new Error('Missing Social profiles.')
        const [first, second] =
          owner.id < participant.id ? [owner, participant] : [participant, owner]
        const listingForOwner = base.listing.listingPublicId
        const listingForParticipant = crypto.randomUUID()
        const unrelatedListing = crypto.randomUUID()
        const listing = {
          summary: 'A paged cleanup table',
          audience: 'PUBLIC' as const,
          systemId: base.listing.system.systemId,
          playMode: 'ONLINE' as const,
          capacity: 100,
          schedule: { kind: 'FLEXIBLE' as const, timeZone: 'America/Chicago', summary: 'Flexible' },
          location: null,
          expectations: base.listing.expectations,
          status: 'OPEN' as const,
          moderationStatus: 'VISIBLE' as const,
          publishedAt: now,
          version: 1,
          createdAt: now,
          updatedAt: now
        }
        await ctx.db.insert(
          'socialListings',
          socialStoredListingSchema.parse({
            ...listing,
            id: listingForParticipant,
            campaignId: participantCampaign.id,
            ownerUserId: base.other.userId
          })
        )
        await ctx.db.insert(
          'socialListings',
          socialStoredListingSchema.parse({
            ...listing,
            id: unrelatedListing,
            campaignId: unrelatedCampaign.id,
            ownerUserId: unrelated.userId
          })
        )
        await ctx.db.insert('socialBlockInvalidations', {
          firstProfileId: first.id,
          secondProfileId: second.id,
          firstUserId: first.userId,
          secondUserId: second.userId,
          generation: 1,
          invalidatedAt: eventTime
        })
        await ctx.db.insert('campaignMemberships', {
          campaignId: base.campaign.id,
          userId: base.other.userId,
          role: 'PLAYER',
          status: 'ACTIVE',
          accessStartedAt: now,
          joinedAt: now,
          leftAt: null
        })
        const applicationIds: string[] = []
        const invitationIds: string[] = []
        for (let index = 0; index < 45; index += 1) {
          const submittedAt = new Date(Date.parse(now) + index * 1_000).toISOString()
          const ownerApplicationId = crypto.randomUUID()
          const participantApplicationId = crypto.randomUUID()
          applicationIds.push(ownerApplicationId, participantApplicationId)
          await ctx.db.insert(
            'socialApplications',
            socialStoredApplicationSchema.parse({
              id: ownerApplicationId,
              listingId: listingForOwner,
              applicantProfileId: participant.id,
              message: `Owner listing application ${index}`,
              status: 'SUBMITTED',
              listingVersion: base.listing.version,
              expectationsSnapshot: base.listing.expectations,
              submittedAt,
              respondedAt: null,
              withdrawnAt: null,
              expiredAt: null,
              blockedAt: null,
              blockGeneration: 0,
              version: 1,
              createdAt: submittedAt,
              updatedAt: submittedAt
            })
          )
          await ctx.db.insert(
            'socialApplications',
            socialStoredApplicationSchema.parse({
              id: participantApplicationId,
              listingId: listingForParticipant,
              applicantProfileId: owner.id,
              message: `Participant listing application ${index}`,
              status: 'SUBMITTED',
              listingVersion: 1,
              expectationsSnapshot: listing.expectations,
              submittedAt,
              respondedAt: null,
              withdrawnAt: null,
              expiredAt: null,
              blockedAt: null,
              blockGeneration: 0,
              version: 1,
              createdAt: submittedAt,
              updatedAt: submittedAt
            })
          )
          const ownerInviteId = crypto.randomUUID()
          const participantInviteId = crypto.randomUUID()
          invitationIds.push(ownerInviteId, participantInviteId)
          for (const [id, listingId, createdBy, recipientUserId, recipientUsername] of [
            [
              ownerInviteId,
              listingForOwner,
              base.owner.userId,
              base.other.userId,
              'AdmissionPlayer'
            ],
            [
              participantInviteId,
              listingForParticipant,
              base.other.userId,
              base.owner.userId,
              'AdmissionHost'
            ]
          ] as const)
            await ctx.db.insert(
              'campaignInvites',
              campaignStoredInviteSchema.parse({
                id,
                listingId,
                createdBy,
                recipientUserId,
                listingVersion: 1,
                recipientUsername,
                status: 'PENDING',
                expiresAt: '2030-04-02T00:00:00.000Z',
                respondedAt: null,
                createdAt: submittedAt,
                updatedAt: submittedAt,
                revokedAt: null,
                expiredAt: null,
                blockGeneration: 0,
                version: 1
              })
            )
        }
        const unchangedApplicationIds: string[] = [crypto.randomUUID(), crypto.randomUUID()]
        await ctx.db.insert(
          'socialApplications',
          socialStoredApplicationSchema.parse({
            id: unchangedApplicationIds[0],
            listingId: crypto.randomUUID(),
            applicantProfileId: participant.id,
            message: 'Missing listing',
            status: 'SUBMITTED',
            listingVersion: 1,
            expectationsSnapshot: base.listing.expectations,
            submittedAt: now,
            respondedAt: null,
            withdrawnAt: null,
            expiredAt: null,
            blockedAt: null,
            blockGeneration: 0,
            version: 1,
            createdAt: now,
            updatedAt: now
          })
        )
        const unchangedInvitationIds: string[] = [
          crypto.randomUUID(),
          crypto.randomUUID(),
          crypto.randomUUID()
        ]
        for (const [id, listingId, createdBy, recipientUserId, blockGeneration] of [
          [
            unchangedInvitationIds[0]!,
            crypto.randomUUID(),
            base.owner.userId,
            base.other.userId,
            0
          ],
          [unchangedInvitationIds[1]!, unrelatedListing, base.owner.userId, base.other.userId, 0],
          [unchangedInvitationIds[2]!, listingForOwner, base.owner.userId, base.other.userId, 1]
        ] as const)
          await ctx.db.insert(
            'campaignInvites',
            campaignStoredInviteSchema.parse({
              id,
              listingId,
              createdBy,
              recipientUserId,
              listingVersion: 1,
              recipientUsername: 'AdmissionPlayer',
              status: 'PENDING',
              expiresAt: '2030-04-02T00:00:00.000Z',
              respondedAt: null,
              createdAt: now,
              updatedAt: now,
              revokedAt: null,
              expiredAt: null,
              blockGeneration,
              version: 1
            })
          )
        await ctx.db.insert(
          'socialApplications',
          socialStoredApplicationSchema.parse({
            id: unchangedApplicationIds[1],
            listingId: unrelatedListing,
            applicantProfileId: participant.id,
            message: 'Unrelated host',
            status: 'SUBMITTED',
            listingVersion: 1,
            expectationsSnapshot: listing.expectations,
            submittedAt: new Date(Date.parse(now) + 100_000).toISOString(),
            respondedAt: null,
            withdrawnAt: null,
            expiredAt: null,
            blockedAt: null,
            blockGeneration: 0,
            version: 1,
            createdAt: now,
            updatedAt: now
          })
        )
        const newGenerationApplicationId = crypto.randomUUID()
        await ctx.db.insert(
          'socialApplications',
          socialStoredApplicationSchema.parse({
            id: newGenerationApplicationId,
            listingId: listingForOwner,
            applicantProfileId: participant.id,
            message: 'New generation',
            status: 'SUBMITTED',
            listingVersion: base.listing.version,
            expectationsSnapshot: base.listing.expectations,
            submittedAt: new Date(Date.parse(now) + 101_000).toISOString(),
            respondedAt: null,
            withdrawnAt: null,
            expiredAt: null,
            blockedAt: null,
            blockGeneration: 1,
            version: 1,
            createdAt: now,
            updatedAt: now
          })
        )
        return {
          first,
          second,
          applicationIds,
          invitationIds,
          unchangedApplicationIds,
          newGenerationApplicationId,
          unchangedInvitationIds
        }
      })
      expect(ids.first.id).not.toBe(ids.first.userId)
      expect(ids.second.id).not.toBe(ids.second.userId)
      const beforeMemberships = await base.t.run((ctx) =>
        ctx.db.query('campaignMemberships').collect()
      )
      const beforeExcluded = await base.t.run(async (ctx) => ({
        applications: (await ctx.db.query('socialApplications').collect()).filter(
          (row) =>
            ids.unchangedApplicationIds.includes(row.id) ||
            row.id === ids.newGenerationApplicationId
        ),
        invitations: (await ctx.db.query('campaignInvites').collect()).filter((row) =>
          ids.unchangedInvitationIds.includes(row.id)
        )
      }))
      await base.t.mutation(cleanup, {
        firstProfileId: ids.first.id,
        secondProfileId: ids.second.id,
        firstUserId: ids.first.userId,
        secondUserId: ids.second.userId,
        generation: 1,
        invalidatedAt: eventTime,
        phase: 'APPLICATION_FIRST',
        cursor: null
      })
      const firstPage = await base.t.run((ctx) => ctx.db.query('socialApplications').collect())
      const eligibleAfterFirstPage = firstPage.filter((row) => ids.applicationIds.includes(row.id))
      expect(
        eligibleAfterFirstPage.filter((row) => row.status === 'BLOCKED').length
      ).toBeLessThanOrEqual(20)
      expect(eligibleAfterFirstPage.some((row) => row.status === 'SUBMITTED')).toBe(true)
      await base.t.run((ctx) => ctx.db.delete(ids.second._id))
      await base.t.finishAllScheduledFunctions(vi.runAllTimers)
      const rows = await base.t.run(async (ctx) => ({
        applications: await ctx.db.query('socialApplications').collect(),
        invitations: await ctx.db.query('campaignInvites').collect(),
        memberships: await ctx.db.query('campaignMemberships').collect()
      }))
      expect(rows.applications.filter((row) => ids.applicationIds.includes(row.id))).toHaveLength(
        90
      )
      expect(rows.invitations.filter((row) => ids.invitationIds.includes(row.id))).toHaveLength(90)
      for (const row of rows.applications.filter((row) => ids.applicationIds.includes(row.id)))
        expect(row).toMatchObject({
          status: 'BLOCKED',
          blockedAt: eventTime,
          updatedAt: eventTime,
          version: 2
        })
      for (const row of rows.invitations.filter((row) => ids.invitationIds.includes(row.id)))
        expect(row).toMatchObject({
          status: 'REVOKED',
          revokedAt: eventTime,
          updatedAt: eventTime,
          version: 2
        })
      expect(
        rows.applications.filter(
          (row) =>
            ids.unchangedApplicationIds.includes(row.id) ||
            row.id === ids.newGenerationApplicationId
        )
      ).toEqual(beforeExcluded.applications)
      expect(rows.invitations.filter((row) => ids.unchangedInvitationIds.includes(row.id))).toEqual(
        beforeExcluded.invitations
      )
      expect(rows.memberships).toEqual(beforeMemberships)
    } finally {
      vi.useRealTimers()
    }
  })
})
