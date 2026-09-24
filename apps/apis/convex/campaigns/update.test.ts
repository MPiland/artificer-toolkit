import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  UpdateCampaignInput,
  updateCampaignInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import { fixture as setup, snapshot } from '../../tests/fixtures/socialAdmission'
import { api } from '../_generated/api'
import * as admission from '../social/admissionClosure'
import * as documents from './documents'

const updateCampaign = makeFunctionReference<'mutation', UpdateCampaignInput, CampaignDetailDto>(
  'campaigns/update:update'
)

async function update(
  base: Awaited<ReturnType<typeof setup>>,
  changes: Omit<z.input<typeof updateCampaignInputSchema>, 'campaignId' | 'expectedVersion'>
) {
  return base.owner.caller.mutation(updateCampaign, {
    campaignId: base.campaign.id,
    expectedVersion: base.campaign.version,
    ...changes
  })
}

describe('native Campaign update', () => {
  it('updates nullable metadata and no-op fields, preserving ownership/routes and leaving listing version unchanged', async () => {
    const base = await setup()
    const before = await snapshot(base)
    const result = await update(base, { description: null, toneDetails: null })
    expect(result.version).toBe(base.campaign.version + 1)
    const after = await snapshot(base)
    expect(after.campaigns[0]).toMatchObject({
      id: base.campaign.id,
      ownerUserId: base.owner.userId,
      version: before.campaigns[0]!.version + 1,
      description: null,
      toneDetails: null
    })
    expect(after.listings[0]).toMatchObject({
      id: base.listingId,
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id,
      version: before.listings[0]!.version,
      status: 'OPEN',
      publishedAt: before.listings[0]!.publishedAt
    })
    expect(after.applications).toEqual(before.applications)
    expect(after.invites).toEqual(before.invites)
    expect(after.notifications).toEqual(before.notifications)
  })

  it('masks shared Standard return text while owner settings retain raw Campaign text', async () => {
    const base = await setup()
    const result = await update(base, { name: 'shit campaign' })
    expect(result.name).toBe('**** campaign')
    await expect(
      base.owner.caller.query(api.campaigns.queries.settings, {
        id: base.campaign.id
      })
    ).resolves.toMatchObject({ name: 'shit campaign' })
  })

  it('refreshes listing and pending admission versions for a name change without cancelling notifications', async () => {
    const base = await setup()
    const before = await snapshot(base)
    await update(base, { name: 'Renamed campaign' })
    const after = await snapshot(base)
    expect(after.listings[0]).toMatchObject({
      version: before.listings[0]!.version + 1
    })
    expect(after.applications.find((row) => row.id === base.applicationId)).toMatchObject({
      listingVersion: before.listings.find((row) => row.id === base.listingId)!.version + 1,
      version: before.applications.find((row) => row.id === base.applicationId)!.version + 1,
      status: 'SUBMITTED'
    })
    expect(after.invites.find((row) => row.id === base.inviteId)).toMatchObject({
      listingVersion: before.listings.find((row) => row.id === base.listingId)!.version + 1,
      version: before.invites.find((row) => row.id === base.inviteId)!.version + 1,
      status: 'PENDING'
    })
    expect(after.notifications).toEqual(before.notifications)
    expect(after.applications.find((row) => row.id === base.acceptedApplicationId)).toEqual(
      before.applications.find((row) => row.id === base.acceptedApplicationId)
    )
    expect(after.invites.find((row) => row.id === base.acceptedInviteId)).toEqual(
      before.invites.find((row) => row.id === base.acceptedInviteId)
    )
  })

  it.each([
    ['format', { format: 'ONE_SHOT' as const }],
    ['tone tags', { toneTags: ['HORROR' as const] }],
    ['tone details', { toneDetails: 'A darker tone' }],
    ['content maturity', { contentMaturity: 'MATURE' as const }]
  ])(
    'expires pending admission for material %s changes and preserves accepted history',
    async (_label, changes) => {
      const base = await setup()
      const before = await snapshot(base)
      await update(base, changes)
      const after = await snapshot(base)
      expect(after.listings[0]).toMatchObject({
        version: before.listings[0]!.version + 1,
        status: 'OPEN',
        publishedAt: before.listings[0]!.publishedAt
      })
      expect(after.applications.find((row) => row.id === base.applicationId)).toMatchObject({
        status: 'EXPIRED',
        version: before.applications.find((row) => row.id === base.applicationId)!.version + 1,
        expiredAt: expect.any(String)
      })
      expect(after.invites.find((row) => row.id === base.inviteId)).toMatchObject({
        status: 'EXPIRED',
        version: before.invites.find((row) => row.id === base.inviteId)!.version + 1,
        expiredAt: expect.any(String)
      })
      expect(after.notifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourcePublicId: base.applicationId,
            status: 'CANCELLED'
          }),
          expect.objectContaining({
            sourcePublicId: base.inviteId,
            status: 'CANCELLED'
          })
        ])
      )
      expect(after.applications.find((row) => row.id === base.acceptedApplicationId)).toEqual(
        before.applications.find((row) => row.id === base.acceptedApplicationId)
      )
      expect(after.invites.find((row) => row.id === base.acceptedInviteId)).toEqual(
        before.invites.find((row) => row.id === base.acceptedInviteId)
      )
    }
  )

  it.each(['DRAFT', 'CLOSED'] as const)(
    'allows a One-shot change with a recurring %s listing and preserves its status',
    async (status) => {
      const base = await setup()
      await base.t.run(async (ctx) => {
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
          .unique()
        if (!listing) throw new Error('Missing listing.')
        await ctx.db.patch(listing._id, {
          status,
          schedule: {
            kind: 'RECURRING',
            timeZone: 'America/Chicago',
            summary: 'Weekly',
            weekday: 1,
            localStartTime: '18:00',
            recurrence: 'WEEKLY'
          }
        })
      })

      await expect(update(base, { format: 'ONE_SHOT' })).resolves.toMatchObject({
        format: 'ONE_SHOT'
      })
      const after = await snapshot(base)
      expect(after.listings[0]).toMatchObject({ status })
    }
  )

  it.each([
    ['description-only', { description: 'A revised description' }],
    ['attunement-only', { attunementSlotOverride: 4 }],
    ['empty', {}]
  ])('does not churn listing or admission state for %s updates', async (_label, changes) => {
    const base = await setup()
    const future = '2099-01-01T00:00:00.000Z'
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
        .unique()
      if (!campaign || !listing) throw new Error('Missing campaign fixture records.')
      await ctx.db.patch(campaign._id, { updatedAt: future })
      await ctx.db.patch(listing._id, { updatedAt: future })
    })
    const before = await snapshot(base)
    await update(base, changes)
    const after = await snapshot(base)
    expect(Date.parse(after.campaigns[0]!.updatedAt)).toBeGreaterThan(Date.parse(future))
    expect(after.listings[0]).toMatchObject({
      version: before.listings[0]!.version,
      updatedAt: future
    })
    expect(after.applications).toEqual(before.applications)
    expect(after.invites).toEqual(before.invites)
    expect(after.notifications).toEqual(before.notifications)
  })

  it('rejects anonymous, player, stale, archived, and invalid recurring format changes atomically', async () => {
    const base = await setup()
    const before = await snapshot(base)
    const input = {
      campaignId: base.campaign.id,
      expectedVersion: base.campaign.version
    }
    await expect(base.t.mutation(updateCampaign, input)).rejects.toThrow()
    await expect(
      base.other.caller.mutation(updateCampaign, { ...input, name: 'Nope' })
    ).rejects.toThrow()
    await expect(
      base.owner.caller.mutation(updateCampaign, {
        ...input,
        expectedVersion: input.expectedVersion + 1
      })
    ).rejects.toThrow('Campaign changed')
    expect(await snapshot(base)).toEqual(before)
    await base.t.run(async (ctx) => {
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
        .unique()
      if (!listing) throw new Error('Missing listing.')
      await ctx.db.patch(listing._id, {
        schedule: {
          ...listing.schedule,
          kind: 'RECURRING',
          weekday: 1,
          localStartTime: '18:00',
          recurrence: 'WEEKLY'
        }
      })
    })
    await expect(update(base, { format: 'ONE_SHOT' })).rejects.toThrow('Close or reschedule')
    await base.owner.caller.mutation(api.campaigns.archive.archive, {
      campaignId: base.campaign.id,
      expectedVersion: base.campaign.version
    })
    await expect(
      base.owner.caller.mutation(updateCampaign, {
        ...input,
        description: 'archived'
      })
    ).rejects.toThrow('read-only')
  })

  it('rolls back root, listing, admission and notifications when late cancellation fails', async () => {
    const base = await setup()
    const before = await snapshot(base)
    const original = admission.reconcileListingAdmission
    const fault = vi
      .spyOn(admission, 'reconcileListingAdmission')
      .mockImplementationOnce(async (ctx, listing, now, listingVersion) => {
        await original(ctx, listing, now, listingVersion)
        throw new Error('Injected update cancellation failure')
      })
    try {
      await expect(update(base, { name: 'Rollback name' })).rejects.toThrow(
        'Injected update cancellation failure'
      )
    } finally {
      fault.mockRestore()
    }
    expect(await snapshot(base)).toEqual(before)
  })

  it('rolls back root, listing, admission and notifications when detail projection fails', async () => {
    const base = await setup()
    const before = await snapshot(base)
    const fault = vi.spyOn(documents, 'readCampaignDetail').mockImplementationOnce(async () => {
      throw new Error('Injected detail projection failure')
    })
    try {
      await expect(update(base, { name: 'Projection rollback' })).rejects.toThrow(
        'Injected detail projection failure'
      )
    } finally {
      fault.mockRestore()
    }
    expect(await snapshot(base)).toEqual(before)
  })
})
