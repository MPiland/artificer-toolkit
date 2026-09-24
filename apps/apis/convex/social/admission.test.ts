import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CampaignInviteDto,
  CreateCampaignInviteInput,
  campaignInviteVersionInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  SubmitSocialApplicationInput,
  DecideSocialApplicationInput,
  SocialApplicationDto
} from '@artificer-toolkit/schema/api/socialHub'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { fixture } from '../../tests/fixtures/socialWriters'
import { api } from '../_generated/api'
import * as notifications from '../notifications/intents'
import * as documents from '../campaigns/documents'
import * as projections from './admissionDocuments'

const submit = makeFunctionReference<
  'mutation',
  SubmitSocialApplicationInput,
  SocialApplicationDto
>('social/applications:submit')
const decide = makeFunctionReference<
  'mutation',
  DecideSocialApplicationInput,
  SocialApplicationDto
>('social/applications:decide')
const invite = makeFunctionReference<'mutation', CreateCampaignInviteInput, CampaignInviteDto>(
  'social/invitations:create'
)
const acceptInvite = makeFunctionReference<
  'mutation',
  z.input<typeof campaignInviteVersionInputSchema>,
  CampaignDetailDto
>('social/invitations:accept')

async function setup(kind: 'APPLICATION' | 'INVITATION') {
  const base = await fixture()
  const source =
    kind === 'APPLICATION'
      ? await base.other.caller.mutation(submit, {
          listingPublicId: base.listing.listingPublicId,
          expectedListingVersion: base.listing.version,
          message: 'I enjoy shitstorm adventures.'
        })
      : await base.owner.caller.mutation(invite, {
          listingPublicId: base.listing.listingPublicId,
          expectedListingVersion: base.listing.version,
          username: 'AdmissionPlayer'
        })
  const id = 'applicationPublicId' in source ? source.applicationPublicId : source.invitePublicId
  const accept = (expectedVersion = source.version) =>
    kind === 'APPLICATION'
      ? base.owner.caller.mutation(decide, {
          applicationPublicId: id.toUpperCase(),
          expectedVersion,
          decision: 'ACCEPT'
        })
      : base.other.caller.mutation(acceptInvite, {
          invitePublicId: id.toUpperCase(),
          expectedVersion
        })
  return { ...base, source, id, accept }
}

describe('native shared Social admission transaction', () => {
  it.each(['APPLICATION', 'INVITATION'] as const)(
    'accepts %s once, keeps Campaign root unchanged and replays without writes',
    async (kind) => {
      const base = await setup(kind)
      const before = await base.snapshot()
      const result = await base.accept()
      const after = await base.snapshot()
      expect(after.memberships.filter((member) => member.role === 'PLAYER')).toEqual([
        expect.objectContaining({
          userId: base.other.userId,
          campaignId: base.campaign.id,
          status: 'ACTIVE',
          leftAt: null
        })
      ])
      expect(after.campaigns).toEqual(before.campaigns)
      expect(after.notifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            workflowKey:
              kind === 'APPLICATION'
                ? 'social-application-submitted'
                : 'social-invitation-received',
            status: 'CANCELLED'
          }),
          expect.objectContaining({
            workflowKey:
              kind === 'APPLICATION' ? 'social-application-decided' : 'social-invitation-decided',
            status: 'PENDING'
          })
        ])
      )
      if ('message' in result) {
        expect(result.message).toBe('I enjoy ****storm adventures.')
        const expectations = {
          ...base.listing.expectations,
          contentGuidance: 'A ****storm of adventure'
        }
        expect(result.expectations).toEqual(expectations)
        expect(
          await base.other.caller.query(api.social.applications.getOwn, {
            applicationPublicId: base.id
          })
        ).toMatchObject({ status: 'ACCEPTED', expectations })
      } else expect(result).toMatchObject({ id: base.campaign.id, role: 'PLAYER', playerCount: 1 })
      expect(await base.accept(999)).toEqual(result)
      expect(await base.snapshot()).toEqual(after)
    }
  )

  it('serializes competing application/invitation acceptance for the last seat', async () => {
    const base = await fixture()
    const third = await base.addActor('SecondApplicant')
    await base.t.run(async (ctx) => {
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
        .unique()
      if (!listing) throw new Error('Missing listing.')
      await ctx.db.patch(listing._id, { capacity: 1 })
    })
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Let me join.'
    })
    const invitation = await base.owner.caller.mutation(invite, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'SecondApplicant'
    })
    const results = await Promise.allSettled([
      base.owner.caller.mutation(decide, {
        applicationPublicId: application.applicationPublicId,
        expectedVersion: application.version,
        decision: 'ACCEPT'
      }),
      third.caller.mutation(acceptInvite, {
        invitePublicId: invitation.invitePublicId,
        expectedVersion: invitation.version
      })
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const after = await base.snapshot()
    expect(after.memberships.filter((member) => member.role === 'PLAYER')).toHaveLength(1)
    expect(
      [...after.applications, ...after.invitations].filter((row) => row.status === 'ACCEPTED')
    ).toHaveLength(1)
    expect(after.notifications.filter((row) => row.workflowKey.endsWith('-decided'))).toHaveLength(
      1
    )
  })

  it('accepts both sources for the same already-active player without another seat or access epoch', async () => {
    const base = await setup('APPLICATION')
    const invitation = await base.owner.caller.mutation(invite, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    await base.accept()
    const before = await base.snapshot()
    await base.other.caller.mutation(acceptInvite, {
      invitePublicId: invitation.invitePublicId,
      expectedVersion: invitation.version
    })
    const after = await base.snapshot()
    expect(after.memberships).toEqual(before.memberships)
    expect(after.applications[0]?.status).toBe('ACCEPTED')
    expect(after.invitations[0]?.status).toBe('ACCEPTED')
  })

  it.each(['APPLICATION', 'INVITATION'] as const)(
    'rejects stale %s source/listing versions and current tier exhaustion atomically',
    async (kind) => {
      const base = await setup(kind)
      const before = await base.snapshot()
      await expect(base.accept(base.source.version + 1)).rejects.toThrow('version conflict')
      expect(await base.snapshot()).toEqual(before)
      await base.t.run(async (ctx) => {
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
          .unique()
        if (!listing) throw new Error('Missing listing.')
        await ctx.db.patch(listing._id, { version: listing.version + 1 })
      })
      const changed = await base.snapshot()
      await expect(base.accept()).rejects.toThrow('version conflict')
      expect(await base.snapshot()).toEqual(changed)
      await base.t.run(async (ctx) => {
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
          .unique()
        if (!listing) throw new Error('Missing listing.')
        await ctx.db.patch(listing._id, {
          version: base.listing.version,
          capacity: ENTITLEMENT_LIMITS.FREE.playerSeatsPerCampaign + 1
        })
        for (let index = 0; index < ENTITLEMENT_LIMITS.FREE.playerSeatsPerCampaign; index++) {
          await ctx.db.insert('campaignMemberships', {
            campaignId: base.campaign.id,
            userId: crypto.randomUUID(),
            role: 'PLAYER',
            status: 'ACTIVE',
            accessStartedAt: base.campaign.createdAt,
            joinedAt: base.campaign.createdAt,
            leftAt: null
          })
        }
      })
      const full = await base.snapshot()
      await expect(base.accept()).rejects.toThrow('account player seat limit')
      expect(await base.snapshot()).toEqual(full)
    }
  )

  it.each(['APPLICATION', 'INVITATION'] as const)(
    'does not grant %s authority to the wrong actor or a public UUID',
    async (kind) => {
      const base = await setup(kind)
      const outsider = await base.addActor('OutsideApplicant')
      const before = await base.snapshot()
      const command =
        kind === 'APPLICATION'
          ? outsider.caller.mutation(decide, {
              applicationPublicId: base.id,
              expectedVersion: base.source.version,
              decision: 'ACCEPT'
            })
          : outsider.caller.mutation(acceptInvite, {
              invitePublicId: base.id,
              expectedVersion: base.source.version
            })
      await expect(command).rejects.toThrow('unavailable')
      expect(await base.snapshot()).toEqual(before)
      await expect(
        base.other.caller.query(api.campaigns.queries.get, { id: base.campaign.id })
      ).rejects.toThrow('not found')
    }
  )

  it.each([
    ['APPLICATION', true],
    ['APPLICATION', false],
    ['INVITATION', true],
    ['INVITATION', false]
  ] as const)(
    'rejects %s acceptance and replay with host-blocks-player=%s, without removing members',
    async (kind, hostBlocksPlayer) => {
      const base = await setup(kind)
      const addBlock = () =>
        base.t.run(async (ctx) => {
          const host = await ctx.db
            .query('socialProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
            .unique()
          const player = await ctx.db
            .query('socialProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
            .unique()
          if (!host || !player) throw new Error('Missing profiles.')
          return ctx.db.insert('socialBlocks', {
            blockerProfileId: hostBlocksPlayer ? host.id : player.id,
            blockedProfileId: hostBlocksPlayer ? player.id : host.id,
            createdAt: new Date().toISOString()
          })
        })
      const block = await addBlock()
      const before = await base.snapshot()
      await expect(base.accept()).rejects.toThrow('unavailable')
      expect(await base.snapshot()).toEqual(before)
      await base.t.run((ctx) => ctx.db.delete(block))
      await base.accept()
      await addBlock()
      const accepted = await base.snapshot()
      await expect(base.accept()).rejects.toThrow('unavailable')
      expect(await base.snapshot()).toEqual(accepted)
      await expect(
        base.other.caller.query(api.campaigns.queries.get, { id: base.campaign.id })
      ).resolves.toMatchObject({ role: 'PLAYER' })
    }
  )

  it.each(['APPLICATION', 'INVITATION'] as const)(
    'rechecks current publication, moderation, and Campaign state for pending %s acceptance',
    async (kind) => {
      const base = await setup(kind)
      for (const state of [
        { status: 'CLOSED', moderationStatus: 'VISIBLE' },
        { status: 'OPEN', moderationStatus: 'HIDDEN' },
        { status: 'OPEN', moderationStatus: 'VISIBLE' }
      ] as const) {
        await base.t.run(async (ctx) => {
          const listing = await ctx.db
            .query('socialListings')
            .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
            .unique()
          const campaign = await ctx.db
            .query('campaigns')
            .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
            .unique()
          if (!listing || !campaign) throw new Error('Missing listing or Campaign.')
          await ctx.db.patch(listing._id, state)
          if (state.status === 'OPEN' && state.moderationStatus === 'VISIBLE')
            await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
        })
        const before = await base.snapshot()
        await expect(base.accept()).rejects.toThrow('unavailable')
        expect(await base.snapshot()).toEqual(before)
      }
    }
  )

  it.each(['APPLICATION', 'INVITATION'] as const)(
    'rejoins through a new %s with a strictly newer epoch and never resurrects membership on accepted replay',
    async (kind) => {
      const base = await setup(kind)
      const oldEpoch = '2099-01-01T00:00:00.000Z'
      const departedAt = '2099-01-02T00:00:00.000Z'
      await base.t.run((ctx) =>
        ctx.db.insert('campaignMemberships', {
          campaignId: base.campaign.id,
          userId: base.other.userId,
          role: 'PLAYER',
          status: 'LEFT',
          accessStartedAt: oldEpoch,
          joinedAt: oldEpoch,
          leftAt: departedAt
        })
      )
      await base.accept()
      const after = await base.snapshot()
      const player = after.memberships.find((member) => member.userId === base.other.userId)!
      expect(Date.parse(player.accessStartedAt)).toBeGreaterThan(Date.parse(departedAt))
      expect(player.joinedAt).toBe(player.accessStartedAt)
      expect(player.leftAt).toBeNull()
      await base.t.run((ctx) =>
        ctx.db.patch(player._id, { status: 'LEFT', leftAt: player.accessStartedAt })
      )
      const left = await base.snapshot()
      await expect(base.accept()).rejects.toThrow('unavailable')
      expect(await base.snapshot()).toEqual(left)
    }
  )

  it.each(['APPLICATION', 'INVITATION'] as const)(
    'rolls back %s source/membership/cancellation when decision notification creation fails',
    async (kind) => {
      const base = await setup(kind)
      const before = await base.snapshot()
      const fault = vi
        .spyOn(notifications, 'enqueueNotification')
        .mockRejectedValueOnce(new Error('Injected decision notification failure'))
      try {
        await expect(base.accept()).rejects.toThrow('Injected decision notification failure')
      } finally {
        fault.mockRestore()
      }
      expect(await base.snapshot()).toEqual(before)
    }
  )

  it.each(['APPLICATION', 'INVITATION'] as const)(
    'rolls back %s acceptance after a late public projection failure',
    async (kind) => {
      const base = await setup(kind)
      const before = await base.snapshot()
      const fault =
        kind === 'APPLICATION'
          ? vi
              .spyOn(projections, 'presentApplication')
              .mockRejectedValueOnce(new Error('Injected final projection failure'))
          : vi
              .spyOn(documents, 'readCampaignDetail')
              .mockRejectedValueOnce(new Error('Injected final projection failure'))
      try {
        await expect(base.accept()).rejects.toThrow('Injected final projection failure')
      } finally {
        fault.mockRestore()
      }
      expect(await base.snapshot()).toEqual(before)
    }
  )
})
