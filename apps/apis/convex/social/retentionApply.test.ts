import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type {
  SocialRetentionApplyInput,
  SocialRetentionApplyResult,
  SocialRetentionPreviewInput,
  SocialRetentionPreviewResult
} from '@artificer-toolkit/schema/api/socialRetention'
import { socialRetentionApplyInputSchema } from '@artificer-toolkit/schema/api/socialRetention'
import { socialStoredModerationActionSchema } from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import { fixture, snapshot } from '../../tests/fixtures/socialAdmission'
import { api } from '../_generated/api'

const apply = makeFunctionReference<
  'mutation',
  SocialRetentionApplyInput,
  SocialRetentionApplyResult
>('social/retention:apply')
const preview = makeFunctionReference<
  'query',
  SocialRetentionPreviewInput,
  SocialRetentionPreviewResult
>('social/retention:preview')
const cleanup = makeFunctionReference<'mutation', { reportId: string }, null>(
  'social/retention:cleanupReportActions'
)
const input = (phase: SocialRetentionApplyInput['phase']): SocialRetentionApplyInput => ({
  phase,
  asOf: '2026-09-01T00:00:00.000Z',
  paginationOpts: { cursor: null, numItems: 8 },
  confirm: 'purge-expired-social-data'
})
const previewInput = (phase: SocialRetentionApplyInput['phase']) => {
  const { confirm: _confirm, ...value } = input(phase)
  return value
}

async function oldApplicationReport() {
  const base = await fixture()
  const report = await base.owner.caller.mutation(api.social.reports.create, {
    input: {
      targetKind: 'APPLICATION',
      targetPublicId: base.applicationId,
      reason: 'OTHER',
      details: 'Retained report evidence'
    }
  })
  await base.t.run(async (ctx) => {
    const app = await ctx.db
      .query('socialApplications')
      .withIndex('by_publicId', (q) => q.eq('id', base.applicationId))
      .unique()
    if (!app) throw new Error('Missing application')
    await ctx.db.patch(app._id, {
      status: 'DECLINED',
      respondedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    const row = await ctx.db
      .query('socialReports')
      .withIndex('by_publicId', (q) => q.eq('id', report.reportPublicId))
      .unique()
    if (!row) throw new Error('Missing report')
    await ctx.db.patch(row._id, {
      status: 'DISMISSED',
      queuePriority: 2,
      reviewStartedAt: '2024-01-01T00:00:00.000Z',
      resolvedAt: '2024-08-01T00:00:00.000Z',
      updatedAt: '2024-08-01T00:00:00.000Z'
    })
    for (let index = 0; index < 17; index++)
      await ctx.db.insert(
        'socialModerationActions',
        socialStoredModerationActionSchema.parse({
          id: crypto.randomUUID(),
          moderatorUserId: base.owner.userId,
          reportId: report.reportPublicId,
          action: 'VIEWED',
          affectedProfileId: null,
          affectedListingId: null,
          reason: 'Audited evidence access',
          beforeState: { reportStatus: 'DISMISSED', reportVersion: 0 },
          afterState: { reportStatus: 'DISMISSED', reportVersion: 0 },
          createdAt: '2024-08-02T00:00:00.000Z'
        })
      )
  })
  return { ...base, report }
}

it('requires explicit apply confirmation and preserves a preview without writes', async () => {
  const base = await fixture()
  expect(socialRetentionApplyInputSchema.safeParse(previewInput('INVITATIONS')).success).toBe(false)
  expect(
    socialRetentionApplyInputSchema.safeParse({ ...input('INVITATIONS'), confirm: 'wrong' }).success
  ).toBe(false)
  const before = await snapshot(base)
  await base.t.query(preview, previewInput('INVITATIONS'))
  expect(await snapshot(base)).toEqual(before)
  await expect(
    base.t.mutation(apply, { ...input('INVITATIONS'), asOf: '2099-01-01T00:00:00.000Z' })
  ).rejects.toThrow()
  expect(await snapshot(base)).toEqual(before)
})

it('deletes only terminal invitations still eligible at apply time and retains unrelated Social data', async () => {
  const base = await fixture()
  await base.t.run(async (ctx) => {
    const invite = await ctx.db
      .query('campaignInvites')
      .withIndex('by_publicId', (q) => q.eq('id', base.acceptedInviteId))
      .unique()
    if (!invite) throw new Error('Missing invitation')
    await ctx.db.patch(invite._id, { respondedAt: '2026-01-01T00:00:00.000Z' })
  })
  expect((await base.t.query(preview, previewInput('INVITATIONS'))).eligible).toBe(1)
  await base.t.run(async (ctx) => {
    const invite = await ctx.db
      .query('campaignInvites')
      .withIndex('by_publicId', (q) => q.eq('id', base.acceptedInviteId))
      .unique()
    await ctx.db.patch(invite!._id, { respondedAt: '2026-03-05T00:00:00.000Z' })
  })
  const protectedState = await snapshot(base)
  expect((await base.t.mutation(apply, input('INVITATIONS'))).deleted).toBe(0)
  expect(await snapshot(base)).toEqual(protectedState)
  await base.t.run(async (ctx) => {
    const invite = await ctx.db
      .query('campaignInvites')
      .withIndex('by_publicId', (q) => q.eq('id', base.acceptedInviteId))
      .unique()
    await ctx.db.patch(invite!._id, { respondedAt: '2026-03-04T23:59:59.999Z' })
  })
  const result = await base.t.mutation(apply, input('INVITATIONS'))
  expect(result).toMatchObject({ deleted: 1, eligible: 1 })
  expect(
    Object.keys(result).every((key) =>
      [
        'scanned',
        'eligible',
        'deleted',
        'continueCursor',
        'isDone',
        'splitCursor',
        'pageStatus'
      ].includes(key)
    )
  ).toBe(true)
  expect(await snapshot(base)).toEqual({
    ...protectedState,
    invites: protectedState.invites.filter((row) => row.id !== base.acceptedInviteId)
  })
  expect((await base.t.mutation(apply, input('INVITATIONS'))).deleted).toBe(0)
})

it('resumes native cursors across deletions and keeps the strict 180-day boundary', async () => {
  const base = await fixture()
  const boundaryId = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    const invite = await ctx.db
      .query('campaignInvites')
      .withIndex('by_publicId', (q) => q.eq('id', base.acceptedInviteId))
      .unique()
    if (!invite) throw new Error('Missing accepted invitation.')
    const { _id, _creationTime, ...stored } = invite
    // Nine copies follow the two fixture invitations; the last sits exactly on the cutoff.
    for (let index = 0; index < 9; index++) {
      const respondedAt = index === 8 ? '2026-03-05T00:00:00.000Z' : '2026-03-04T23:59:59.999Z'
      await ctx.db.insert('campaignInvites', {
        ...stored,
        id: index === 8 ? boundaryId : crypto.randomUUID(),
        respondedAt,
        updatedAt: respondedAt
      })
    }
  })
  const first = await base.t.mutation(apply, input('INVITATIONS'))
  expect(first).toMatchObject({ scanned: 8, deleted: 6, isDone: false })
  const second = await base.t.mutation(apply, {
    ...input('INVITATIONS'),
    paginationOpts: { cursor: first.continueCursor, numItems: 8 }
  })
  expect(second).toMatchObject({ scanned: 3, deleted: 2, isDone: true })
  expect((await base.t.mutation(apply, input('INVITATIONS'))).deleted).toBe(0)
  expect(
    await base.t.run((ctx) =>
      ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', boundaryId))
        .unique()
    )
  ).toMatchObject({ respondedAt: '2026-03-05T00:00:00.000Z' })
})

it('keeps applications until expired reports are removed, then clears the report audit in bounded retry-safe batches', async () => {
  const base = await oldApplicationReport()
  const audits = () =>
    base.t.run((ctx) =>
      ctx.db
        .query('socialModerationActions')
        .withIndex('by_reportId_createdAt_id', (q) => q.eq('reportId', base.report.reportPublicId))
        .collect()
    )
  expect((await base.t.query(preview, previewInput('APPLICATIONS'))).eligible).toBe(1)
  expect((await base.t.mutation(apply, input('APPLICATIONS'))).deleted).toBe(0)
  await base.t.mutation(cleanup, { reportId: base.report.reportPublicId })
  expect(await audits()).toHaveLength(17)
  expect((await base.t.mutation(apply, input('REPORTS'))).deleted).toBe(1)
  expect(await base.t.run((ctx) => ctx.db.query('socialReports').collect())).toEqual([])
  expect(await audits()).toHaveLength(17)
  expect((await base.t.mutation(apply, input('APPLICATIONS'))).deleted).toBe(1)
  await base.t.mutation(cleanup, { reportId: base.report.reportPublicId })
  expect(await audits()).toHaveLength(9)
  await base.t.mutation(cleanup, { reportId: base.report.reportPublicId })
  expect(await audits()).toHaveLength(1)
  await base.t.mutation(cleanup, { reportId: base.report.reportPublicId })
  await base.t.mutation(cleanup, { reportId: base.report.reportPublicId })
  expect(await audits()).toEqual([])
  expect((await base.t.mutation(apply, input('REPORTS'))).deleted).toBe(0)
  expect((await snapshot(base)).applications.map((row) => row.id)).toContain(
    base.acceptedApplicationId
  )
})

it('finishes scheduled audit cleanup after the report purge returns', async () => {
  vi.useFakeTimers()
  try {
    const base = await oldApplicationReport()
    expect((await base.t.mutation(apply, input('REPORTS'))).deleted).toBe(1)
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await base.t.run((ctx) => ctx.db.query('socialModerationActions').collect())).toEqual([])
    expect((await base.t.mutation(apply, input('REPORTS'))).deleted).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

it('rolls back report deletion and its scheduled cleanup together when the owning transaction fails', async () => {
  const base = await oldApplicationReport()
  const state = () =>
    base.t.run(async (ctx) => ({
      reports: await ctx.db.query('socialReports').collect(),
      audits: await ctx.db.query('socialModerationActions').collect(),
      jobs: await ctx.db.system.query('_scheduled_functions').collect()
    }))
  const before = await state()
  await expect(
    base.t.mutation(async (ctx) => {
      await ctx.runMutation(apply, input('REPORTS'))
      throw new Error('Injected transaction failure')
    })
  ).rejects.toThrow('Injected transaction failure')
  expect(await state()).toEqual(before)
})

it('rechecks active membership protection and departure age before deleting an accepted application', async () => {
  const base = await fixture()
  await base.t.run(async (ctx) => {
    const app = await ctx.db
      .query('socialApplications')
      .withIndex('by_publicId', (q) => q.eq('id', base.acceptedApplicationId))
      .unique()
    await ctx.db.patch(app!._id, { respondedAt: '2026-01-01T00:00:00.000Z' })
  })
  expect((await base.t.mutation(apply, input('APPLICATIONS'))).deleted).toBe(0)
  await base.t.run(async (ctx) => {
    const member = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    await ctx.db.patch(member!._id, { status: 'LEFT', leftAt: '2026-03-05T00:00:00.000Z' })
  })
  expect((await base.t.mutation(apply, input('APPLICATIONS'))).deleted).toBe(0)
  await base.t.run(async (ctx) => {
    const member = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    await ctx.db.patch(member!._id, { leftAt: '2026-03-04T23:59:59.999Z' })
  })
  expect((await base.t.mutation(apply, input('APPLICATIONS'))).deleted).toBe(1)
  expect((await snapshot(base)).applications.map((row) => row.id)).toContain(base.applicationId)
})
