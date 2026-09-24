import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
} from '@artificer-toolkit/schema/api/encounters'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../tests/fixtures/characters'
import { publicationFixture } from '../tests/fixtures/publication'
import { internal } from './_generated/api'

const run = makeFunctionReference<'mutation', { reset?: boolean; batchSize?: number }, unknown>(
  'accountUsageBackfill:run'
)
const profiles = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'accountUsageBackfill:profiles'
)
const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const authModules = import.meta.glob('/apps/apis/convex/betterAuth/**/*.*s')

describe('account usage backfill', () => {
  it('runs the installed migration series before marking an account ready', async ({
    onTestFinished
  }) => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { t, owner } = await fixture()
    migrations.register(t)
    const profileId = await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      if (!profile) throw new Error('Missing profile.')
      await ctx.db.patch(profile._id, { entitlementUsageReady: false })
      return profile._id
    })
    await expect(t.mutation(profiles, {})).resolves.toMatchObject({
      Status: 'Migration failed: Account usage source backfills must finish before enabling totals.'
    })
    expect((await t.run((ctx) => ctx.db.get(profileId)))?.entitlementUsageReady).toBe(false)
    await t.mutation(run, { reset: true, batchSize: 1 })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const profile = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
    )
    expect(profile).toMatchObject({
      entitlementUsageReady: true,
      entitlementUsage: {
        personalCharacters: 0,
        homebrewRoots: 0,
        activeHostedCampaigns: 0,
        publicListings: 0,
        savedEncounters: 0
      }
    })
  }, 30000)

  it('replays retained deleted-owner sources without recreating usage entries', async ({
    onTestFinished
  }) => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { t, first } = await publicationFixture(modules, authModules, [])
    migrations.register(t)
    const blueprint = await first.caller.mutation(createBlueprint, {
      gameSystemId: srdSystemRecord.id,
      name: 'Deleted owner fixture',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 }]
    })
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
      if (!profile) throw new Error('Missing owner profile.')
      const entries = await ctx.db.query('accountUsageEntries').collect()
      for (const entry of entries) await ctx.db.delete(entry._id)
      await ctx.db.delete(profile._id)
    })
    await t.mutation(run, { reset: true })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    await t.mutation(run, { reset: true })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
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

  it('converges legacy and live saved encounters during a batch-size-one replay', async ({
    onTestFinished
  }) => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { t, first } = await publicationFixture(modules, authModules, [])
    migrations.register(t)
    const legacy = await first.caller.mutation(createBlueprint, {
      gameSystemId: srdSystemRecord.id,
      name: 'Legacy saved encounter',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 }]
    })
    const secondLegacy = await first.caller.mutation(createBlueprint, {
      gameSystemId: srdSystemRecord.id,
      name: 'Second legacy saved encounter',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 }]
    })
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
      if (!profile) throw new Error('Missing owner profile.')
      const entries = await ctx.db
        .query('accountUsageEntries')
        .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', first.userId))
        .collect()
      for (const entry of entries) await ctx.db.delete(entry._id)
      await ctx.db.patch(profile._id, {
        entitlementUsage: {
          personalCharacters: 0,
          homebrewRoots: 0,
          activeHostedCampaigns: 0,
          publicListings: 0,
          savedEncounters: 0
        },
        entitlementUsageReady: false
      })
    })
    const firstBatch = await t.mutation(internal.accountUsageBackfill.blueprints, {
      oneBatchOnly: true,
      dryRun: false,
      cursor: null,
      batchSize: 1
    })
    expect(firstBatch).toMatchObject({ isDone: false })
    expect(await t.run((ctx) => ctx.db.query('accountUsageEntries').collect())).toHaveLength(1)
    await t.mutation(run, { reset: true, batchSize: 1 })
    const live = await first.caller.mutation(createBlueprint, {
      gameSystemId: srdSystemRecord.id,
      name: 'Live saved encounter',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 }]
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    await t.mutation(run, { reset: true, batchSize: 1 })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const state = await t.run(async (ctx) => ({
      profile: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique(),
      entries: await ctx.db
        .query('accountUsageEntries')
        .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', first.userId))
        .collect()
    }))
    expect(state.profile).toMatchObject({
      entitlementUsageReady: true,
      entitlementUsage: expect.objectContaining({ savedEncounters: 3 })
    })
    expect(state.entries.map((entry) => entry.sourceId).sort()).toEqual(
      [legacy.id, secondLegacy.id, live.id].sort()
    )
  }, 30000)
})
