import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'

export async function verifyNotificationDelivery(input: {
  owner: ConvexHttpClient
  recipient: ConvexHttpClient
  anonymous: ConvexHttpClient
  campaignId: string
  readDelivery: (sourcePublicIds: string[]) => Promise<unknown>
  // The local deployment hands email to its loopback sink (MAIL_DELIVERY_MODE=local), which has no
  // provider receipt; managed development queues it with Resend.
  emailDelivery: 'LOCAL_SINK' | 'RESEND'
}) {
  const { owner, recipient, anonymous, campaignId } = input
  const command = {
    campaignId,
    commandId: crypto.randomUUID(),
    scope: 'TABLE' as const,
    partyId: null,
    title: 'Notification fixture first',
    body: 'Synthetic notification delivery proof.'
  }
  const first = await owner.mutation(api.campaigns.announcements.create, command)
  assert.deepEqual(await owner.mutation(api.campaigns.announcements.create, command), first)

  async function waitForDelivery(sourcePublicId: string, emailEnabled: boolean) {
    const deadline = Date.now() + 180_000
    while (Date.now() < deadline) {
      const records = await input.readDelivery([sourcePublicId])
      assert.ok(Array.isArray(records) && records.length === 1)
      const state: unknown = records[0]
      assert.ok(state && typeof state === 'object' && 'status' in state)
      assert.ok('sourcePublicId' in state && state.sourcePublicId === sourcePublicId)
      assert.ok(state.status !== 'FAILED' && state.status !== 'CANCELLED')
      if (state.status === 'DISPATCHED') {
        assert.ok('attemptCount' in state && state.attemptCount === (emailEnabled ? 1 : 0))
        assert.ok('feedRecorded' in state && state.feedRecorded === emailEnabled)
        assert.ok('providerEmailId' in state && 'providerStatus' in state)
        if (emailEnabled && input.emailDelivery === 'RESEND') {
          assert.equal(typeof state.providerEmailId, 'string')
          assert.ok(state.providerStatus === 'sent' || state.providerStatus === 'delivered')
        } else {
          assert.equal(state.providerEmailId, null)
          assert.equal(state.providerStatus, null)
        }
        console.log(JSON.stringify({ notificationDelivery: 'PASS', ...state }))
        return
      }
      await delay(5000)
    }
    throw new Error('Native notification cron did not finish within three minutes.')
  }

  // No dispatcher invocation: the actual deployed cron and scheduled action must deliver this.
  await waitForDelivery(first.announcementPublicId, true)
  const feed = await recipient.query(api.notifications.feed, {})
  assert.equal(feed.items.length, 1)
  assert.equal(feed.unseenCount, 1)
  const item = feed.items[0]
  assert.equal(item.sourcePublicId, first.announcementPublicId)
  assert.equal(item.data.kind, 'CAMPAIGN_ANNOUNCEMENT')
  assert.equal(item.readAt, null)
  assert.deepEqual((await owner.query(api.notifications.feed, {})).items, [])
  await assert.rejects(anonymous.query(api.notifications.feed, {}), /Unauthenticated/)
  await assert.rejects(
    owner.mutation(api.notifications.markRead, { id: item.id }),
    /Notification is unavailable/
  )
  await recipient.mutation(api.notifications.markRead, { id: item.id })
  const read = await recipient.query(api.notifications.feed, {})
  assert.equal(read.unseenCount, 0)
  assert.ok(read.items[0]?.readAt && read.items[0]?.seenAt)
  await recipient.mutation(api.notifications.markRead, { id: item.id })
  assert.deepEqual(await recipient.query(api.notifications.feed, {}), read)

  await recipient.mutation(api.notifications.updatePreferences, {
    category: 'CAMPAIGN',
    inApp: false,
    email: false
  })
  assert.deepEqual((await owner.query(api.notifications.preferences, {})).campaign, {
    inApp: true,
    email: true
  })
  const second = await owner.mutation(api.campaigns.announcements.create, {
    ...command,
    commandId: crypto.randomUUID(),
    title: 'Notification fixture second'
  })
  await waitForDelivery(second.announcementPublicId, false)
  assert.deepEqual(await recipient.query(api.notifications.feed, {}), read)
  console.log(
    'Native source replay, cron-to-feed/email, recipient privacy, first-read preservation and channel suppression passed.'
  )
}
