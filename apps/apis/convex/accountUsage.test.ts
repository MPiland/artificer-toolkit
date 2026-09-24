import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  EncounterBlueprintDto,
  CreateEncounterBlueprintInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { publicationFixture } from '../tests/fixtures/publication'
import { syncAccountUsage } from './lib/accountUsage'
import { zeroAccountUsage } from '@artificer-toolkit/schema/projections/accountUsage'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const authModules = import.meta.glob('/apps/apis/convex/betterAuth/**/*.*s')
const create = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')

describe('account usage entries', () => {
  async function createSavedEncounter() {
    const { t, first, second } = await publicationFixture(modules, authModules, [])
    const blueprint = await first.caller.mutation(create, {
      gameSystemId: srdSystemRecord.id,
      name: 'Usage fixture',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 }]
    })
    return { t, first, second, blueprint }
  }

  it('counts an owned saved encounter once and removes its entry after source deletion', async () => {
    const { t, first, blueprint } = await createSavedEncounter()
    await t.run((ctx) => syncAccountUsage(ctx, 'savedEncounters', blueprint.id))
    await t.run((ctx) => syncAccountUsage(ctx, 'savedEncounters', blueprint.id))
    const profile = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
    )
    expect(profile?.entitlementUsage?.savedEncounters).toBe(1)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterBlueprints')
        .withIndex('by_publicId', (q) => q.eq('id', blueprint.id))
        .unique()
      if (!row) throw new Error('Missing saved encounter.')
      await ctx.db.delete(row._id)
      await syncAccountUsage(ctx, 'savedEncounters', blueprint.id)
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('accountUsageEntries')
          .withIndex('by_resource_sourceId', (q) =>
            q.eq('resource', 'savedEncounters').eq('sourceId', blueprint.id)
          )
          .unique()
      )
    ).toBeNull()
  }, 30000)

  it('does not count an incomplete import usage entry as committed state', async () => {
    const { t, first, blueprint } = await createSavedEncounter()
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
      const existing = await ctx.db
        .query('accountUsageEntries')
        .withIndex('by_resource_sourceId', (q) =>
          q.eq('resource', 'savedEncounters').eq('sourceId', blueprint.id)
        )
        .unique()
      if (!profile || !existing) throw new Error('Missing account usage fixture.')
      await ctx.db.delete(existing._id)
      await ctx.db.patch(profile._id, { entitlementUsage: zeroAccountUsage })
      const jobId = crypto.randomUUID()
      const previewId = crypto.randomUUID()
      const now = new Date().toISOString()
      await ctx.db.insert('importJobs', {
        id: jobId,
        ownerUserId: first.userId,
        previewId,
        command: {
          commandId: crypto.randomUUID(),
          previewId,
          selectedEntryIds: [blueprint.id],
          resolutions: [],
          customContentChoices: []
        },
        inputFingerprint: '0'.repeat(64),
        source: 'ARTIFICER_JSON',
        status: 'RUNNING',
        terminalStatus: null,
        phase: 'STAGING',
        entryIndex: 0,
        cursor: null,
        processedEntries: 0,
        totalEntries: 1,
        expectedStageCount: 1,
        stagedStageCount: 1,
        failureReason: null,
        summary: null,
        cleanupTableIndex: 0,
        cleanupCursor: null,
        expiresAt: Date.now() + 60_000,
        createdAt: now,
        updatedAt: now
      })
      await ctx.db.insert('accountUsageEntries', {
        resource: 'savedEncounters',
        sourceId: blueprint.id,
        ownerUserId: first.userId,
        importJobId: jobId
      })
    })
    await t.run((ctx) => syncAccountUsage(ctx, 'savedEncounters', blueprint.id))
    const result = await t.run(async (ctx) => ({
      profile: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique(),
      entry: await ctx.db
        .query('accountUsageEntries')
        .withIndex('by_resource_sourceId', (q) =>
          q.eq('resource', 'savedEncounters').eq('sourceId', blueprint.id)
        )
        .unique()
    }))
    expect(result.profile?.entitlementUsage?.savedEncounters).toBe(0)
    expect(result.entry).toMatchObject({ importJobId: expect.any(String) })
  }, 30000)
  it('removes a retained deleted-owner entry without recreating it', async () => {
    const { t, first, blueprint } = await createSavedEncounter()
    await t.run((ctx) => syncAccountUsage(ctx, 'savedEncounters', blueprint.id))
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
      if (!profile) throw new Error('Missing account profile.')
      await ctx.db.delete(profile._id)
      await syncAccountUsage(ctx, 'savedEncounters', blueprint.id)
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('accountUsageEntries')
          .withIndex('by_resource_sourceId', (q) =>
            q.eq('resource', 'savedEncounters').eq('sourceId', blueprint.id)
          )
          .unique()
      )
    ).toBeNull()
  }, 30000)

  it('moves an entry between current owners', async () => {
    const { t, first, second, blueprint } = await createSavedEncounter()
    await t.run((ctx) => syncAccountUsage(ctx, 'savedEncounters', blueprint.id))
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterBlueprints')
        .withIndex('by_publicId', (q) => q.eq('id', blueprint.id))
        .unique()
      if (!row) throw new Error('Missing saved encounter.')
      await ctx.db.patch(row._id, { ownerUserId: second.userId })
      await syncAccountUsage(ctx, 'savedEncounters', blueprint.id)
    })
    const profiles = await t.run(async (ctx) =>
      Promise.all(
        [first.userId, second.userId].map((userId) =>
          ctx.db
            .query('userProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .unique()
        )
      )
    )
    expect(profiles.map((profile) => profile?.entitlementUsage?.savedEncounters)).toEqual([0, 1])
  }, 30000)

  it('rolls back an unsafe stale-entry decrement', async () => {
    const { t, first } = await createSavedEncounter()
    const sourceId = crypto.randomUUID()
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
      if (!profile) throw new Error('Missing account profile.')
      await ctx.db.patch(profile._id, {
        entitlementUsage: {
          personalCharacters: 0,
          homebrewRoots: 0,
          activeHostedCampaigns: 0,
          publicListings: 0,
          savedEncounters: 0
        }
      })
      await ctx.db.insert('accountUsageEntries', {
        resource: 'savedEncounters',
        sourceId,
        ownerUserId: first.userId
      })
    })
    await expect(
      t.run((ctx) => syncAccountUsage(ctx, 'savedEncounters', sourceId))
    ).rejects.toThrow('underflow')
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('accountUsageEntries')
          .withIndex('by_resource_sourceId', (q) =>
            q.eq('resource', 'savedEncounters').eq('sourceId', sourceId)
          )
          .unique()
      )
    ).toMatchObject({ ownerUserId: first.userId })
  }, 30000)

  it.each([0.5, Number.MAX_SAFE_INTEGER])(
    'rejects an unsafe counter %s without adding an entry',
    async (savedEncounters) => {
      const { t, first, blueprint } = await createSavedEncounter()
      await t.run(async (ctx) => {
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', first.userId))
          .unique()
        const entry = await ctx.db
          .query('accountUsageEntries')
          .withIndex('by_resource_sourceId', (q) =>
            q.eq('resource', 'savedEncounters').eq('sourceId', blueprint.id)
          )
          .unique()
        if (!profile || !entry) throw new Error('Missing usage fixture.')
        await ctx.db.delete(entry._id)
        await ctx.db.patch(profile._id, {
          entitlementUsage: { ...zeroAccountUsage, savedEncounters }
        })
      })
      await expect(
        t.run((ctx) => syncAccountUsage(ctx, 'savedEncounters', blueprint.id))
      ).rejects.toThrow()
      expect(
        await t.run((ctx) =>
          ctx.db
            .query('accountUsageEntries')
            .withIndex('by_resource_sourceId', (q) =>
              q.eq('resource', 'savedEncounters').eq('sourceId', blueprint.id)
            )
            .unique()
        )
      ).toBeNull()
    },
    30000
  )
})
