import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CreateSocialReportInput,
  SocialReportReceiptDto,
  SocialModerationQueueItemDto
} from '@artificer-toolkit/schema/api/socialHub'
import type {
  socialModerationQueueInputSchema,
  socialReportReviewInputSchema,
  SocialModerationQueuePage,
  SocialModerationEvidenceDto
} from '@artificer-toolkit/schema/api/socialModeration'
import {
  advanceAccountDeletionToProvider,
  deleteAccountCompletely,
  drainScheduledWork,
  scheduledSince
} from '../../tests/fixtures/accountDeletion'
import { fixture } from '../../tests/fixtures/socialWriters'
import { api, components, internal } from '../_generated/api'
import * as documents from './moderationDocuments'
import { consumeSocialRateLimit, socialRateLimits } from '../lib/rateLimits'
import { readSocialRateLimits } from '../../tests/fixtures/socialRateLimits'

// Account deletion removes each counter, so reads fall back to the full, never-used allowance.
const clearedReportLimits = socialRateLimits('REPORT').map(({ config }) => ({
  value: config.rate,
  ts: 0
}))

const create = makeFunctionReference<
  'mutation',
  { input: CreateSocialReportInput },
  SocialReportReceiptDto
>('social/reports:create')
const list = makeFunctionReference<
  'query',
  z.input<typeof socialModerationQueueInputSchema>,
  SocialModerationQueuePage
>('social/moderation:list')
const open = makeFunctionReference<
  'mutation',
  { reportPublicId: string },
  SocialModerationEvidenceDto
>('social/moderation:open')
const review = makeFunctionReference<
  'mutation',
  z.input<typeof socialReportReviewInputSchema>,
  SocialModerationEvidenceDto
>('social/moderation:review')
const setRole = makeFunctionReference<
  'mutation',
  { userId: string; role: 'user' | 'superadmin' },
  null
>('authAdmin:setRole')

async function setup() {
  const base = await fixture()
  const report = await base.other.caller.mutation(create, {
    input: {
      targetKind: 'LISTING',
      targetPublicId: base.listing.listingPublicId,
      reason: 'HARASSMENT',
      details: 'Private reporter account of events'
    }
  })
  await base.t.mutation(setRole, { userId: base.owner.userId, role: 'superadmin' })
  const snapshot = () =>
    base.t.run(async (ctx) => ({
      reports: await ctx.db.query('socialReports').take(40),
      audits: await ctx.db.query('socialModerationActions').take(40)
    }))
  return { ...base, report, moderationSnapshot: snapshot }
}

describe('native Social moderation report review', () => {
  it('returns retained SQL evidence unchanged through audited open and review', async () => {
    const base = await setup()
    const original = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialReports')
        .withIndex('by_publicId', (q) => q.eq('id', base.report.reportPublicId))
        .unique()
      if (!row || !('schedule' in row.evidenceSnapshot))
        throw new Error('Missing listing evidence.')
      const evidenceSnapshot = {
        ...row.evidenceSnapshot,
        title: '  Captured title  ',
        summary: '  Captured summary  ',
        toneDetails: '  Captured tone  ',
        capturedAt: '2026-09-08T09:00:00.123456-05:00',
        schedule: {
          ...row.evidenceSnapshot.schedule,
          kind: 'RECURRING' as const,
          summary: '  Captured schedule  ',
          localStartTime: '19:30:00.123456',
          weekday: 2,
          recurrence: 'WEEKLY' as const
        },
        expectations: { ...row.evidenceSnapshot.expectations, tableConduct: '  Original conduct  ' }
      }
      const details = '  Original report details  '
      await ctx.db.patch(row._id, { evidenceSnapshot, details })
      return { evidenceSnapshot, details }
    })
    const opened = await base.owner.caller.mutation(open, {
      reportPublicId: base.report.reportPublicId
    })
    expect(opened.evidence).toEqual(original.evidenceSnapshot)
    expect(opened.details).toBe(original.details)
    const reviewed = await base.owner.caller.mutation(review, {
      reportPublicId: base.report.reportPublicId,
      action: 'START_REVIEW',
      expectedVersion: 0,
      reason: 'Review original evidence'
    })
    expect(reviewed.evidence).toEqual(original.evidenceSnapshot)
    expect(reviewed.details).toBe(original.details)
    expect((await base.moderationSnapshot()).reports[0]).toMatchObject(original)
  })

  it('requires current verified superadmin authority and an active Social profile for every operation', async () => {
    const base = await setup()
    const input = {
      reportPublicId: base.report.reportPublicId,
      action: 'START_REVIEW',
      expectedVersion: 0,
      reason: 'Review'
    } as const
    const before = await base.moderationSnapshot()
    for (const caller of [base.t, base.other.caller]) {
      await expect(
        caller.query(list, { paginationOpts: { numItems: 8, cursor: null } })
      ).rejects.toThrow()
      await expect(
        caller.mutation(open, { reportPublicId: base.report.reportPublicId })
      ).rejects.toThrow()
      await expect(caller.mutation(review, input)).rejects.toThrow()
    }
    const account = await base.t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
    )
    const profile = await base.t.run((ctx) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
    )
    if (!account || !profile) throw new Error('Missing moderator.')
    for (const state of [
      'UNVERIFIED',
      'DEMOTED',
      'SUSPENDED',
      'BANNED',
      'MISSING_PROFILE'
    ] as const) {
      await base.t.run(async (ctx) => {
        await ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: 'user',
            where: [{ field: '_id', value: account.authUserId }],
            update: {
              role: state === 'DEMOTED' ? 'user' : 'superadmin',
              emailVerified: state !== 'UNVERIFIED',
              banned: state === 'BANNED'
            }
          }
        })
        if (state === 'MISSING_PROFILE') await ctx.db.delete(profile._id)
        else
          await ctx.db.patch(profile._id, {
            status: state === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE'
          })
      })
      await expect(
        base.owner.caller.query(list, { paginationOpts: { numItems: 8, cursor: null } })
      ).rejects.toThrow()
      await expect(
        base.owner.caller.mutation(open, { reportPublicId: base.report.reportPublicId })
      ).rejects.toThrow()
      await expect(base.owner.caller.mutation(review, input)).rejects.toThrow()
      expect(await base.moderationSnapshot()).toEqual(before)
    }
  })

  it('uses bounded native cursor pages ordered submitted, reviewing, then both terminal statuses by creation and UUID', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const template = (await ctx.db.query('socialReports').take(1))[0]!
      const { _id, _creationTime, ...stored } = template
      await ctx.db.delete(_id)
      for (let index = 20; index >= 0; index--) {
        const status = ['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'][
          index % 4
        ] as SocialModerationQueueItemDto['status']
        const createdAt = new Date(Date.UTC(2026, 0, 1, 0, Math.floor(index / 2))).toISOString()
        await ctx.db.insert('socialReports', {
          ...stored,
          id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          status,
          queuePriority: status === 'SUBMITTED' ? 0 : status === 'UNDER_REVIEW' ? 1 : 2,
          createdAt,
          updatedAt: createdAt,
          reviewStartedAt: status === 'SUBMITTED' ? null : createdAt,
          resolvedAt: status === 'RESOLVED' || status === 'DISMISSED' ? createdAt : null
        })
      }
    })
    const before = await base.moderationSnapshot()
    const rows: SocialModerationQueueItemDto[] = []
    let cursor: string | null = null
    let done = false
    for (let pageNumber = 0; pageNumber < 10 && !done; pageNumber++) {
      const page: SocialModerationQueuePage = await base.owner.caller.query(list, {
        paginationOpts: { numItems: 48, cursor }
      })
      expect(page.page.length).toBeLessThanOrEqual(8)
      rows.push(...page.page)
      done = page.isDone
      if (!done) expect(page.continueCursor).not.toBe(cursor)
      cursor = page.continueCursor
    }
    expect(done).toBe(true)
    expect(rows).toHaveLength(21)
    expect(rows.map((row) => row.reportPublicId)).toEqual(
      [...before.reports]
        .sort(
          (left, right) =>
            left.queuePriority - right.queuePriority ||
            left.createdAt.localeCompare(right.createdAt) ||
            left.id.localeCompare(right.id)
        )
        .map((row) => row.id)
    )
    for (const row of rows)
      expect(Object.keys(row).sort()).toEqual([
        'createdAt',
        'reason',
        'reportPublicId',
        'status',
        'targetKind',
        'updatedAt',
        'version'
      ])
    expect(JSON.stringify(rows)).not.toContain(base.listing.listingPublicId)
    expect(JSON.stringify(rows)).not.toContain('Private reporter')
    expect(JSON.stringify(rows)).not.toContain('shitstorm')
    expect(await base.moderationSnapshot()).toEqual(before)
  })

  it('audits every successful evidence open, normalizes UUIDs and never changes report version', async () => {
    const base = await setup()
    const before = await base.moderationSnapshot()
    const first = await base.owner.caller.mutation(open, {
      reportPublicId: base.report.reportPublicId.toUpperCase()
    })
    const second = await base.owner.caller.mutation(open, {
      reportPublicId: base.report.reportPublicId
    })
    expect(second).toEqual(first)
    expect(first).toMatchObject({
      version: 0,
      reporter: { username: 'AdmissionPlayer' },
      details: 'Private reporter account of events',
      evidence: {
        title: 'A shitstorm campaign',
        expectations: { contentGuidance: 'A shitstorm of adventure' }
      }
    })
    const after = await base.moderationSnapshot()
    expect(after.reports).toEqual(before.reports)
    expect(after.audits).toHaveLength(2)
    for (const audit of after.audits)
      expect(audit).toMatchObject({
        moderatorUserId: base.owner.userId,
        reportId: base.report.reportPublicId,
        action: 'VIEWED',
        affectedProfileId: null,
        affectedListingId: null,
        beforeState: { reportStatus: 'SUBMITTED', reportVersion: 0 },
        afterState: { reportStatus: 'SUBMITTED', reportVersion: 0 }
      })
    expect(after.audits[0]?.id).not.toBe(after.audits[1]?.id)
    await expect(
      base.owner.caller.mutation(open, { reportPublicId: crypto.randomUUID() })
    ).rejects.toThrow('not found')
    expect(await base.moderationSnapshot()).toEqual(after)
  })

  it.each(['RESOLVE', 'DISMISS'] as const)(
    'reviews then %s with immutable evidence, monotonic timestamps and exact audit states',
    async (action) => {
      const base = await setup()
      const before = await base.moderationSnapshot()
      const initial = before.reports[0]!
      const start = {
        reportPublicId: initial.id.toUpperCase(),
        action: 'START_REVIEW',
        expectedVersion: 0,
        reason: '  Checking evidence  '
      } as const
      await expect(base.owner.caller.mutation(review, { ...start, action })).rejects.toThrow(
        'transition'
      )
      expect(await base.moderationSnapshot()).toEqual(before)
      await base.t.run((ctx) =>
        ctx.db.patch(initial._id, { updatedAt: '2099-01-01T00:00:00.000Z' })
      )
      const started = await base.owner.caller.mutation(review, start)
      expect(started).toMatchObject({ status: 'UNDER_REVIEW', version: 1 })
      expect(Date.parse(started.updatedAt)).toBeGreaterThan(Date.parse('2099-01-01T00:00:00.000Z'))
      const reviewing = await base.moderationSnapshot()
      await expect(
        base.owner.caller.mutation(review, { ...start, expectedVersion: 1 })
      ).rejects.toThrow('transition')
      await expect(base.owner.caller.mutation(review, { ...start, action })).rejects.toThrow(
        'version conflict'
      )
      expect(await base.moderationSnapshot()).toEqual(reviewing)
      const final = await base.owner.caller.mutation(review, {
        ...start,
        action,
        expectedVersion: 1,
        reason: 'Final decision'
      })
      expect(final).toMatchObject({
        status: action === 'RESOLVE' ? 'RESOLVED' : 'DISMISSED',
        version: 2
      })
      expect(Date.parse(final.updatedAt)).toBeGreaterThan(Date.parse(started.updatedAt))
      const after = await base.moderationSnapshot()
      expect(after.reports[0]).toMatchObject({
        evidenceSnapshot: initial.evidenceSnapshot,
        queuePriority: 2,
        reviewStartedAt: started.updatedAt,
        resolvedAt: final.updatedAt,
        createdAt: initial.createdAt
      })
      expect(
        after.audits.map(({ action: auditAction, reason, beforeState, afterState }) => ({
          action: auditAction,
          reason,
          beforeState,
          afterState
        }))
      ).toEqual([
        {
          action: 'START_REVIEW',
          reason: 'Checking evidence',
          beforeState: { reportStatus: 'SUBMITTED', reportVersion: 0 },
          afterState: { reportStatus: 'UNDER_REVIEW', reportVersion: 1, action: 'START_REVIEW' }
        },
        {
          action,
          reason: 'Final decision',
          beforeState: { reportStatus: 'UNDER_REVIEW', reportVersion: 1 },
          afterState: { reportStatus: final.status, reportVersion: 2, action }
        }
      ])
      for (const next of ['START_REVIEW', 'RESOLVE', 'DISMISS'] as const)
        await expect(
          base.owner.caller.mutation(review, {
            ...start,
            action: next,
            expectedVersion: 2
          })
        ).rejects.toThrow('transition')
      expect(await base.moderationSnapshot()).toEqual(after)
    }
  )

  it('serializes conflicting reviewers into one transition and one audit', async () => {
    const base = await setup()
    const second = await base.addActor('SecondModerator')
    await base.t.mutation(setRole, { userId: second.userId, role: 'superadmin' })
    const command = {
      reportPublicId: base.report.reportPublicId,
      action: 'START_REVIEW',
      expectedVersion: 0,
      reason: 'Review'
    } as const
    const results = await Promise.allSettled([
      base.owner.caller.mutation(review, command),
      second.caller.mutation(review, command)
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const after = await base.moderationSnapshot()
    expect(after.reports[0]).toMatchObject({ version: 1, status: 'UNDER_REVIEW' })
    expect(after.audits).toHaveLength(1)
  })

  it.each(['OPEN', 'REVIEW'] as const)(
    'rolls back all %s writes when final evidence presentation fails',
    async (operation) => {
      const base = await setup()
      const before = await base.moderationSnapshot()
      const fault = vi
        .spyOn(documents, 'presentModerationReport')
        .mockRejectedValueOnce(new Error('Injected evidence presentation failure'))
      try {
        await expect(
          operation === 'OPEN'
            ? base.owner.caller.mutation(open, { reportPublicId: base.report.reportPublicId })
            : base.owner.caller.mutation(review, {
                reportPublicId: base.report.reportPublicId,
                action: 'START_REVIEW',
                expectedVersion: 0,
                reason: 'Review'
              })
        ).rejects.toThrow('Injected evidence presentation failure')
      } finally {
        fault.mockRestore()
      }
      expect(await base.moderationSnapshot()).toEqual(before)
    }
  )

  it('rolls back a report transition on audit failure and rejects unsupported actions or forged authority', async () => {
    const base = await setup()
    const input = {
      reportPublicId: base.report.reportPublicId,
      action: 'START_REVIEW',
      expectedVersion: 0,
      reason: 'Review'
    } as const
    const before = await base.moderationSnapshot()
    const fault = vi
      .spyOn(documents, 'auditReportReview')
      .mockRejectedValueOnce(new Error('Injected audit failure'))
    try {
      await expect(base.owner.caller.mutation(review, input)).rejects.toThrow(
        'Injected audit failure'
      )
    } finally {
      fault.mockRestore()
    }
    const forged = makeFunctionReference<
      'mutation',
      Record<string, unknown>,
      SocialModerationEvidenceDto
    >('social/moderation:review')
    for (const extra of [
      { isSuperAdmin: true },
      { moderatorUserId: base.owner.userId },
      { action: 'HIDE_LISTING' },
      { action: 'RESTORE_LISTING' },
      { action: 'SUSPEND_PROFILE' },
      { action: 'RESTORE_PROFILE' },
      { expectedVersion: -1 },
      { reason: '' },
      { reason: 'x'.repeat(4001) }
    ])
      await expect(base.owner.caller.mutation(forged, { ...input, ...extra })).rejects.toThrow()
    expect(await base.moderationSnapshot()).toEqual(before)
  })

  it.each(['REPORTER', 'PROFILE_TARGET', 'MODERATOR'] as const)(
    'allows real account deletion while retaining %s evidence',
    async (reference) => {
      const base = await setup()
      const actor =
        reference === 'REPORTER'
          ? base.other
          : await base.addActor(
              reference === 'PROFILE_TARGET' ? 'RetainedProfileTarget' : 'RetainedModerator'
            )
      let reportPublicId = base.report.reportPublicId
      if (reference === 'PROFILE_TARGET') {
        const target = await base.t.run((ctx) =>
          ctx.db
            .query('socialProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', actor.userId))
            .unique()
        )
        if (!target) throw new Error('Missing target profile.')
        const report = await base.other.caller.mutation(create, {
          input: {
            targetKind: 'PROFILE',
            targetPublicId: target.id,
            reason: 'OTHER',
            details: 'Retained profile evidence'
          }
        })
        reportPublicId = report.reportPublicId
      }
      if (reference === 'MODERATOR') {
        await base.t.mutation(setRole, { userId: actor.userId, role: 'superadmin' })
        await actor.caller.mutation(open, { reportPublicId })
      }
      const account = await base.t.run(async (ctx) => {
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', actor.userId))
          .unique()
        if (!profile) throw new Error('Missing account.')
        await consumeSocialRateLimit(ctx, actor.userId, 'REPORT')
        return profile
      })
      const socialProfile = await base.t.run((ctx) =>
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', actor.userId))
          .unique()
      )
      if (!socialProfile) throw new Error('Missing Social profile.')
      const evidenceBefore = await base.moderationSnapshot()
      if (reference === 'MODERATOR')
        expect(evidenceBefore.audits).toEqual([
          expect.objectContaining({ moderatorUserId: actor.userId, action: 'VIEWED' })
        ])

      await deleteAccountCompletely(base.t, account.authUserId)

      expect(
        await base.t.run(async (ctx) => ({
          authUser: await ctx.runQuery(components.betterAuth.adapter.findOne, {
            model: 'user',
            where: [{ field: '_id', value: account.authUserId }]
          }),
          account: await ctx.db.get(account._id),
          profile: await ctx.db
            .query('socialProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', actor.userId))
            .unique(),
          reports: await ctx.db.query('socialReports').take(40),
          audits: await ctx.db.query('socialModerationActions').take(40)
        }))
      ).toEqual({
        authUser: null,
        account: null,
        profile: null,
        reports: evidenceBefore.reports,
        audits: evidenceBefore.audits
      })
      expect(await readSocialRateLimits(base.t, actor.userId, 'REPORT')).toEqual(
        clearedReportLimits
      )
      await expect(actor.caller.query(api.account.identity, {})).rejects.toThrow('Unauthenticated')
      if (reference === 'REPORTER')
        await expect(base.owner.caller.mutation(open, { reportPublicId })).resolves.toMatchObject({
          reporter: {
            profilePublicId: socialProfile.id,
            username: 'Deleted user'
          }
        })
    }
  )
  it('still deletes an unrelated account and its Social counters without breaking retained evidence reads', async ({
    onTestFinished
  }) => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const base = await setup()
    const unrelated = await base.addActor('UnrelatedDeparture')
    const account = await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', unrelated.userId))
        .unique()
      if (!profile) throw new Error('Missing unrelated account.')
      await consumeSocialRateLimit(ctx, unrelated.userId, 'REPORT')
      return profile
    })
    const before = await base.moderationSnapshot()
    const scheduled = await advanceAccountDeletionToProvider(
      base.t,
      account.authUserId,
      unrelated.userId
    )
    await base.t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'user', where: [{ field: '_id', value: account.authUserId }] },
        onDeleteHandle: await createFunctionHandle(internal.auth.onDelete)
      })
    )
    await drainScheduledWork(base.t)
    expect(await scheduledSince(base.t, scheduled)).toEqual([
      { name: 'accountDeletionFinish:purge', state: 'success' },
      { name: 'notifications/delivery:purgeRecipient', state: 'success' },
      { name: 'media/assets:purgeAccount', state: 'success' },
      { name: 'social/accountCleanup:run', state: 'success' }
    ])
    expect(
      await base.t.run(async (ctx) => ({
        authUser: await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: 'user',
          where: [{ field: '_id', value: account.authUserId }]
        }),
        account: await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', unrelated.userId))
          .unique(),
        profile: await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', unrelated.userId))
          .unique()
      }))
    ).toEqual({ authUser: null, account: null, profile: null })
    expect(await readSocialRateLimits(base.t, unrelated.userId, 'REPORT')).toEqual(
      clearedReportLimits
    )
    expect(await base.moderationSnapshot()).toEqual(before)
    await expect(
      base.owner.caller.mutation(open, {
        reportPublicId: base.report.reportPublicId
      })
    ).resolves.toMatchObject({ evidence: { title: 'A shitstorm campaign' } })
    const after = await base.moderationSnapshot()
    expect(after.reports).toEqual(before.reports)
    expect(after.audits).toEqual([expect.objectContaining({ action: 'VIEWED' })])
  })
})
