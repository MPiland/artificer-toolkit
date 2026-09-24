import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  archiveCampaignInputSchema,
  acceptCampaignOwnershipTransferInputSchema,
  campaignOwnershipTransferRequestResultSchema,
  requestCampaignOwnershipTransferInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  SocialListingDto,
  socialListingVersionInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { fixture as setup, snapshot } from '../../tests/fixtures/socialAdmission'
import * as intents from '../notifications/intents'
// Keep handler compilation outside the per-operation test timer.
import '../campaigns/ownership'
import '../content/import'
import '../betterAuth/adapter'
import '../auth'
import '../account'
import '../campaigns/create'
import './profiles'
import '../campaigns/archive'
import './listings'

afterEach(() => vi.useRealTimers())

const requestTransfer = makeFunctionReference<
  'mutation',
  z.input<typeof requestCampaignOwnershipTransferInputSchema>,
  z.output<typeof campaignOwnershipTransferRequestResultSchema>
>('campaigns/ownership:request')
const acceptTransfer = makeFunctionReference<
  'mutation',
  z.input<typeof acceptCampaignOwnershipTransferInputSchema>,
  CampaignDetailDto
>('campaigns/ownership:accept')
const archive = makeFunctionReference<
  'mutation',
  z.input<typeof archiveCampaignInputSchema>,
  CampaignDetailDto
>('campaigns/archive:archive')
const closeListing = makeFunctionReference<
  'mutation',
  z.input<typeof socialListingVersionInputSchema>,
  SocialListingDto
>('social/listings:close')

async function request(base: Awaited<ReturnType<typeof setup>>) {
  return base.owner.caller.mutation(requestTransfer, {
    campaignId: base.campaign.id,
    recipientUserId: base.other.userId
  })
}

describe.each(['OWNERSHIP_TRANSFER', 'ARCHIVE', 'LISTING_CLOSE'] as const)(
  'native Social admission closure during %s',
  (operation) => {
    function transition(base: Awaited<ReturnType<typeof setup>>) {
      return operation === 'ARCHIVE'
        ? base.owner.caller.mutation(archive, {
            campaignId: base.campaign.id,
            expectedVersion: base.campaign.version
          })
        : operation === 'LISTING_CLOSE'
          ? base.owner.caller.mutation(closeListing, {
              listingPublicId: base.listingId,
              expectedVersion: 3
            })
          : base.other.caller.mutation(acceptTransfer, { campaignId: base.campaign.id })
    }
    it('expires only pending admission rows and cancels their exact notification workflows', async () => {
      const base = await setup()
      await request(base)
      const before = await snapshot(base)
      const detail = await transition(base)
      if (operation !== 'LISTING_CLOSE') expect(detail).toHaveProperty('role', 'OWNER')
      const after = await snapshot(base)
      const listing = after.listings[0]!
      expect(listing).toMatchObject({
        status: 'CLOSED',
        ownerUserId: operation === 'OWNERSHIP_TRANSFER' ? base.other.userId : base.owner.userId,
        version: 4
      })
      expect(detail).toMatchObject({
        status:
          operation === 'ARCHIVE'
            ? 'ARCHIVED'
            : operation === 'LISTING_CLOSE'
              ? 'CLOSED'
              : 'ACTIVE',
        version: operation === 'LISTING_CLOSE' ? 4 : base.campaign.version + 1
      })
      if (operation === 'ARCHIVE') {
        expect(after.memberships).toEqual(before.memberships)
        expect(after.transfers).toEqual(before.transfers)
        expect(detail).toMatchObject({ capabilities: { edit: false } })
      }
      if (operation === 'LISTING_CLOSE') {
        expect(after.campaigns).toEqual(before.campaigns)
        expect(after.memberships).toEqual(before.memberships)
        expect(after.transfers).toEqual(before.transfers)
      }
      expect(after.applications.find((row) => row.id === base.applicationId)).toMatchObject({
        status: 'EXPIRED',
        version: 3,
        expiredAt: expect.any(String)
      })
      expect(after.invites.find((row) => row.id === base.inviteId)).toMatchObject({
        status: 'EXPIRED',
        version: 3,
        expiredAt: expect.any(String)
      })
      expect(after.applications.find((row) => row.id === base.acceptedApplicationId)).toEqual(
        before.applications.find((row) => row.id === base.acceptedApplicationId)
      )
      expect(after.invites.find((row) => row.id === base.acceptedInviteId)).toEqual(
        before.invites.find((row) => row.id === base.acceptedInviteId)
      )
      expect(after.notifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            recipientUserId: base.owner.userId,
            sourcePublicId: base.applicationId,
            workflowKey: 'social-application-submitted',
            status: 'CANCELLED'
          }),
          expect.objectContaining({
            recipientUserId: base.other.userId,
            sourcePublicId: base.inviteId,
            workflowKey: 'social-invitation-received',
            status: 'CANCELLED'
          })
        ])
      )
    })

    it('updates a derived owner on an already closed listing without bumping listing version', async () => {
      const base = await setup()
      await base.t.run(async (ctx) => {
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
          .unique()
        if (!listing) throw new Error('Missing Social listing.')
        await ctx.db.patch(listing._id, { status: 'CLOSED', version: 9 })
      })
      await request(base)
      if (operation === 'LISTING_CLOSE') {
        const before = await snapshot(base)
        await expect(
          base.owner.caller.mutation(closeListing, {
            listingPublicId: base.listingId,
            expectedVersion: 9
          })
        ).rejects.toThrow('Only open')
        expect(await snapshot(base)).toEqual(before)
        return
      }
      await transition(base)
      const listing = await base.t.run((ctx) =>
        ctx.db
          .query('socialListings')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
          .unique()
      )
      expect(listing).toMatchObject({
        status: 'CLOSED',
        ownerUserId: operation === 'OWNERSHIP_TRANSFER' ? base.other.userId : base.owner.userId,
        version: 9
      })
    })

    it('rolls back listing closure, notifications, offer and ownership when cancellation fails', async () => {
      const base = await setup()
      await request(base)
      const before = await snapshot(base)
      const original = intents.cancelNotification
      const fault = vi
        .spyOn(intents, 'cancelNotification')
        .mockImplementationOnce(async (ctx, input) => {
          await original(ctx, input)
          throw new Error('Injected notification cancellation failure')
        })
      try {
        await expect(transition(base)).rejects.toThrow('Injected notification cancellation failure')
      } finally {
        fault.mockRestore()
      }
      expect(await snapshot(base)).toEqual(before)
    })

    it('preserves a valid independent listing System during admission closure', async () => {
      const base = await setup()
      await request(base)
      const systemId = crypto.randomUUID()
      await base.t.run(async (ctx) => {
        const system = await ctx.db
          .query('systems')
          .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
          .unique()
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
          .unique()
        if (!system || !listing) throw new Error('Missing System/listing fixture.')
        const { _id, _creationTime, ...stored } = system
        const document = { ...system.document, id: systemId }
        await ctx.db.insert('systems', {
          ...stored,
          id: systemId,
          document,
          checksum: checksumRuleDocument(document)
        })
        await ctx.db.patch(listing._id, { systemId })
      })
      await transition(base)
      expect((await snapshot(base)).listings[0]).toMatchObject({ systemId, status: 'CLOSED' })
    })
  }
)

it('leaves pending admission untouched when archival authority or version is invalid', async () => {
  const base = await setup()
  const command = { campaignId: base.campaign.id, expectedVersion: base.campaign.version }
  const before = await snapshot(base)
  await expect(base.t.mutation(archive, command)).rejects.toThrow('Unauthenticated')
  await expect(base.other.caller.mutation(archive, command)).rejects.toThrow('cannot perform')
  await expect(
    base.owner.caller.mutation(archive, {
      ...command,
      expectedVersion: command.expectedVersion + 1
    })
  ).rejects.toThrow('Campaign changed')
  expect(await snapshot(base)).toEqual(before)
  await base.owner.caller.mutation(archive, command)
  const after = await snapshot(base)
  await expect(base.owner.caller.mutation(archive, command)).rejects.toThrow('read-only')
  expect(await snapshot(base)).toEqual(after)
})

it('keeps Campaign update time monotonic when archival follows a transfer in the same millisecond', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'))
  const base = await setup()
  await request(base)
  const transferred = await base.other.caller.mutation(acceptTransfer, {
    campaignId: base.campaign.id
  })
  const archived = await base.other.caller.mutation(archive, {
    campaignId: base.campaign.id,
    expectedVersion: transferred.version
  })
  expect(Date.parse(archived.updatedAt)).toBeGreaterThan(Date.parse(transferred.updatedAt))
  expect(archived.version).toBe(transferred.version + 1)
})
