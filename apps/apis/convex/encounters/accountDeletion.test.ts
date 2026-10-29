import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto,
  UpdateEncounterBlueprintInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  advanceAccountDeletion,
  deleteAccountCompletely,
  runAccountDeletionStep
} from '../../tests/fixtures/accountDeletion'
import { publicationFixture } from '../../tests/fixtures/publication'
import { components, internal } from '../_generated/api'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const authModules = import.meta.glob('/apps/apis/convex/betterAuth/**/*.*s')
const create = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const update = makeFunctionReference<
  'mutation',
  UpdateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:update')

const input = (): CreateEncounterBlueprintInputDto => ({
  gameSystemId: srdSystemRecord.id,
  name: 'Account cleanup',
  commandId: crypto.randomUUID(),
  enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 10 }]
})

describe('native Blueprint account deletion', () => {
  it('removes only the deleted owner’s Blueprints, receipts, and usage', async () => {
    const { t, first, second } = await publicationFixture(modules, authModules, [])
    const firstBlueprints: EncounterBlueprintDto[] = []
    for (let index = 0; index < 3; index++)
      firstBlueprints.push(await first.caller.mutation(create, input()))
    const secondBlueprint = await second.caller.mutation(create, input())
    for (const [index, blueprint] of firstBlueprints.entries())
      await first.caller.mutation(update, {
        blueprintId: blueprint.id,
        expectedVersion: 1,
        commandId: crypto.randomUUID(),
        name: `First revision ${index}`,
        enemies: input().enemies
      })
    await second.caller.mutation(update, {
      blueprintId: secondBlueprint.id,
      expectedVersion: 1,
      commandId: crypto.randomUUID(),
      name: 'Second revision',
      enemies: input().enemies
    })
    const profile = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
    )
    if (!profile) throw new Error('Missing owner profile.')
    const before = await snapshot(t, profile.authUserId)
    await deleteAccountCompletely(t, profile.authUserId)
    const after = await snapshot(t, profile.authUserId)
    expect(after.user).toBeNull()
    expect(after.profiles).toEqual(before.profiles.filter((row) => row.userId !== first.userId))
    expect(after.blueprints).toEqual(
      before.blueprints.filter((row) => row.ownerUserId !== first.userId)
    )
    expect(after.updates).toEqual(before.updates.filter((row) => row.ownerUserId !== first.userId))
    expect(after.usage).toEqual(before.usage.filter((row) => row.ownerUserId !== first.userId))
    expect(after.campaigns).toEqual(before.campaigns)
    expect(after.runs).toEqual(before.runs)
  }, 30000)

  it('rolls back the account deletion Blueprint step when usage synchronization fails', async () => {
    const { t, first } = await publicationFixture(modules, authModules, [])
    await first.caller.mutation(create, input())
    const profile = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
    )
    if (!profile) throw new Error('Missing owner profile.')
    await t.run((ctx) =>
      ctx.db.patch(profile._id, {
        entitlementUsage: { ...profile.entitlementUsage, savedEncounters: 0 }
      })
    )
    await t.mutation(internal.accountDeletion.schedule, { authUserId: profile.authUserId })
    await advanceAccountDeletion(t, first.userId, 'FINISH')
    const before = await snapshot(t, profile.authUserId)
    expect(before.user).not.toBeNull()
    await expect(
      runAccountDeletionStep(t, first.userId, internal.accountDeletionFinish.step)
    ).rejects.toThrow('Account usage counter underflow.')
    expect(await snapshot(t, profile.authUserId)).toEqual(before)
  }, 30000)
})

async function snapshot(
  t: Awaited<ReturnType<typeof publicationFixture>>['t'],
  authUserId: string
) {
  return t.run(async (ctx) => ({
    user: await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: '_id', value: authUserId }]
    }),
    profiles: await ctx.db.query('userProfiles').collect(),
    blueprints: await ctx.db.query('encounterBlueprints').collect(),
    updates: await ctx.db.query('encounterBlueprintUpdates').collect(),
    usage: await ctx.db.query('accountUsageEntries').collect(),
    campaigns: await ctx.db.query('campaigns').collect(),
    runs: await ctx.db.query('encounterRuns').collect()
  }))
}
