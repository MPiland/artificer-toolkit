import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type LiveSessionAuthorityDto,
  type LiveSessionStorageRecoveryInput
} from '@artificer-toolkit/schema/api/liveSessionState'
import { LIVE_SESSION_TICKET_TTL_SECONDS } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import { api } from '../_generated/api'

const recoverStorage = makeFunctionReference<
  'mutation',
  LiveSessionStorageRecoveryInput,
  LiveSessionAuthorityDto
>('liveSessions/authority:recoverStorage')

describe('Campaign room storage recovery', () => {
  afterEach(() => vi.useRealTimers())

  it.each(['ACTIVATING', 'DO_ACTIVE', 'DRAINING'] as const)(
    'replaces %s authority without publishing the abandoned room state',
    async (phase) => {
      const base = await createEncounterSceneFixture()
      const epoch = crypto.randomUUID()
      const createdAt = new Date(Date.now() - 30_000).toISOString()
      const id = await base.t.run((ctx) =>
        ctx.db.insert('campaignLiveAuthorities', {
          campaignId: base.campaign.id,
          epoch,
          phase,
          activationFingerprint: '1'.repeat(64),
          persistedSequence: 9,
          persistedStateChecksum: '2'.repeat(64),
          lastCheckpoint: {
            checkpointId: crypto.randomUUID(),
            fromSequence: 0,
            fromChecksum: '1'.repeat(64),
            sequence: 9,
            checksum: '2'.repeat(64),
            payloadChecksum: '3'.repeat(64)
          },
          finalSequence: 10,
          finalStateChecksum: '4'.repeat(64),
          createdAt,
          updatedAt: createdAt
        })
      )
      const readProduct = () =>
        base.t.run(async (ctx) => ({
          campaign: await ctx.db
            .query('campaigns')
            .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
            .unique(),
          scene: await ctx.db
            .query('campaignScenes')
            .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
            .unique(),
          live: await ctx.db
            .query('sceneLiveStates')
            .withIndex('by_sceneId', (q) => q.eq('sceneId', base.sceneId))
            .unique(),
          presentation: await ctx.db
            .query('campaignScenePresentations')
            .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
            .unique()
        }))
      const before = await readProduct()
      // Pin the clock: the mutation's own Date.now() can read 1 ms ahead of the test's.
      vi.useFakeTimers({ toFake: ['Date'], now: Date.now() })
      const startedAt = Date.now()
      const replacement = await base.t.mutation(recoverStorage, {
        campaignId: base.campaign.id,
        epoch
      })
      expect(replacement.epoch).not.toBe(epoch)
      expect(replacement).toMatchObject({
        campaignId: base.campaign.id,
        phase: 'ACTIVATING',
        persistedSequence: 0
      })
      expect(replacement.activationFingerprint).not.toBe('1'.repeat(64))
      expect(replacement.persistedStateChecksum).toBe(replacement.activationFingerprint)
      expect(replacement.activationExpiresAt).toBeGreaterThanOrEqual(
        startedAt + LIVE_SESSION_TICKET_TTL_SECONDS * 1_000
      )
      expect(replacement.activationExpiresAt).toBeLessThanOrEqual(
        Date.now() + LIVE_SESSION_TICKET_TTL_SECONDS * 1_000
      )
      expect(replacement.createdAt).toBe(replacement.updatedAt)
      expect(Date.parse(replacement.createdAt)).toBeGreaterThanOrEqual(startedAt)
      expect(replacement).not.toHaveProperty('lastCheckpoint')
      expect(replacement).not.toHaveProperty('finalSequence')
      expect(replacement).not.toHaveProperty('finalStateChecksum')
      const stored = await base.t.run((ctx) => ctx.db.get(id))
      expect(stored).toEqual({ ...replacement, _id: id, _creationTime: stored!._creationTime })
      expect(await readProduct()).toEqual(before)
    }
  )

  it('reserves missing authority and leaves the replacement unchanged on retry or a stale request', async () => {
    const base = await createEncounterSceneFixture()
    const input = { campaignId: base.campaign.id, epoch: crypto.randomUUID() }
    const replacement = await base.t.mutation(recoverStorage, input)
    expect(replacement.phase).toBe('ACTIVATING')
    expect(replacement.epoch).not.toBe(input.epoch)
    expect(await base.t.mutation(recoverStorage, input)).toEqual(replacement)
    await base.t.run(async (ctx) => {
      const current = await ctx.db
        .query('campaignLiveAuthorities')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique()
      await ctx.db.patch(current!._id, {
        phase: 'DO_ACTIVE',
        activationExpiresAt: undefined,
        persistedSequence: 4,
        persistedStateChecksum: '5'.repeat(64)
      })
    })
    const before = await base.t.run((ctx) =>
      ctx.db
        .query('campaignLiveAuthorities')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique()
    )
    const { _id, _creationTime, ...newer } = before!
    expect(await base.t.mutation(recoverStorage, { ...input, epoch: crypto.randomUUID() })).toEqual(
      newer
    )
    expect(await base.t.mutation(recoverStorage, input)).toEqual(newer)
    expect(await base.t.run((ctx) => ctx.db.get(_id))).toEqual(before)
  })

  it.each(['DELETING', 'ARCHIVED'] as const)(
    'refuses %s Campaign recovery before changing authority',
    async (status) => {
      const base = await createEncounterSceneFixture()
      const input = { campaignId: base.campaign.id, epoch: crypto.randomUUID() }
      const current = await base.t.mutation(recoverStorage, input)
      if (status === 'DELETING') {
        const campaign = await base.t.run((ctx) =>
          ctx.db
            .query('campaigns')
            .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
            .unique()
        )
        await base.other.caller.mutation(api.campaigns.deletion.remove, {
          campaignId: base.campaign.id,
          expectedVersion: campaign!.version,
          confirmation: 'DELETE'
        })
      } else {
        await base.t.run(async (ctx) => {
          const campaign = await ctx.db
            .query('campaigns')
            .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
            .unique()
          await ctx.db.patch(campaign!._id, { status: 'ARCHIVED' })
        })
      }
      const readAuthority = () =>
        base.t.run((ctx) =>
          ctx.db
            .query('campaignLiveAuthorities')
            .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
            .unique()
        )
      const before = await readAuthority()
      await expect(
        base.t.mutation(recoverStorage, { ...input, epoch: current.epoch })
      ).rejects.toThrow(
        status === 'DELETING' ? 'Campaign not found.' : 'Archived Campaigns are read-only.'
      )
      expect(await readAuthority()).toEqual(before)
    }
  )
})
