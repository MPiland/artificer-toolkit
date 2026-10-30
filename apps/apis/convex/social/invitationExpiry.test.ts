import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CampaignInviteDto,
  CreateCampaignInviteInput,
  campaignInviteVersionInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import { fixture } from '../../tests/fixtures/socialWriters'
import { internal } from '../_generated/api'
import * as notifications from '../notifications/intents'

const create = makeFunctionReference<'mutation', CreateCampaignInviteInput, CampaignInviteDto>(
  'social/invitations:create'
)
const accept = makeFunctionReference<
  'mutation',
  z.input<typeof campaignInviteVersionInputSchema>,
  CampaignDetailDto
>('social/invitations:accept')

describe('native invitation expiry before notification delivery', () => {
  it('rejects expiry at the deadline, then expires/cancels exactly once without admitting the recipient', async () => {
    const base = await fixture()
    const expiresAt = new Date(Date.now() + 10_000).toISOString()
    const invitation = await base.owner.caller.mutation(create, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer',
      expiresAt
    })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(expiresAt))
    try {
      const before = await base.snapshot()
      await expect(
        base.other.caller.mutation(accept, {
          invitePublicId: invitation.invitePublicId,
          expectedVersion: invitation.version
        })
      ).rejects.toThrow('expired')
      expect(await base.snapshot()).toEqual(before)
      // A read commits too, so the sweep runs just after the deadline at a clock this test sets.
      const expiredAt = new Date(Date.parse(expiresAt) + 1_000).toISOString()
      vi.setSystemTime(new Date(expiredAt))
      expect(await base.t.mutation(internal.notifications.delivery.dispatch, {})).toBe(0)
      const after = await base.snapshot()
      expect(after.invitations[0]).toMatchObject({
        status: 'EXPIRED',
        version: 1,
        expiredAt
      })
      expect(after.notifications[0]).toMatchObject({ status: 'CANCELLED', cancelledAt: expiredAt })
      expect(after.memberships).toEqual(before.memberships)
      expect(after.feed).toEqual([])
      await base.t.mutation(internal.notifications.delivery.dispatch, {})
      expect(await base.snapshot()).toEqual(after)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never delivers expired invites beyond the ten-source expiry batch and finishes the backlog on the next pass', async () => {
    const base = await fixture()
    const expiresAt = new Date(Date.now() + 30_000).toISOString()
    for (let index = 0; index < 12; index++) {
      const username = `ExpiredRecipient${index}`
      await base.addActor(username)
      await base.owner.caller.mutation(create, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        username,
        expiresAt
      })
    }
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(expiresAt))
    try {
      await base.t.mutation(internal.notifications.delivery.dispatch, {})
      const first = await base.snapshot()
      expect(first.invitations.filter((row) => row.status === 'EXPIRED')).toHaveLength(10)
      expect(first.invitations.filter((row) => row.status === 'PENDING')).toHaveLength(2)
      expect(first.notifications.every((row) => row.status === 'CANCELLED')).toBe(true)
      expect(
        first.notifications.every((row) => row.attemptCount === 0 && row.providerEmailId === null)
      ).toBe(true)
      expect(first.feed).toEqual([])
      await base.t.mutation(internal.notifications.delivery.dispatch, {})
      const second = await base.snapshot()
      expect(second.invitations.every((row) => row.status === 'EXPIRED' && row.version === 1)).toBe(
        true
      )
      expect(second.feed).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('rechecks the deadline between dispatch, email rendering and provider enqueue', async () => {
    const base = await fixture()
    const expiresAt = new Date(Date.now() + 10_000).toISOString()
    await base.owner.caller.mutation(create, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer',
      expiresAt
    })
    await base.t.mutation(internal.notifications.delivery.dispatch, {})
    const before = await base.snapshot()
    const intent = before.notifications[0]!
    expect(intent.attemptCount).toBe(1)
    await expect(
      base.t.query(internal.notifications.delivery.emailInput, {
        intentId: intent._id,
        attempt: 1
      })
    ).resolves.toMatchObject({ id: intent.id })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(expiresAt))
    try {
      await expect(
        base.t.query(internal.notifications.delivery.emailInput, {
          intentId: intent._id,
          attempt: 1
        })
      ).resolves.toBeNull()
      await base.t.mutation(internal.notifications.delivery.enqueueRendered, {
        intentId: intent._id,
        attempt: 1,
        subject: 'Already expired',
        html: '<p>This must not enqueue.</p>'
      })
      const after = await base.snapshot()
      expect(after.notifications[0]?.providerEmailId).toBeNull()
      expect(after.invitations[0]?.status).toBe('PENDING')
    } finally {
      vi.useRealTimers()
    }
  })

  it('rolls back source expiry when notification cancellation fails', async () => {
    const base = await fixture()
    const expiresAt = new Date(Date.now() + 10_000).toISOString()
    await base.owner.caller.mutation(create, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer',
      expiresAt
    })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(expiresAt))
    const before = await base.snapshot()
    const original = notifications.cancelNotification
    const fault = vi
      .spyOn(notifications, 'cancelNotification')
      .mockImplementationOnce(async (ctx, input) => {
        await original(ctx, input)
        throw new Error('Injected expiry cancellation failure')
      })
    try {
      await expect(base.t.mutation(internal.notifications.delivery.dispatch, {})).rejects.toThrow(
        'Injected expiry cancellation failure'
      )
      expect(await base.snapshot()).toEqual(before)
    } finally {
      fault.mockRestore()
      vi.useRealTimers()
    }
  })
})
