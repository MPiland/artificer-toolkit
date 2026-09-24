import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  UpdateEncounterBlueprintInputDto,
  EncounterBlueprintDto
} from '@artificer-toolkit/schema/api/encounters'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type {
  EncounterBlueprintListInput,
  EncounterBlueprintPage
} from '@artificer-toolkit/schema/api/encounterBlueprintPages'
import { publicationFixture } from '../../tests/fixtures/publication'

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
  name: 'Practice',
  commandId: crypto.randomUUID(),
  enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 10 }]
})
const list = makeFunctionReference<'query', EncounterBlueprintListInput, EncounterBlueprintPage>(
  'encounters/blueprints:list'
)

describe('native Blueprint commands', () => {
  it('paginates private System-scoped snapshots and rejects corrupt setup', async () => {
    const { t, first, second } = await publicationFixture(modules, authModules, [])
    const args = { gameSystemId: srdSystemRecord.id, paginationOpts: { numItems: 1, cursor: null } }
    await expect(t.query(list, args)).rejects.toThrow('Unauthenticated')
    const firstBlueprint = await first.caller.mutation(create, input())
    const secondBlueprint = await first.caller.mutation(create, input())
    await second.caller.mutation(create, input())
    const page = await first.caller.query(list, args)
    const next = await first.caller.query(list, {
      ...args,
      paginationOpts: { numItems: 1, cursor: page.continueCursor }
    })
    expect(page.isDone).toBe(false)
    expect([...page.page, ...next.page].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [firstBlueprint, secondBlueprint].sort((a, b) => a.id.localeCompare(b.id))
    )
    expect(
      (await first.caller.query(list, { ...args, gameSystemId: crypto.randomUUID() })).page
    ).toEqual([])
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterBlueprints')
        .withIndex('by_publicId', (q) => q.eq('id', firstBlueprint.id))
        .unique()
      if (!row) throw new Error('Missing test Blueprint')
      await ctx.db.patch(row._id, { name: 'Tampered' })
    })
    await expect(
      first.caller.query(list, {
        ...args,
        paginationOpts: { numItems: 8, cursor: null }
      })
    ).rejects.toThrow('checksum mismatch')
  }, 30000)

  it('preserves create replay and immutable update receipts across later edits', async () => {
    const { first } = await publicationFixture(modules, authModules, [])
    const original = input()
    const created = await first.caller.mutation(create, original)
    expect(created.version).toBe(1)
    expect(await first.caller.mutation(create, original)).toEqual(created)
    await expect(first.caller.mutation(create, { ...original, name: 'Different' })).rejects.toThrow(
      'different input'
    )
    const edit = {
      blueprintId: created.id,
      expectedVersion: 1,
      commandId: crypto.randomUUID(),
      name: 'Revised',
      enemies: original.enemies
    }
    const updated = await first.caller.mutation(update, edit)
    expect(updated.version).toBe(2)
    await first.caller.mutation(update, {
      ...edit,
      name: 'Third',
      commandId: crypto.randomUUID(),
      expectedVersion: 2
    })
    expect(await first.caller.mutation(update, edit)).toEqual(updated)
    expect((await first.caller.mutation(create, original)).name).toBe('Third')
    await expect(first.caller.mutation(update, { ...edit, name: 'Conflict' })).rejects.toThrow(
      'different input'
    )
    await expect(
      first.caller.mutation(update, { ...edit, commandId: crypto.randomUUID() })
    ).rejects.toThrow('stale')
  }, 30000)

  it('enforces identity and capacity while allowing replay at capacity and unlimited GM ownership', async () => {
    const { t, first, second } = await publicationFixture(modules, authModules, [])
    const original = input()
    await expect(t.mutation(create, original)).rejects.toThrow('Unauthenticated')
    const created = await first.caller.mutation(create, original)
    await expect(
      second.caller.mutation(update, {
        blueprintId: created.id,
        expectedVersion: 1,
        commandId: crypto.randomUUID(),
        name: 'Stolen',
        enemies: original.enemies
      })
    ).rejects.toThrow('unavailable')
    await first.caller.mutation(create, input())
    await first.caller.mutation(create, input())
    await expect(first.caller.mutation(create, input())).rejects.toThrow('savedEncounters limit')
    expect(await first.caller.mutation(create, original)).toEqual(created)
    await t.run(async (ctx) => {
      const entitlement = await ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
      if (entitlement) await ctx.db.patch(entitlement._id, { tier: 'GM' })
      else await ctx.db.insert('accountEntitlements', { userId: first.userId, tier: 'GM' })
    })
    await expect(first.caller.mutation(create, input())).resolves.toMatchObject({ version: 1 })
  }, 30000)

  it('rolls back a failed snapshot update without consuming its command', async () => {
    const { first } = await publicationFixture(modules, authModules, [])
    const original = input()
    const created = await first.caller.mutation(create, original)
    const edit = {
      blueprintId: created.id,
      expectedVersion: 1,
      commandId: crypto.randomUUID(),
      name: 'Retry',
      enemies: original.enemies
    }
    await expect(
      first.caller.mutation(update, {
        ...edit,
        enemies: [{ kind: 'CREATURE', sourceId: crypto.randomUUID() }]
      })
    ).rejects.toThrow('unavailable')
    expect((await first.caller.mutation(create, original)).version).toBe(1)
    expect((await first.caller.mutation(update, edit)).version).toBe(2)
  }, 30000)
})
