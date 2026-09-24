import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BeginCampaignCopyInput,
  CampaignCopyListInput,
  CampaignCopyListPage,
  CampaignCopyLookup,
  CampaignCopyProgress
} from '@artificer-toolkit/schema/api/campaignCopy'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignNotebookSectionDto,
  UpdateCampaignNotebookSectionInput
} from '@artificer-toolkit/schema/api/campaignSessions'
import { scheduleOwnerCopyCleanup } from './copyJobCleanup'
import { api } from '../_generated/api'
import { fixture as characterFixture } from '../../tests/fixtures/characters'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const begin = makeFunctionReference<'mutation', BeginCampaignCopyInput, CampaignCopyProgress>(
  'campaigns/copyJobs:begin'
)
const step = makeFunctionReference<'mutation', { copyId: string }, null>('campaigns/copyJobs:step')
const run = makeFunctionReference<'mutation', { copyId: string }, null>('campaigns/copyJobs:run')
const cancel = makeFunctionReference<'mutation', CampaignCopyLookup, CampaignCopyProgress>(
  'campaigns/copyJobs:cancel'
)
const progress = makeFunctionReference<'query', CampaignCopyLookup, CampaignCopyProgress>(
  'campaigns/copyJobs:progress'
)
const list = makeFunctionReference<'query', CampaignCopyListInput, CampaignCopyListPage>(
  'campaigns/copyJobs:list'
)
const cleanup = makeFunctionReference<'mutation', { copyId: string }, null>(
  'campaigns/copyJobCleanup:cleanup'
)
const updateNotebook = makeFunctionReference<
  'mutation',
  UpdateCampaignNotebookSectionInput,
  CampaignNotebookSectionDto
>('campaigns/notebooks:update')

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const input: CreateCampaignInput = {
  name: 'Selected copy source',
  description: '<p>private source</p>',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  toneDetails: null,
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

describe('Campaign selected notebook copy jobs', () => {
  it('copies only selected categories in bounded pages and leaves the source exact', async () => {
    const base = await characterFixture()
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'SelectedOwner',
      bio: null
    })
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const source = await base.owner.caller.mutation(create, input)
    await base.t.run(async (ctx) => {
      for (let index = 0; index < 9; index++)
        await ctx.db.insert('campaignNotebookSections', {
          id: crypto.randomUUID(),
          campaignId: source.id,
          title: `People ${index}`,
          content: `<p>${index}</p>`,
          visibility: index % 2 ? 'SHARED' : 'GM_PRIVATE',
          category: 'PEOPLE',
          sortOrder: index,
          version: 4,
          createdBy: base.other.userId,
          updatedBy: base.other.userId,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z'
        })
      await ctx.db.insert('campaignNotebookSections', {
        id: crypto.randomUUID(),
        campaignId: source.id,
        title: 'Place',
        content: '<p>not selected</p>',
        visibility: 'SHARED',
        category: 'PLACES',
        sortOrder: 99,
        version: 2,
        createdBy: base.other.userId,
        updatedBy: base.other.userId,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      })
    })
    const before = await base.t.run((ctx) => ctx.db.query('campaignNotebookSections').collect())
    const progress = await base.owner.caller.mutation(begin, {
      campaignId: source.id,
      expectedVersion: source.version,
      commandId: crypto.randomUUID(),
      notebookCategories: ['PEOPLE']
    })
    await base.t.mutation(step, { copyId: progress.copyId })
    await base.t.mutation(step, { copyId: progress.copyId })
    await base.t.mutation(step, { copyId: progress.copyId })
    const after = await base.t.run(async (ctx) => ({
      notes: await ctx.db.query('campaignNotebookSections').collect(),
      campaigns: await ctx.db.query('campaigns').collect()
    }))
    expect(after.notes.filter((row) => row.campaignId === source.id)).toEqual(before)
    const destination = after.campaigns.find((row) => row.id !== source.id)!
    const copied = after.notes
      .filter((row) => row.campaignId === destination.id)
      .sort((left, right) => left.sortOrder - right.sortOrder)
    const sourcePeople = before
      .filter((row) => row.category === 'PEOPLE')
      .sort((left, right) => left.sortOrder - right.sortOrder)
    expect(copied).toHaveLength(sourcePeople.length)
    for (const [index, copiedRow] of copied.entries()) {
      const sourceRow = sourcePeople[index]!
      expect(copiedRow).toMatchObject({
        category: sourceRow.category,
        title: sourceRow.title,
        content: sourceRow.content,
        visibility: sourceRow.visibility,
        sortOrder: sourceRow.sortOrder,
        campaignId: destination.id,
        version: 0,
        createdBy: base.owner.userId,
        updatedBy: base.owner.userId
      })
      expect(copiedRow.id).not.toBe(sourceRow.id)
      expect(copiedRow.createdAt).not.toBe(sourceRow.createdAt)
      expect(copiedRow.updatedAt).not.toBe(sourceRow.updatedAt)
    }
  }, 30_000)
  it('publishes an empty selected copy immediately and makes exact replay observable without copying notes', async () => {
    const base = await characterFixture()
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'EmptyCopyOwner',
      bio: null
    })
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const source = await base.owner.caller.mutation(create, input)
    const command = {
      campaignId: source.id,
      expectedVersion: source.version,
      commandId: crypto.randomUUID(),
      notebookCategories: []
    }
    const before = await base.t.run(async (ctx) => ({
      notes: await ctx.db.query('campaignNotebookSections').collect(),
      jobs: await ctx.db.query('campaignCopyJobs').collect()
    }))
    const first = await base.owner.caller.mutation(begin, command)
    expect(first).toMatchObject({
      status: 'COMPLETED',
      copiedSections: 0,
      destination: expect.objectContaining({ name: source.name })
    })
    expect(await base.owner.caller.mutation(begin, command)).toEqual(first)
    const after = await base.t.run(async (ctx) => ({
      notes: await ctx.db.query('campaignNotebookSections').collect(),
      jobs: await ctx.db.query('campaignCopyJobs').collect()
    }))
    expect(after.notes).toEqual(before.notes)
    expect(after.jobs).toHaveLength(1)
    await expect(
      base.owner.caller.mutation(begin, { ...command, notebookCategories: ['GENERAL'] })
    ).rejects.toThrow('different input')
    await expect(
      base.owner.caller.mutation(begin, { ...command, expectedVersion: source.version + 1 })
    ).rejects.toThrow('different input')
  })

  it('cancels a running staged copy idempotently and stale callbacks leave the terminal job unchanged', async () => {
    const base = await characterFixture()
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'CancelCopyOwner',
      bio: null
    })
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const source = await base.owner.caller.mutation(create, input)
    await base.t.run((ctx) =>
      ctx.db.insert('campaignNotebookSections', {
        id: crypto.randomUUID(),
        campaignId: source.id,
        title: 'Stage',
        content: '<p>Stage</p>',
        visibility: 'GM_PRIVATE',
        category: 'GENERAL',
        sortOrder: 0,
        version: 1,
        createdBy: base.owner.userId,
        updatedBy: base.owner.userId,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    )
    const job = await base.owner.caller.mutation(begin, {
      campaignId: source.id,
      expectedVersion: source.version,
      commandId: crypto.randomUUID(),
      notebookCategories: ['GENERAL']
    })
    await base.t.mutation(step, { copyId: job.copyId })
    const cancelled = await base.owner.caller.mutation(cancel, { copyId: job.copyId })
    expect(cancelled.status).toBe('CLEANING')
    expect(await base.owner.caller.mutation(cancel, { copyId: job.copyId })).toEqual(cancelled)
    await base.t.mutation(cleanup, { copyId: job.copyId })
    const terminal = await base.owner.caller.query(progress, { copyId: job.copyId })
    expect(terminal.status).toBe('CANCELLED')
    const snapshot = await base.t.run(async (ctx) => ({
      jobs: await ctx.db.query('campaignCopyJobs').collect(),
      notes: await ctx.db.query('campaignNotebookSections').collect(),
      campaigns: await ctx.db.query('campaigns').collect()
    }))
    await base.t.mutation(run, { copyId: job.copyId })
    await base.t.mutation(step, { copyId: crypto.randomUUID() })
    await base.t.mutation(cleanup, { copyId: crypto.randomUUID() })
    expect(
      await base.t.run(async (ctx) => ({
        jobs: await ctx.db.query('campaignCopyJobs').collect(),
        notes: await ctx.db.query('campaignNotebookSections').collect(),
        campaigns: await ctx.db.query('campaigns').collect()
      }))
    ).toEqual(snapshot)
  })
  it('fails a selected copy after a public notebook revision changes and cleans its unpublished stage', async () => {
    const base = await characterFixture()
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'RevisionCopyOwner',
      bio: null
    })
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const source = await base.owner.caller.mutation(create, input)
    const sectionId = crypto.randomUUID()
    await base.t.run((ctx) =>
      ctx.db.insert('campaignNotebookSections', {
        id: sectionId,
        campaignId: source.id,
        title: 'Public',
        content: '<p>before</p>',
        visibility: 'SHARED',
        category: 'GENERAL',
        sortOrder: 0,
        version: 0,
        createdBy: base.owner.userId,
        updatedBy: base.owner.userId,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    )
    const job = await base.owner.caller.mutation(begin, {
      campaignId: source.id,
      expectedVersion: source.version,
      commandId: crypto.randomUUID(),
      notebookCategories: ['GENERAL']
    })
    await base.owner.caller.mutation(updateNotebook, {
      campaignId: source.id,
      sectionId,
      content: '<p>after</p>',
      expectedVersion: 0
    })
    await base.t.mutation(run, { copyId: job.copyId })
    await base.t.mutation(cleanup, { copyId: job.copyId })
    const state = await base.t.run(async (ctx) => ({
      jobs: await ctx.db.query('campaignCopyJobs').collect(),
      campaigns: await ctx.db.query('campaigns').collect(),
      notes: await ctx.db.query('campaignNotebookSections').collect()
    }))
    expect(state.jobs.find((row) => row.id === job.copyId)).toMatchObject({ status: 'FAILED' })
    expect(state.campaigns.filter((row) => row.id !== source.id)).toEqual([])
    expect(state.notes.filter((row) => row.campaignId !== source.id)).toEqual([])
    expect(state.notes.find((row) => row.id === sectionId)).toMatchObject({
      content: '<p>after</p>',
      version: 1
    })
  })
  it('removes more than eight pending jobs after source loss while retaining a completed destination', async () => {
    const base = await characterFixture()
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'SweepCopyOwner',
      bio: null
    })
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const source = await base.owner.caller.mutation(create, input)
    const completed = await base.owner.caller.mutation(begin, {
      campaignId: source.id,
      expectedVersion: source.version,
      commandId: crypto.randomUUID(),
      notebookCategories: []
    })
    const pending = await Promise.all(
      Array.from({ length: 9 }, () =>
        base.owner.caller.mutation(begin, {
          campaignId: source.id,
          expectedVersion: source.version,
          commandId: crypto.randomUUID(),
          notebookCategories: ['GENERAL']
        })
      )
    )
    expect(pending).toHaveLength(9)
    expect(pending.every((job) => job.status === 'RUNNING' && job.destination === null)).toBe(true)
    vi.useFakeTimers()
    try {
      await base.owner.caller.mutation(api.campaigns.deletion.remove, {
        campaignId: source.id,
        expectedVersion: source.version,
        confirmation: 'DELETE'
      })
      await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    } finally {
      vi.useRealTimers()
    }
    const state = await base.t.run(async (ctx) => ({
      jobs: await ctx.db.query('campaignCopyJobs').collect(),
      campaigns: await ctx.db.query('campaigns').collect(),
      notes: await ctx.db.query('campaignNotebookSections').collect()
    }))
    expect(state.jobs).toEqual([])
    expect(state.campaigns.find((row) => row.id === completed.destination!.id)).toBeTruthy()
    expect(state.notes.filter((row) => row.campaignId !== completed.destination!.id)).toEqual([])
  })

  it('fails expired pending work and lets stale deleted-job callbacks return without writes', async () => {
    vi.useFakeTimers()
    try {
      const base = await characterFixture()
      await base.owner.caller.mutation(api.account.updateProfile, {
        username: 'ExpiryCopyOwner',
        bio: null
      })
      await base.t.run((ctx) =>
        ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
      )
      const source = await base.owner.caller.mutation(create, input)
      const job = await base.owner.caller.mutation(begin, {
        campaignId: source.id,
        expectedVersion: source.version,
        commandId: crypto.randomUUID(),
        notebookCategories: ['GENERAL']
      })
      const expiresAt = await base.t.run(
        async (ctx) =>
          (await ctx.db
            .query('campaignCopyJobs')
            .withIndex('by_publicId', (q) => q.eq('id', job.copyId))
            .unique())!.expiresAt
      )
      vi.setSystemTime(expiresAt + 1)
      await base.t.mutation(cleanup, { copyId: job.copyId })
      await base.t.mutation(cleanup, { copyId: job.copyId })
      expect(await base.owner.caller.query(progress, { copyId: job.copyId })).toMatchObject({
        status: 'FAILED'
      })
      await base.t.run(async (ctx) => {
        const row = await ctx.db
          .query('campaignCopyJobs')
          .withIndex('by_publicId', (q) => q.eq('id', job.copyId))
          .unique()
        if (!row) throw new Error('Missing job.')
        await ctx.db.delete(row._id)
      })
      const before = await base.t.run(async (ctx) => ({
        jobs: await ctx.db.query('campaignCopyJobs').collect(),
        notes: await ctx.db.query('campaignNotebookSections').collect()
      }))
      await base.t.mutation(run, { copyId: job.copyId })
      await base.t.mutation(cleanup, { copyId: job.copyId })
      expect(
        await base.t.run(async (ctx) => ({
          jobs: await ctx.db.query('campaignCopyJobs').collect(),
          notes: await ctx.db.query('campaignNotebookSections').collect()
        }))
      ).toEqual(before)
    } finally {
      vi.useRealTimers()
    }
  })
  it('fails final publication when the staged owner is downgraded to the source-filled FREE limit without exposing a destination', async () => {
    const base = await characterFixture()
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'QuotaCopyOwner',
      bio: null
    })
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const source = await base.owner.caller.mutation(create, input)
    await base.t.run((ctx) =>
      ctx.db.insert('campaignNotebookSections', {
        id: crypto.randomUUID(),
        campaignId: source.id,
        title: 'Quota stage',
        content: '<p>quota</p>',
        visibility: 'GM_PRIVATE',
        category: 'GENERAL',
        sortOrder: 0,
        version: 0,
        createdBy: base.owner.userId,
        updatedBy: base.owner.userId,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    )
    const job = await base.owner.caller.mutation(begin, {
      campaignId: source.id,
      expectedVersion: source.version,
      commandId: crypto.randomUUID(),
      notebookCategories: ['GENERAL']
    })
    await base.t.mutation(step, { copyId: job.copyId })
    await base.t.run(async (ctx) => {
      const entitlement = await ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (!entitlement) throw new Error('Missing entitlement.')
      await ctx.db.patch(entitlement._id, { tier: 'FREE' })
    })
    await base.t.mutation(run, { copyId: job.copyId })
    const cleaning = await base.owner.caller.query(progress, { copyId: job.copyId })
    expect(cleaning.status).toBe('CLEANING')
    expect(cleaning.destination).toBeNull()
    await base.t.mutation(cleanup, { copyId: job.copyId })
    const after = await base.t.run(async (ctx) => ({
      campaigns: await ctx.db.query('campaigns').collect(),
      routes: await ctx.db.query('authoredRouteIds').collect(),
      memberships: await ctx.db.query('campaignMemberships').collect(),
      usage: await ctx.db.query('accountUsageEntries').collect(),
      notes: await ctx.db.query('campaignNotebookSections').collect()
    }))
    expect(after.campaigns.filter((row) => row.id !== source.id)).toEqual([])
    expect(
      after.routes.filter((row) => row.subjectKind === 'CAMPAIGN' && row.subjectId !== source.id)
    ).toEqual([])
    expect(after.memberships.filter((row) => row.campaignId !== source.id)).toEqual([])
    expect(
      after.usage.filter(
        (row) => row.resource === 'activeHostedCampaigns' && row.sourceId !== source.id
      )
    ).toEqual([])
    expect(after.notes.filter((row) => row.campaignId !== source.id)).toEqual([])
  })

  it.each([['inputFingerprint'], ['snapshotChecksum']])(
    'refuses corrupted %s from every owner entry point without writes',
    async (field) => {
      const base = await characterFixture()
      await base.owner.caller.mutation(api.account.updateProfile, {
        username: `Corrupt_${field}`,
        bio: null
      })
      await base.t.run((ctx) =>
        ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
      )
      const source = await base.owner.caller.mutation(create, input)
      const command: BeginCampaignCopyInput = {
        campaignId: source.id,
        expectedVersion: source.version,
        commandId: crypto.randomUUID(),
        notebookCategories: ['GENERAL']
      }
      const job = await base.owner.caller.mutation(begin, command)
      await base.t.run(async (ctx) => {
        const row = await ctx.db
          .query('campaignCopyJobs')
          .withIndex('by_publicId', (q) => q.eq('id', job.copyId))
          .unique()
        if (!row) throw new Error('Missing job.')
        await ctx.db.patch(row._id, { [field]: '0'.repeat(64) })
      })
      const before = await base.t.run(async (ctx) => ({
        jobs: await ctx.db.query('campaignCopyJobs').collect(),
        notes: await ctx.db.query('campaignNotebookSections').collect(),
        campaigns: await ctx.db.query('campaigns').collect()
      }))
      await expect(base.owner.caller.mutation(begin, command)).rejects.toThrow('invalid')
      await expect(base.owner.caller.query(progress, { copyId: job.copyId })).rejects.toThrow(
        'invalid'
      )
      await expect(
        base.owner.caller.query(list, { paginationOpts: { cursor: null, numItems: 8 } })
      ).rejects.toThrow('invalid')
      await expect(base.t.mutation(step, { copyId: job.copyId })).rejects.toThrow('invalid')
      await expect(base.t.mutation(cleanup, { copyId: job.copyId })).rejects.toThrow('invalid')
      expect(
        await base.t.run(async (ctx) => ({
          jobs: await ctx.db.query('campaignCopyJobs').collect(),
          notes: await ctx.db.query('campaignNotebookSections').collect(),
          campaigns: await ctx.db.query('campaigns').collect()
        }))
      ).toEqual(before)
    }
  )
  it('drains more than eight pending jobs after owner-profile loss as an isolated cleanup-helper simulation', async () => {
    const base = await characterFixture()
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'OwnerSweepCopy',
      bio: null
    })
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const source = await base.owner.caller.mutation(create, input)
    const jobs = await Promise.all(
      Array.from({ length: 9 }, () =>
        base.owner.caller.mutation(begin, {
          campaignId: source.id,
          expectedVersion: source.version,
          commandId: crypto.randomUUID(),
          notebookCategories: ['GENERAL']
        })
      )
    )
    await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (!profile) throw new Error('Missing profile.')
      await ctx.db.delete(profile._id)
      await scheduleOwnerCopyCleanup(ctx, base.owner.userId)
    })
    expect(jobs).toHaveLength(9)
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await base.t.run((ctx) => ctx.db.query('campaignCopyJobs').collect())).toEqual([])
  })
})
