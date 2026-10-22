import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  SaveLootInput,
  LootDocument,
  LootOwner,
  LootTable
} from '@artificer-toolkit/schema/api/lootTables'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { createSceneDefinitionFixture, publishScene } from '../../tests/fixtures/sceneDefinitions'

const get = makeFunctionReference<'query', { owner: LootOwner }, LootDocument>('loot/tables:get')
const save = makeFunctionReference<'mutation', SaveLootInput, LootDocument>('loot/tables:save')
const removeScene = makeFunctionReference<
  'mutation',
  { campaignId: string; sceneId: string; expectedVersion: number },
  null
>('scenes/definitions:remove')

const skillId = srdSystemRecord.skills[0]!.id
const coinId = srdSystemRecord.currencies[0]!.id

function ownerOf(campaignId: string, sceneDefinitionId: string) {
  return { owner: { kind: 'SCENE', campaignId, sceneDefinitionId } } as const
}

function range(min: number, max: number | null, entries: LootTable['ranges'][number]['entries']) {
  return { id: crypto.randomUUID(), min, max, entries }
}

async function sceneWithItem() {
  const base = await createSceneDefinitionFixture()
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...longsword, subjectKind: 'EQUIPMENT', document: longsword })]
  })
  const published = await publishScene(base)
  const sceneId = published.save.sceneId
  const table: LootTable = {
    id: crypto.randomUUID(),
    name: 'Guard room',
    skillId,
    ranges: [
      range(1, 10, [{ kind: 'COIN', denominationId: coinId, amount: 30 }]),
      {
        ...range(11, null, [{ kind: 'ITEM', itemId: longsword.id, quantity: 2 }]),
        note: 'Under the cot'
      }
    ]
  }
  return { base, sceneId, table, version: published.save.version }
}

it('the owner saves loot tables, reopens them, and a stale version is refused', async () => {
  const { base, sceneId, table } = await sceneWithItem()
  const lookup = ownerOf(base.campaign.id, sceneId)
  const empty = await base.owner.caller.query(get, lookup)
  expect(empty).toEqual({ ...lookup, version: 0, tables: [] })

  const saved = await base.owner.caller.mutation(save, {
    ...lookup,
    expectedVersion: 0,
    tables: [table]
  })
  expect(saved).toEqual({ ...lookup, version: 1, tables: [table] })
  await expect(base.owner.caller.query(get, lookup)).resolves.toEqual(saved)

  await expect(
    base.owner.caller.mutation(save, { ...lookup, expectedVersion: 0, tables: [] })
  ).rejects.toThrow('Loot tables changed before this save.')
  const second = await base.owner.caller.mutation(save, {
    ...lookup,
    expectedVersion: 1,
    tables: [table, { ...table, id: crypto.randomUUID(), name: 'Treasury', skillId: undefined }]
  })
  expect(second.version).toBe(2)
  expect(second.tables).toHaveLength(2)
})

it('overlapping or inverted roll ranges are refused with the named message', async () => {
  const { base, sceneId, table } = await sceneWithItem()
  const lookup = ownerOf(base.campaign.id, sceneId)
  const attempt = (ranges: LootTable['ranges']) =>
    base.owner.caller.mutation(save, {
      ...lookup,
      expectedVersion: 0,
      tables: [{ ...table, ranges }]
    })

  await expect(attempt([range(5, 10, []), range(10, 15, [])])).rejects.toThrow('LOOT_RANGE_OVERLAP')
  await expect(attempt([range(1, 20, []), range(18, 19, [])])).rejects.toThrow('LOOT_RANGE_OVERLAP')
  await expect(attempt([range(8, 3, [])])).rejects.toThrow('LOOT_RANGE_MIN_GREATER_THAN_MAX')
  await expect(base.owner.caller.query(get, lookup)).resolves.toMatchObject({ version: 0 })
})

it('refuses a check, coin or item the System and catalogue do not offer', async () => {
  const { base, sceneId, table } = await sceneWithItem()
  const lookup = ownerOf(base.campaign.id, sceneId)
  const attempt = (next: LootTable) =>
    base.owner.caller.mutation(save, { ...lookup, expectedVersion: 0, tables: [next] })
  const unknown = crypto.randomUUID()

  await expect(attempt({ ...table, skillId: unknown })).rejects.toThrow(
    'names a check this System does not define'
  )
  await expect(
    attempt({
      ...table,
      ranges: [range(1, 2, [{ kind: 'COIN', denominationId: unknown, amount: 1 }])]
    })
  ).rejects.toThrow('names a coin this System does not define')
  await expect(
    attempt({
      ...table,
      ranges: [range(1, 2, [{ kind: 'ITEM', itemId: unknown, quantity: 1 }])]
    })
  ).rejects.toThrow('names an item that is unavailable')
})

it('players and non-members never read or write loot tables', async () => {
  const { base, sceneId, table } = await sceneWithItem()
  const lookup = ownerOf(base.campaign.id, sceneId)
  await base.owner.caller.mutation(save, { ...lookup, expectedVersion: 0, tables: [table] })

  const player = base.other.caller
  await expect(player.query(get, lookup)).rejects.toThrow(
    'Loot tables are only available to the Campaign owner.'
  )
  await expect(
    player.mutation(save, { ...lookup, expectedVersion: 1, tables: [] })
  ).rejects.toThrow('Loot tables are only available to the Campaign owner.')
  await expect(base.owner.caller.query(get, lookup)).resolves.toMatchObject({ version: 1 })
})

it('loot is deleted with its Scene', async () => {
  const { base, sceneId, table, version } = await sceneWithItem()
  const lookup = ownerOf(base.campaign.id, sceneId)
  await base.owner.caller.mutation(save, { ...lookup, expectedVersion: 0, tables: [table] })
  await base.owner.caller.mutation(removeScene, {
    campaignId: base.campaign.id,
    sceneId,
    expectedVersion: version
  })
  await expect(
    base.t.run((ctx) =>
      ctx.db
        .query('lootTables')
        .withIndex('by_scene', (q) =>
          q.eq('owner.kind', 'SCENE').eq('owner.sceneDefinitionId', sceneId)
        )
        .collect()
    )
  ).resolves.toEqual([])
})
