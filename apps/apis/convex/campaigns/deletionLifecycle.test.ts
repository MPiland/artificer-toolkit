import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CampaignDeletionStatus } from '@artificer-toolkit/schema/api/campaignDeletion'
import type {
  LiveSessionAuthorityDto,
  LiveSessionActivationInput,
  LiveSessionDrainReleaseInput
} from '@artificer-toolkit/schema/api/liveSessionState'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { fixture } from '../../tests/fixtures/characters'
import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import * as deletionState from './deletionState'
import { runAccountDeletionInPlace } from '../../tests/fixtures/accountDeletion'

const status = makeFunctionReference<'query', { campaignId: string }, CampaignDeletionStatus>(
  'campaigns/deletion:status'
)
const run = makeFunctionReference<
  'action',
  { jobId: Id<'campaignDeletionJobs'>; revision: number },
  null
>('campaigns/deletionJobs:run')
const watchdog = makeFunctionReference<'mutation', { jobId: Id<'campaignDeletionJobs'> }, null>(
  'campaigns/deletionJobs:watchdog'
)
const claim = makeFunctionReference<'mutation', { campaignId: string }, LiveSessionAuthorityDto>(
  'liveSessions/authority:claim'
)
const activate = makeFunctionReference<
  'mutation',
  LiveSessionActivationInput,
  LiveSessionAuthorityDto
>('liveSessions/state:activate')
const beginDrain = makeFunctionReference<
  'mutation',
  LiveSessionDrainReleaseInput,
  LiveSessionAuthorityDto
>('liveSessions/authority:beginDrain')
const release = makeFunctionReference<'mutation', LiveSessionDrainReleaseInput, null>(
  'liveSessions/authority:release'
)

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function liveFixture() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, {
    name: 'Deleting live Campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const authority = await base.owner.caller.mutation(claim, { campaignId: campaign.id })
  const command = {
    campaignId: campaign.id,
    expectedVersion: campaign.version,
    confirmation: 'DELETE' as const
  }
  const readJob = async () => {
    const job = await base.t.run((ctx) =>
      ctx.db
        .query('campaignDeletionJobs')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .unique()
    )
    if (!job) throw new Error('Missing deletion job.')
    return job
  }
  return { ...base, campaign, authority, command, readJob }
}

describe('one Campaign deletion lifecycle', () => {
  it.each(['failed', 'ambiguous'] as const)(
    'retains the root through a %s room close and retries the captured authority',
    async (failure) => {
      const base = await liveFixture()
      const checksum = 'a'.repeat(64)
      await base.t.mutation(activate, {
        campaignId: base.campaign.id,
        epoch: base.authority.epoch,
        activationFingerprint: base.authority.activationFingerprint,
        stateChecksum: checksum
      })
      await base.owner.caller.mutation(api.campaigns.deletion.remove, base.command)
      const fence = {
        campaignId: base.campaign.id,
        epoch: base.authority.epoch,
        finalSequence: 0,
        finalStateChecksum: checksum
      }
      vi.stubEnv('LIVE_SESSION_WORKER_URL', 'http://localhost:8787')
      vi.stubEnv(
        'LIVE_SESSION_WORKER_SECRET',
        'test-live-session-worker-secret-that-is-long-enough'
      )
      const close = vi.fn<typeof fetch>(async () => {
        await base.t.mutation(beginDrain, fence)
        await base.t.mutation(release, fence)
        return new Response(null, { status: 200 })
      })
      close.mockImplementationOnce(async () => {
        if (failure === 'failed') return new Response(null, { status: 503 })
        await base.t.mutation(beginDrain, fence)
        await base.t.mutation(release, fence)
        throw new Error('Ambiguous control response')
      })
      vi.stubGlobal('fetch', close)
      const initial = await base.readJob()
      await expect(
        base.t.action(run, { jobId: initial._id, revision: initial.revision })
      ).rejects.toThrow()
      expect(await base.readJob()).toMatchObject({
        status: 'FAILED',
        stage: 'DRAIN_ROOM',
        phase: 0
      })
      expect(await base.t.run((ctx) => ctx.db.get(initial.campaignRootId))).not.toBeNull()
      await expect(
        base.owner.caller.query(api.campaigns.queries.get, { id: base.campaign.id })
      ).rejects.toThrow('Campaign not found')
      await base.owner.caller.mutation(api.campaigns.deletion.remove, base.command)
      const resumed = await base.readJob()
      await base.t.action(run, { jobId: resumed._id, revision: resumed.revision })
      expect(await base.readJob()).toMatchObject({
        status: 'DELETING',
        stage: 'ADMISSION',
        phase: 0
      })
      expect(close).toHaveBeenCalledTimes(failure === 'failed' ? 2 : 1)
      for (const [, init] of close.mock.calls)
        expect(JSON.parse(String(init?.body))).toEqual({
          campaignId: base.campaign.id,
          operation: { type: 'DELETE_ROOM' }
        })
    },
    60_000
  )

  it('cancels only the captured ACTIVATING epoch and purges historical OPEN Sessions in bounded pages', async () => {
    const base = await liveFixture()
    await base.owner.caller.mutation(api.campaigns.sessions.create, {
      campaignId: base.campaign.id
    })
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
        .first()
      if (!row) throw new Error('Missing Session.')
      const { _id, _creationTime, ...stored } = row
      for (let i = 0; i < 80; i++)
        await ctx.db.insert('campaignSessions', {
          ...stored,
          id: crypto.randomUUID(),
          sessionNumber: i + 2
        })
    })
    await base.owner.caller.mutation(api.campaigns.deletion.remove, base.command)
    await expect(
      base.t.mutation(activate, {
        campaignId: base.campaign.id,
        epoch: base.authority.epoch,
        activationFingerprint: base.authority.activationFingerprint,
        stateChecksum: 'a'.repeat(64)
      })
    ).rejects.toThrow('Campaign not found')
    const readSessions = () =>
      base.t.run((ctx) =>
        ctx.db
          .query('campaignSessions')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
          .collect()
      )
    expect(await readSessions()).toHaveLength(81)
    for (let i = 0; i < 150; i++) {
      const job = await base.readJob()
      if (job.status === 'DELETED') break
      await base.t.action(run, { jobId: job._id, revision: job.revision })
    }
    expect(await base.readJob()).toMatchObject({ status: 'DELETED' })
    expect(await readSessions()).toEqual([])
  }, 60_000)

  it.each([false, true])(
    'retries purge after owner and player account deletion (legacy root-absent job: %s)',
    async (legacy) => {
      const base = await liveFixture()
      await base.t.run((ctx) =>
        ctx.db.insert('campaignMemberships', {
          campaignId: base.campaign.id,
          userId: base.other.userId,
          role: 'PLAYER',
          status: 'ACTIVE',
          joinedAt: base.campaign.createdAt,
          accessStartedAt: base.campaign.createdAt,
          leftAt: null
        })
      )
      await base.owner.caller.mutation(api.campaigns.deletion.remove, base.command)
      for (let i = 0; i < 20; i++) {
        const current = await base.readJob()
        if (current.stage === 'PURGE') break
        await base.t.action(run, { jobId: current._id, revision: current.revision })
      }
      const job = await base.readJob()
      expect(job.stage).toBe('PURGE')
      await base.t.run(async (ctx) => {
        expect(await ctx.db.get(job.campaignRootId)).toBeNull()
        expect(
          await ctx.db
            .query('campaignMemberships')
            .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', base.campaign.id))
            .collect()
        ).toEqual([])
        if (legacy)
          await ctx.db.patch(job._id, {
            stage: undefined,
            liveAuthority: undefined,
            liveAuthorityId: undefined
          })
      })
      for (const userId of [base.owner.userId, base.other.userId]) {
        const profile = await base.t.run((ctx) =>
          ctx.db
            .query('userProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .unique()
        )
        if (!profile) throw new Error('Missing account profile.')
        await runAccountDeletionInPlace(base.t, profile.authUserId, userId)
      }
      const scheduledBefore = await base.t.run((ctx) =>
        ctx.db.system.query('_scheduled_functions').collect()
      )
      expect(
        scheduledBefore.filter((entry) => entry.name === 'campaigns/deletionJobs:watchdog')
      ).toHaveLength(1)
      vi.setSystemTime(Date.parse(job.updatedAt) + 60_000)
      await base.t.mutation(watchdog, { jobId: job._id })
      const scheduledAfter = await base.t.run((ctx) =>
        ctx.db.system.query('_scheduled_functions').collect()
      )
      expect(
        scheduledAfter.filter((entry) => entry.name === 'campaigns/deletionJobs:run')
      ).toHaveLength(
        scheduledBefore.filter((entry) => entry.name === 'campaigns/deletionJobs:run').length + 1
      )
      const fault = vi
        .spyOn(deletionState, 'removeCampaignState')
        .mockRejectedValueOnce(new Error('Temporary purge failure.'))
      await expect(base.t.action(run, { jobId: job._id, revision: job.revision })).rejects.toThrow(
        'Temporary purge failure'
      )
      fault.mockRestore()
      expect(await base.readJob()).toMatchObject({ status: 'FAILED', retryAttempt: 1 })
      const retry = makeFunctionReference<
        'mutation',
        { jobId: Id<'campaignDeletionJobs'>; revision: number },
        null
      >('campaigns/deletionJobs:retry')
      await base.t.mutation(retry, { jobId: job._id, revision: job.revision })
      for (let i = 0; i < 100; i++) {
        const current = await base.readJob()
        if (current.status === 'DELETED') break
        await base.t.action(run, { jobId: current._id, revision: current.revision })
      }
      expect(await base.readJob()).toMatchObject({ status: 'DELETED' })
    },
    60_000
  )

  it.each([1, 1600])(
    'revokes access before purging %i history rows, records failure, and resumes exact cleanup',
    async (count) => {
      const base = await fixture()
      const input = {
        name: 'Private Campaign',
        format: 'ONGOING' as const,
        toneTags: ['HEROIC' as const],
        contentMaturity: 'STANDARD' as const,
        gameSystemId: srdSystemRecord.id,
        primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
      }
      const target = await base.owner.caller.mutation(api.campaigns.create.create, input)
      const unrelated = await base.other.caller.mutation(api.campaigns.create.create, input)
      const payloadJson = JSON.stringify({ note: 'x'.repeat(12_000) })
      await base.t.run(async (ctx) => {
        await ctx.db.insert('campaignMemberships', {
          campaignId: target.id,
          userId: base.other.userId,
          role: 'PLAYER',
          status: 'ACTIVE',
          joinedAt: target.createdAt,
          accessStartedAt: target.createdAt,
          leftAt: null
        })
        for (let i = 0; i < count; i++)
          await ctx.db.insert('campaignEvents', {
            id: crypto.randomUUID(),
            campaignId: target.id,
            actorUserId: base.owner.userId,
            type: 'CAMPAIGN_CHARACTER_RECONCILED',
            visibility: 'OWNER',
            visibleInHistory: true,
            subjectCharacterId: null,
            createdAt: target.createdAt,
            payloadJson
          })
        for (const campaignId of [target.id, unrelated.id])
          for (let i = 0; i < 40; i++)
            await ctx.db.insert('campaignPartyItems', {
              campaignId,
              id: crypto.randomUUID(),
              equipmentId: club.id,
              quantity: 1,
              containerId: null
            })
      })
      const unrelatedBefore = await base.t.run((ctx) =>
        ctx.db
          .query('campaignPartyItems')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', unrelated.id))
          .collect()
      )
      const command = {
        campaignId: target.id,
        expectedVersion: target.version,
        confirmation: 'DELETE' as const
      }
      await expect(
        base.owner.caller.mutation(api.campaigns.deletion.remove, command)
      ).resolves.toEqual({ ok: true })
      const readJob = () =>
        base.t.run((ctx) =>
          ctx.db
            .query('campaignDeletionJobs')
            .withIndex('by_campaignId', (q) => q.eq('campaignId', target.id))
            .unique()
        )
      const job = await readJob()
      if (!job) throw new Error('Missing deletion job.')
      expect(job.status).toBe('DELETING')
      expect(await base.owner.caller.query(status, { campaignId: target.id })).toEqual({
        campaignId: target.id,
        expectedVersion: target.version,
        status: 'DELETING',
        error: null,
        updatedAt: job.updatedAt
      })
      for (const caller of [base.owner.caller, base.other.caller]) {
        await expect(caller.query(api.campaigns.queries.get, { id: target.id })).rejects.toThrow(
          'Campaign not found'
        )
        await expect(
          caller.query(api.campaigns.sessions.latestOpen, { campaignId: target.id })
        ).rejects.toThrow('Campaign not found')
        const list = await caller.query(api.campaigns.queries.list, {
          paginationOpts: { cursor: null, numItems: 8 }
        })
        expect(list.page.some((row) => row.id === target.id)).toBe(false)
      }
      await expect(base.other.caller.query(status, { campaignId: target.id })).rejects.toThrow(
        'Campaign not found'
      )
      await expect(base.t.query(status, { campaignId: target.id })).rejects.toThrow()
      await expect(
        base.other.caller.mutation(api.campaigns.deletion.remove, command)
      ).rejects.toThrow('Campaign not found')
      await expect(
        base.owner.caller.mutation(api.campaigns.deletion.remove, {
          ...command,
          expectedVersion: target.version + 1
        })
      ).rejects.toThrow('Campaign changed')
      expect(
        await base.t.run((ctx) =>
          ctx.db
            .query('campaignEvents')
            .withIndex('by_campaignId_id', (q) => q.eq('campaignId', target.id))
            .collect()
        )
      ).toHaveLength(count)
      if (count > 1) expect(count * payloadJson.length).toBeGreaterThan(16 * 1024 * 1024)

      while ((await readJob())?.stage !== 'PURGE') {
        const current = await readJob()
        if (!current) throw new Error('Missing deletion job.')
        await base.t.action(run, { jobId: current._id, revision: current.revision })
      }
      const purgeJob = await readJob()
      if (!purgeJob) throw new Error('Missing deletion job.')
      const original = deletionState.removeCampaignState
      const fault = vi
        .spyOn(deletionState, 'removeCampaignState')
        .mockImplementationOnce(async (ctx, captured) => {
          await original(ctx, captured)
          throw new Error('Injected cleanup page failure.')
        })
      await expect(
        base.t.action(run, { jobId: purgeJob._id, revision: purgeJob.revision })
      ).rejects.toThrow('Injected cleanup')
      fault.mockRestore()
      expect(await base.owner.caller.query(status, { campaignId: target.id })).toMatchObject({
        status: 'FAILED',
        error: 'Campaign cleanup failed. Retry deletion to resume.'
      })
      expect((await readJob())?.phase).toBe(job.phase)
      await base.owner.caller.mutation(api.campaigns.deletion.remove, command)
      const resumed = await readJob()
      expect(resumed?.status).toBe('DELETING')
      await base.t.action(run, { jobId: job._id, revision: job.revision })
      expect(await readJob()).toEqual(resumed)

      let pages = 0
      while (true) {
        const current = await readJob()
        if (!current || current.status !== 'DELETING') break
        await base.t.action(run, { jobId: current._id, revision: current.revision })
        if (++pages > 1000) throw new Error('Cleanup failed to converge.')
      }
      expect(await base.owner.caller.query(status, { campaignId: target.id })).toMatchObject({
        status: 'DELETED',
        error: null
      })
      expect(
        await base.t.run((ctx) =>
          ctx.db
            .query('campaignEvents')
            .withIndex('by_campaignId_id', (q) => q.eq('campaignId', target.id))
            .collect()
        )
      ).toEqual([])
      expect(
        await base.t.run((ctx) =>
          ctx.db
            .query('campaignPartyItems')
            .withIndex('by_campaignId_id', (q) => q.eq('campaignId', target.id))
            .collect()
        )
      ).toEqual([])
      expect(
        await base.t.run((ctx) =>
          ctx.db
            .query('campaignPartyItems')
            .withIndex('by_campaignId_id', (q) => q.eq('campaignId', unrelated.id))
            .collect()
        )
      ).toEqual(unrelatedBefore)
      const completed = await readJob()
      await base.owner.caller.mutation(api.campaigns.deletion.remove, command)
      expect(await readJob()).toEqual(completed)
      // A step stops paging once it has spent a quarter of any transaction limit.
      expect(pages).toBeGreaterThanOrEqual(
        Math.ceil((count * payloadJson.length) / (4 * 1024 * 1024))
      )
    },
    60_000
  )
})
