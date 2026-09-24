import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import { components } from '../_generated/api'
import type {
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto,
  UpdateEncounterBlueprintInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { publicationFixture } from '../../tests/fixtures/publication'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { removeFixtureBlueprint } from './development'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const authModules = import.meta.glob('/apps/apis/convex/betterAuth/**/*.*s')
const remove = makeFunctionReference<'mutation', { userId: string; blueprintId: string }, null>(
  'encounters/development:removeFixtureBlueprint'
)
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
async function fixture() {
  const base = await publicationFixture(modules, authModules, [])
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.first.userId, base.second.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_012345abcde${index}@example.invalid` }
        }
      })
    }
  })
  return base
}

describe('encounter Blueprint fixture cleanup', () => {
  it('removes the exact Blueprint and receipts with guarded idempotent replay', async () => {
    const base = await fixture()
    const created = await base.first.caller.mutation(create, {
      gameSystemId: srdSystemRecord.id,
      name: 'Fixture Blueprint',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 10 }]
    })
    const updated = await base.first.caller.mutation(update, {
      blueprintId: created.id,
      expectedVersion: 1,
      commandId: crypto.randomUUID(),
      name: 'Fixture Blueprint Updated',
      enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 10 }]
    })
    const sibling = await base.second.caller.mutation(create, {
      gameSystemId: srdSystemRecord.id,
      name: 'Sibling Blueprint',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Sibling', maxHitPoints: 8 }]
    })
    const before = await base.t.run((ctx) =>
      Promise.all([
        ctx.db.query('encounterBlueprints').collect(),
        ctx.db.query('encounterBlueprintUpdates').collect()
      ])
    )
    expect(removeFixtureBlueprint.isInternal).toBe(true)
    vi.stubEnv('SITE_URL', 'https://example.com')
    try {
      await expect(
        base.t.mutation(remove, { userId: base.first.userId, blueprintId: created.id })
      ).rejects.toThrow('development application origin')
    } finally {
      vi.unstubAllEnvs()
    }
    await expect(
      base.t.mutation(remove, { userId: base.second.userId, blueprintId: created.id })
    ).rejects.toThrow('ownership')
    expect(
      await base.t.run((ctx) =>
        Promise.all([
          ctx.db.query('encounterBlueprints').collect(),
          ctx.db.query('encounterBlueprintUpdates').collect()
        ])
      )
    ).toEqual(before)
    await base.t.mutation(remove, { userId: base.first.userId, blueprintId: created.id })
    await base.t.mutation(remove, { userId: base.first.userId, blueprintId: created.id })
    await base.t.run(async (ctx) => {
      expect(
        await ctx.db
          .query('encounterBlueprints')
          .withIndex('by_publicId', (q) => q.eq('id', created.id))
          .unique()
      ).toBeNull()
      expect(
        await ctx.db
          .query('encounterBlueprintUpdates')
          .withIndex('by_blueprintId', (q) => q.eq('blueprintId', created.id))
          .collect()
      ).toEqual([])
      expect(
        await ctx.db
          .query('encounterBlueprints')
          .withIndex('by_publicId', (q) => q.eq('id', sibling.id))
          .unique()
      ).not.toBeNull()
      expect(updated.version).toBe(2)
    })
  }, 30000)
})
