import { Resend, type EmailId } from '@convex-dev/resend'
import { register } from '@convex-dev/resend/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationIntentData } from '@artificer-toolkit/schema/api/notifications'
import {
  notificationStoredIntentSchema,
  type NotificationEnqueueInput
} from '@artificer-toolkit/schema/projections/notificationPersistence'
import { campaignStoredAnnouncementSchema } from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { socialStoredApplicationSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { components, internal } from '../_generated/api'
import { fixture as socialFixture } from '../../tests/fixtures/socialAdmission'
import { cancelNotification, enqueueNotification } from './intents'

type SubmittedData = Extract<NotificationIntentData, { kind: 'SOCIAL_APPLICATION_SUBMITTED' }>
type AnnouncementData = Extract<NotificationIntentData, { kind: 'CAMPAIGN_ANNOUNCEMENT' }>

/**
 * The host Owner is the recipient. `submitted` and `announcement` seed a real Social application
 * and a real Campaign announcement by another author, so source eligibility is the real check.
 */
async function fixture() {
  const base = await socialFixture()
  const { t } = base
  register(t)
  const applicationTemplate = await t.run(async (ctx) => {
    const row = await ctx.db
      .query('socialApplications')
      .withIndex('by_publicId', (q) => q.eq('id', base.applicationId))
      .unique()
    if (!row) throw new Error('Missing Social application fixture.')
    const { _id, _creationTime, ...stored } = row
    return socialStoredApplicationSchema.parse(stored)
  })
  // The Social fixture seeds its own pending intents; these tests enqueue their own.
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query('notificationDeliveryIntents').collect())
      await ctx.db.delete(row._id)
  })
  const submitted = async (overrides: Partial<SubmittedData> = {}): Promise<SubmittedData> => {
    const sourcePublicId = crypto.randomUUID()
    await t.run((ctx) =>
      ctx.db.insert('socialApplications', { ...applicationTemplate, id: sourcePublicId })
    )
    return {
      kind: 'SOCIAL_APPLICATION_SUBMITTED',
      sourcePublicId,
      listingPublicId: base.listingId,
      listingTitle: '  Secret campaign title  ',
      applicantUsername: 'Applicant',
      occurredAt: new Date().toISOString(),
      ...overrides
    }
  }
  const announcement = async (): Promise<AnnouncementData> => {
    const announcementPublicId = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    await t.run((ctx) =>
      ctx.db.insert(
        'campaignAnnouncements',
        campaignStoredAnnouncementSchema.parse({
          announcementPublicId,
          campaignId: base.campaign.id,
          authorUserId: base.other.userId,
          scope: 'TABLE',
          partyId: null,
          title: 'Notice',
          body: 'private source text',
          createdAt,
          commandId: crypto.randomUUID(),
          inputFingerprint: checksumCanonicalJson({ announcementPublicId })
        })
      )
    )
    return {
      kind: 'CAMPAIGN_ANNOUNCEMENT',
      announcementPublicId,
      campaignPublicId: base.campaign.publicId,
      summary: 'private source text',
      scope: 'TABLE',
      occurredAt: createdAt
    }
  }
  return { t, userId: base.owner.userId, submitted, announcement }
}

async function intent(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  userId: string,
  data: NotificationIntentData,
  patch: Record<string, unknown> = {}
) {
  return t.run(async (ctx) => {
    const sourcePublicId =
      data.kind === 'CAMPAIGN_ANNOUNCEMENT' ? data.announcementPublicId : data.sourcePublicId
    const parsed = notificationStoredIntentSchema.parse({
      id: crypto.randomUUID(),
      recipientUserId: userId,
      workflowKey: data.kind.toLowerCase().replaceAll('_', '-'),
      sourceKind:
        data.kind === 'CAMPAIGN_ANNOUNCEMENT' ? 'CAMPAIGN_ANNOUNCEMENT' : 'SOCIAL_APPLICATION',
      sourcePublicId,
      groupingKey: data.kind === 'SOCIAL_APPLICATION_SUBMITTED' ? data.listingPublicId : null,
      data,
      occurredAt: data.occurredAt,
      status: 'PENDING',
      attemptCount: 0,
      nextAttemptAt: new Date(0).toISOString(),
      feedRecorded: false,
      providerEmailId: null,
      dispatchedAt: null,
      cancelledAt: null,
      lastErrorCode: null,
      ...patch
    })
    return ctx.db.insert('notificationDeliveryIntents', {
      ...parsed,
      providerEmailId: null
    })
  })
}

async function providerStatus(t: Awaited<ReturnType<typeof fixture>>['t'], emailId: EmailId) {
  return t.run((ctx) => new Resend(components.resend).status(ctx, emailId))
}

async function updateProvider(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  emailId: EmailId,
  status:
    | 'waiting'
    | 'queued'
    | 'sent'
    | 'delivered'
    | 'delivery_delayed'
    | 'bounced'
    | 'failed'
    | 'cancelled'
) {
  await t.run((ctx) =>
    ctx.runMutation(components.resend.lib.updateManualEmail, {
      emailId,
      status
    })
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('native notification intent delivery', () => {
  it('deduplicates replay, preserves the first payload, masks titles, and fixes announcement summaries', async () => {
    const { t, userId, submitted, announcement } = await fixture()
    const first = await submitted({ occurredAt: '2030-01-01T00:00:00Z' })
    const replay = {
      ...first,
      listingTitle: 'replacement title',
      applicantUsername: 'Other'
    }
    const firstId = await t.run((ctx) =>
      enqueueNotification(ctx, { recipientUserId: userId, data: first })
    )
    const replayId = await t.run((ctx) =>
      enqueueNotification(ctx, { recipientUserId: userId, data: replay })
    )
    expect(replayId).toBe(firstId)
    const row = await t.run((ctx) => ctx.db.query('notificationDeliveryIntents').collect())
    expect(row).toHaveLength(1)
    expect(row[0]?.data).toMatchObject({
      listingTitle: 'Secret campaign title',
      applicantUsername: 'Applicant',
      occurredAt: '2030-01-01T00:00:00.000Z'
    })
    expect(row[0]?.occurredAt).toBe('2030-01-01T00:00:00.000Z')
    expect(row[0]?.data).not.toHaveProperty('email')
    expect(row[0]?.data).not.toHaveProperty('authUserId')
    const announcementData = await announcement()
    await t.run((ctx) =>
      enqueueNotification(ctx, {
        recipientUserId: userId,
        data: announcementData
      })
    )
    const announcements = await t.run((ctx) =>
      ctx.db.query('notificationDeliveryIntents').collect()
    )
    expect(
      announcements.find((entry) => entry.workflowKey === 'campaign-announcement')?.data
    ).toMatchObject({ summary: 'A new Campaign announcement is available.' })
  })

  it('rejects malformed strict input and rolls back source enqueue work together', async () => {
    const { t, userId, submitted } = await fixture()
    const malformed = { ...(await submitted()), extra: true }
    const rolledBack = await submitted()
    await expect(
      t.run((ctx) =>
        enqueueNotification(ctx, {
          recipientUserId: userId,
          data: malformed
        } as unknown as NotificationEnqueueInput)
      )
    ).rejects.toThrow()
    await expect(
      t.run(async (ctx) => {
        await enqueueNotification(ctx, {
          recipientUserId: userId,
          data: rolledBack
        })
        throw new Error('source mutation failed')
      })
    ).rejects.toThrow('source mutation failed')
    expect(await t.run((ctx) => ctx.db.query('notificationDeliveryIntents').collect())).toEqual([])
  })

  it('creates cancellation tombstones before trigger and retains cancellation history after feed delivery', async () => {
    const { t, userId, submitted } = await fixture()
    const cancelledData = await submitted()
    await t.run((ctx) =>
      cancelNotification(ctx, {
        recipientUserId: userId,
        workflowKey: 'social-application-submitted',
        sourcePublicId: cancelledData.sourcePublicId,
        occurredAt: cancelledData.occurredAt
      })
    )
    await t.run((ctx) =>
      enqueueNotification(ctx, {
        recipientUserId: userId,
        data: cancelledData
      })
    )
    const cancelled = await t.run((ctx) => ctx.db.query('notificationDeliveryIntents').collect())
    expect(cancelled).toHaveLength(1)
    expect(cancelled[0]?.status).toBe('CANCELLED')
    const data = await submitted()
    await t.run((ctx) => enqueueNotification(ctx, { recipientUserId: userId, data }))
    await t.mutation(internal.notifications.delivery.dispatch, {})
    const after = await t.run(async (ctx) => ({
      intents: await ctx.db.query('notificationDeliveryIntents').collect(),
      feed: await ctx.db.query('notificationFeedItems').collect()
    }))
    expect(after.feed).toHaveLength(1)
    await t.run((ctx) =>
      cancelNotification(ctx, {
        recipientUserId: userId,
        workflowKey: 'social-application-submitted',
        sourcePublicId: data.sourcePublicId,
        occurredAt: data.occurredAt
      })
    )
    const reread = await t.run(async (ctx) => {
      const target = await ctx.db
        .query('notificationDeliveryIntents')
        .withIndex('by_recipientUserId_workflowKey_sourcePublicId', (q) =>
          q
            .eq('recipientUserId', userId)
            .eq('workflowKey', 'social-application-submitted')
            .eq('sourcePublicId', data.sourcePublicId)
        )
        .unique()
      return {
        intent: target,
        feed: target
          ? await ctx.db
              .query('notificationFeedItems')
              .withIndex('by_userId_id', (q) => q.eq('userId', userId).eq('id', target.id))
              .unique()
          : null
      }
    })
    expect(reread.intent?.status).toBe('CANCELLED')
    expect(reread.intent?.feedRecorded).toBe(true)
    expect(reread.feed).not.toBeNull()
  })

  it('claims at most ten, honors preferences, prunes delivered history, and does not resurrect pruned feed on retry', async () => {
    const { t, userId, submitted, announcement } = await fixture()
    vi.useFakeTimers()
    vi.stubEnv('MAIL_DELIVERY_MODE', 'local')
    vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3210')
    vi.stubEnv('LOCAL_EMAIL_SINK_URL', 'http://127.0.0.1:8025/messages')
    vi.stubEnv('SITE_URL', 'http://localhost:3000')
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const deliveredData = await Promise.all(
      Array.from({ length: 26 }, (_, index) =>
        submitted({ occurredAt: new Date(Date.now() + index).toISOString() })
      )
    )
    const announcementData = await announcement()
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing profile')
      await ctx.db.patch(profile._id, {
        notificationPreferences: {
          social: { inApp: true, email: false },
          campaign: { inApp: false, email: false }
        }
      })
      for (const data of deliveredData)
        await enqueueNotification(ctx, { recipientUserId: userId, data })
      await enqueueNotification(ctx, {
        recipientUserId: userId,
        data: announcementData
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await t.mutation(internal.notifications.delivery.dispatch, {})).toBe(10)
    expect(await t.mutation(internal.notifications.delivery.dispatch, {})).toBe(10)
    expect(await t.mutation(internal.notifications.delivery.dispatch, {})).toBe(7)
    const firstFeed = await t.run((ctx) => ctx.db.query('notificationFeedItems').collect())
    expect(firstFeed).toHaveLength(25)
    expect(firstFeed.map((entry) => entry.sourcePublicId)).not.toContain(
      deliveredData[0]!.sourcePublicId
    )
    expect(firstFeed.map((entry) => entry.sourcePublicId)).toContain(
      deliveredData[25]!.sourcePublicId
    )
    expect(firstFeed.every((entry) => entry.sourceKind === 'SOCIAL_APPLICATION')).toBe(true)
    expect(await t.run((ctx) => ctx.db.query('notificationDeliveryIntents').collect())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: 'CAMPAIGN_ANNOUNCEMENT',
          status: 'DISPATCHED'
        })
      ])
    )
    const retryData = await submitted({
      occurredAt: new Date(Date.now() + 100).toISOString()
    })
    const retryId = await intent(t, userId, retryData)
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing profile')
      await ctx.db.patch(profile._id, {
        notificationPreferences: {
          social: { inApp: true, email: true },
          campaign: { inApp: false, email: false }
        }
      })
    })
    expect(await t.mutation(internal.notifications.delivery.dispatch, {})).toBe(1)
    // Local delivery schedules one action; finish its asynchronous render/retry write before advancing the retry clock.
    await vi.runAllTimersAsync()
    await t.finishInProgressScheduledFunctions()
    const afterFailure = await t.run(async (ctx) => ({
      feed: await ctx.db.query('notificationFeedItems').collect(),
      row: await ctx.db.get(retryId)
    }))
    expect(afterFailure.feed).toHaveLength(25)
    expect(afterFailure.row?.lastErrorCode).toBe('DELIVERY_ERROR')
    // Evict the failed email's already-recorded feed item before reclaiming its retry.
    const evictingData = await Promise.all(
      Array.from({ length: 26 }, (_, index) =>
        submitted({ occurredAt: new Date(Date.now() + 1000 + index).toISOString() })
      )
    )
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing profile')
      await ctx.db.patch(profile._id, {
        notificationPreferences: {
          social: { inApp: true, email: false },
          campaign: { inApp: false, email: false }
        }
      })
      for (const data of evictingData)
        await enqueueNotification(ctx, { recipientUserId: userId, data })
    })
    await t.mutation(internal.notifications.delivery.dispatch, {})
    await t.mutation(internal.notifications.delivery.dispatch, {})
    await t.mutation(internal.notifications.delivery.dispatch, {})
    const prunedFeed = await t.run((ctx) => ctx.db.query('notificationFeedItems').collect())
    expect(prunedFeed).toHaveLength(25)
    expect(prunedFeed.map((entry) => entry.id)).not.toContain(afterFailure.row?.id)
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing profile')
      await ctx.db.patch(profile._id, {
        notificationPreferences: {
          social: { inApp: true, email: true },
          campaign: { inApp: false, email: false }
        }
      })
    })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(await t.mutation(internal.notifications.delivery.dispatch, {})).toBe(1)
    await vi.runAllTimersAsync()
    await t.finishInProgressScheduledFunctions()
    const final = await t.run(async (ctx) => ({
      feed: await ctx.db.query('notificationFeedItems').collect(),
      row: await ctx.db.get(retryId)
    }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      new Request('http://x', fetchMock.mock.calls[0]![1]).headers.get('idempotency-key')
    ).toBe(new Request('http://x', fetchMock.mock.calls[1]![1]).headers.get('idempotency-key'))
    expect(final.row?.status).toBe('DISPATCHED')
    expect(final.feed).toHaveLength(25)
    expect(final.row?.attemptCount).toBe(2)
    expect(final.row?.feedRecorded).toBe(true)
    expect(final.feed).toEqual(prunedFeed)
  })

  it('rolls back the component enqueue with the intent handle when the enclosing mutation fails', async () => {
    const { t, userId, submitted } = await fixture()
    vi.stubEnv('MAIL_DELIVERY_MODE', 'resend')
    vi.stubEnv('NOTIFICATION_EMAIL_FROM', 'Artificer Toolkit <notifications@example.test>')
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    const id = await intent(t, userId, await submitted(), { attemptCount: 1 })
    const observedIds: EmailId[] = []
    await expect(
      t.run(async (ctx) => {
        await ctx.runMutation(internal.notifications.delivery.enqueueRendered, {
          intentId: id,
          attempt: 1,
          subject: 'Notification',
          html: '<p>Notification</p>'
        })
        const row = await ctx.db.get(id)
        if (!row?.providerEmailId) throw new Error('Provider handle missing inside transaction')
        observedIds.push(row.providerEmailId)
        throw new Error('enclosing mutation failed')
      })
    ).rejects.toThrow('enclosing mutation failed')
    expect(observedIds).toHaveLength(1)
    expect((await t.run((ctx) => ctx.db.get(id)))?.providerEmailId).toBeNull()
    expect(await providerStatus(t, observedIds[0]!)).toBeNull()
  })

  it('fails closed for exhausted attempts, invalid payloads, unknown recipients, and active-account purge', async () => {
    const { t, userId, submitted } = await fixture()
    const exhausted = await intent(t, userId, await submitted(), {
      attemptCount: 10
    })
    const invalid = await t.run((ctx) =>
      ctx.db.insert('notificationDeliveryIntents', {
        id: crypto.randomUUID(),
        recipientUserId: userId,
        workflowKey: 'social-application-submitted',
        sourceKind: 'SOCIAL_APPLICATION',
        sourcePublicId: crypto.randomUUID(),
        groupingKey: null,
        data: null,
        occurredAt: new Date().toISOString(),
        status: 'PENDING',
        attemptCount: 0,
        nextAttemptAt: new Date(0).toISOString(),
        feedRecorded: false,
        providerEmailId: null,
        dispatchedAt: null,
        cancelledAt: null,
        lastErrorCode: null
      })
    )
    await t.mutation(internal.notifications.delivery.dispatch, {})
    expect((await t.run((ctx) => ctx.db.get(exhausted)))?.lastErrorCode).toBe('ATTEMPTS_EXHAUSTED')
    expect(await t.run((ctx) => ctx.db.get(invalid))).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        lastErrorCode: 'INVALID_PAYLOAD'
      })
    )
    await expect(
      t.mutation(internal.notifications.delivery.purgeRecipient, { userId })
    ).rejects.toThrow('active account')
    const missing = await intent(t, crypto.randomUUID(), await submitted())
    await t.mutation(internal.notifications.delivery.dispatch, {})
    expect((await t.run((ctx) => ctx.db.get(missing)))?.lastErrorCode).toBe('RECIPIENT_UNAVAILABLE')
  })

  it('purges only the deleted recipient in bounded batches and cancels their queued email', async () => {
    const { t, userId, submitted } = await fixture()
    vi.stubEnv('MAIL_DELIVERY_MODE', 'resend')
    vi.stubEnv('NOTIFICATION_EMAIL_FROM', 'Artificer Toolkit <notifications@example.test>')
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    const queued = await intent(t, userId, await submitted(), { attemptCount: 1 })
    await t.mutation(internal.notifications.delivery.enqueueRendered, {
      intentId: queued,
      attempt: 1,
      subject: 'Notification',
      html: '<p>Notification</p>'
    })
    const emailId = (await t.run((ctx) => ctx.db.get(queued)))?.providerEmailId
    if (!emailId) throw new Error('Missing queued email')
    for (let index = 0; index < 50; index++) await intent(t, userId, await submitted())
    const other = await intent(t, crypto.randomUUID(), await submitted())
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing profile')
      await ctx.db.delete(profile._id)
    })
    await t.mutation(internal.notifications.delivery.purgeRecipient, {
      userId
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('notificationDeliveryIntents')
          .withIndex('by_recipientUserId', (q) => q.eq('recipientUserId', userId))
          .collect()
      )
    ).toHaveLength(1)
    expect(await providerStatus(t, emailId)).toMatchObject({
      status: 'cancelled'
    })
    await t.mutation(internal.notifications.delivery.purgeRecipient, {
      userId
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('notificationDeliveryIntents')
          .withIndex('by_recipientUserId', (q) => q.eq('recipientUserId', userId))
          .collect()
      )
    ).toEqual([])
    expect(await t.run((ctx) => ctx.db.get(other))).not.toBeNull()
    await t.mutation(internal.notifications.delivery.enqueueRendered, {
      intentId: queued,
      attempt: 1,
      subject: 'Late',
      html: '<p>Late</p>'
    })
    expect(await providerStatus(t, emailId)).toMatchObject({
      status: 'cancelled'
    })
  })

  it('uses the configured Resend test recipient and persists its provider handle atomically', async () => {
    const { t, userId, submitted } = await fixture()
    vi.stubEnv('MAIL_DELIVERY_MODE', 'resend')
    vi.stubEnv('NOTIFICATION_EMAIL_FROM', 'Artificer Toolkit <notifications@example.test>')
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('RESEND_TEST_RECIPIENT', 'delivered+notification_probe@resend.dev')
    const sendEmail = vi.spyOn(Resend.prototype, 'sendEmail')
    const queued = await intent(t, userId, await submitted(), { attemptCount: 1 })

    await t.mutation(internal.notifications.delivery.enqueueRendered, {
      intentId: queued,
      attempt: 1,
      subject: 'Notification',
      html: '<p>Notification</p>'
    })

    const providerEmailId = (await t.run((ctx) => ctx.db.get(queued)))?.providerEmailId
    expect(providerEmailId).toBeTruthy()
    if (!providerEmailId) throw new Error('Missing provider handle.')
    expect(await providerStatus(t, providerEmailId)).toMatchObject({
      status: 'waiting'
    })
    expect(sendEmail.mock.contexts).toMatchObject([{ config: { testMode: true } }])
    expect(sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        to: 'delivered+notification_probe@resend.dev'
      })
    )
  })

  it('deduplicates concurrent Resend attempts, polls provider state, and cancels queued mail', async () => {
    const { t, userId, submitted } = await fixture()
    vi.useFakeTimers()
    vi.stubEnv('MAIL_DELIVERY_MODE', 'resend')
    vi.stubEnv('NOTIFICATION_EMAIL_FROM', 'Artificer Toolkit <notifications@example.test>')
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('SITE_URL', 'https://app.example.test')
    const sendEmail = vi.spyOn(Resend.prototype, 'sendEmail')
    const data = await submitted()
    const id = await intent(t, userId, data, { attemptCount: 1 })
    await Promise.all([
      t.action(internal.notifications.deliveryAction.send, {
        intentId: id,
        attempt: 1
      }),
      t.action(internal.notifications.deliveryAction.send, {
        intentId: id,
        attempt: 1
      })
    ])
    const pending = await t.run((ctx) => ctx.db.get(id))
    expect(pending?.providerEmailId).not.toBeNull()
    expect(pending?.status).toBe('PENDING')
    expect(pending?.attemptCount).toBe(1)
    const providerId = pending?.providerEmailId
    if (!providerId) throw new Error('Missing provider email')
    const enqueuedIds = await Promise.all(sendEmail.mock.results.map((result) => result.value))
    expect(enqueuedIds.length).toBeGreaterThan(0)
    expect(enqueuedIds.every((value) => value === providerId)).toBe(true)
    expect(await providerStatus(t, providerId)).toMatchObject({
      status: 'waiting'
    })
    const untilDue = async (intentId: typeof id) => {
      const row = await t.run((ctx) => ctx.db.get(intentId))
      await vi.advanceTimersByTimeAsync(Date.parse(row!.nextAttemptAt) - Date.now())
    }
    await untilDue(id)
    expect(await t.mutation(internal.notifications.delivery.dispatch, {})).toBe(1)
    expect((await t.run((ctx) => ctx.db.get(id)))?.attemptCount).toBe(1)
    await updateProvider(t, providerId, 'sent')
    await untilDue(id)
    await t.mutation(internal.notifications.delivery.dispatch, {})
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe('DISPATCHED')

    const failedId = await intent(t, userId, await submitted(), { attemptCount: 1 })
    await t.action(internal.notifications.deliveryAction.send, {
      intentId: failedId,
      attempt: 1
    })
    const failedEmailId = (await t.run((ctx) => ctx.db.get(failedId)))?.providerEmailId
    if (!failedEmailId) throw new Error('Missing failed provider email')
    await updateProvider(t, failedEmailId, 'failed')
    await untilDue(failedId)
    await t.mutation(internal.notifications.delivery.dispatch, {})
    expect(await t.run((ctx) => ctx.db.get(failedId))).toMatchObject({
      status: 'FAILED',
      lastErrorCode: 'DELIVERY_ERROR'
    })

    const cancelledData = await submitted()
    const cancelledId = await intent(t, userId, cancelledData, {
      attemptCount: 1
    })
    await t.action(internal.notifications.deliveryAction.send, {
      intentId: cancelledId,
      attempt: 1
    })
    const cancelledEmailId = (await t.run((ctx) => ctx.db.get(cancelledId)))?.providerEmailId
    if (!cancelledEmailId) throw new Error('Missing cancelled provider email')
    await t.run((ctx) =>
      cancelNotification(ctx, {
        recipientUserId: userId,
        workflowKey: 'social-application-submitted',
        sourcePublicId: cancelledData.sourcePublicId,
        occurredAt: cancelledData.occurredAt
      })
    )
    expect(await providerStatus(t, cancelledEmailId)).toMatchObject({
      status: 'cancelled'
    })
    await t.action(internal.notifications.deliveryAction.send, {
      intentId: cancelledId,
      attempt: 1
    })
    expect((await t.run((ctx) => ctx.db.get(cancelledId)))?.providerEmailId).toBe(cancelledEmailId)
    const callsBeforeDelete = sendEmail.mock.calls.length
    await t.run((ctx) => ctx.db.delete(cancelledId))
    await t.mutation(internal.notifications.delivery.enqueueRendered, {
      intentId: cancelledId,
      attempt: 1,
      subject: 'Late',
      html: '<p>Late</p>'
    })
    expect(sendEmail).toHaveBeenCalledTimes(callsBeforeDelete)
  })
})
