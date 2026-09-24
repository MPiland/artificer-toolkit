import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  SocialListingDto,
  UpdateSocialListingInput
} from '@artificer-toolkit/schema/api/socialHub'
import { fixture, snapshot } from '../../tests/fixtures/socialAdmission'
import * as intents from '../notifications/intents'

const update = makeFunctionReference<
  'mutation',
  { input: UpdateSocialListingInput },
  SocialListingDto
>('social/listings:update')

async function setup() {
  const base = await fixture()
  const before = await snapshot(base)
  const listing = before.listings[0]!
  const input: UpdateSocialListingInput = {
    listingPublicId: listing.id,
    expectedVersion: listing.version,
    summary: listing.summary,
    audience: listing.audience,
    systemId: listing.systemId,
    playMode: listing.playMode,
    capacity: listing.capacity,
    schedule: listing.schedule,
    location: listing.location,
    expectations: listing.expectations
  }
  return { ...base, before, input }
}

describe('native Social edits and pending admission', () => {
  it('refreshes both optimistic versions after harmless edits without changing admission or notifications', async () => {
    const base = await setup()
    const result = await base.owner.caller.mutation(update, {
      input: { ...base.input, summary: 'Updated description', capacity: 5 }
    })
    expect(result).toMatchObject({ status: 'OPEN', version: 4 })
    const after = await snapshot(base)
    const application = base.before.applications.find((row) => row.id === base.applicationId)!
    const invite = base.before.invites.find((row) => row.id === base.inviteId)!
    expect(after.applications.find((row) => row.id === base.applicationId)).toEqual({
      ...application,
      listingVersion: 4,
      version: application.version + 1,
      updatedAt: after.listings[0]!.updatedAt
    })
    expect(after.invites.find((row) => row.id === base.inviteId)).toEqual({
      ...invite,
      listingVersion: 4,
      version: invite.version + 1,
      updatedAt: after.listings[0]!.updatedAt
    })
    expect(after.notifications).toEqual(base.before.notifications)
    expect(after.campaigns).toEqual(base.before.campaigns)
    expect(after.memberships).toEqual(base.before.memberships)
    expect(after.applications.find((row) => row.id === base.acceptedApplicationId)).toEqual(
      base.before.applications.find((row) => row.id === base.acceptedApplicationId)
    )
    expect(after.invites.find((row) => row.id === base.acceptedInviteId)).toEqual(
      base.before.invites.find((row) => row.id === base.acceptedInviteId)
    )
  })

  it.each(['audience', 'schedule', 'expectations', 'location'] as const)(
    'expires pending admission for a material %s edit without closing the listing',
    async (field) => {
      const base = await setup()
      const input: UpdateSocialListingInput = { ...base.input }
      if (field === 'audience') input.audience = 'PRIVATE'
      if (field === 'schedule') input.schedule = { ...input.schedule, summary: 'New table time' }
      if (field === 'expectations')
        input.expectations = { ...input.expectations, tableConduct: 'New table policy' }
      if (field === 'location') {
        input.playMode = 'IN_PERSON'
        input.location = { city: 'Chicago', stateCode: 'IL' }
      }
      await expect(base.owner.caller.mutation(update, { input })).resolves.toMatchObject({
        status: 'OPEN',
        version: 4
      })
      const after = await snapshot(base)
      expect(after.applications.find((row) => row.id === base.applicationId)).toMatchObject({
        status: 'EXPIRED',
        version: 3,
        listingVersion: 3,
        expiredAt: after.listings[0]!.updatedAt
      })
      expect(after.invites.find((row) => row.id === base.inviteId)).toMatchObject({
        status: 'EXPIRED',
        version: 3,
        listingVersion: 3,
        expiredAt: after.listings[0]!.updatedAt
      })
      expect(after.notifications.every((row) => row.status === 'CANCELLED')).toBe(true)
      expect(after.applications.find((row) => row.id === base.acceptedApplicationId)).toEqual(
        base.before.applications.find((row) => row.id === base.acceptedApplicationId)
      )
      expect(after.invites.find((row) => row.id === base.acceptedInviteId)).toEqual(
        base.before.invites.find((row) => row.id === base.acceptedInviteId)
      )
      expect(after.memberships).toEqual(base.before.memberships)
      expect(after.campaigns).toEqual(base.before.campaigns)
    }
  )

  it('rolls back material edits, admission expiry and notification cancellation together', async () => {
    const base = await setup()
    const original = intents.cancelNotification
    const fault = vi
      .spyOn(intents, 'cancelNotification')
      .mockImplementationOnce(async (ctx, input) => {
        await original(ctx, input)
        throw new Error('Late edit cancellation failure')
      })
    try {
      await expect(
        base.owner.caller.mutation(update, { input: { ...base.input, audience: 'PRIVATE' } })
      ).rejects.toThrow('Late edit cancellation failure')
    } finally {
      fault.mockRestore()
    }
    expect(await snapshot(base)).toEqual(base.before)
  })
})
