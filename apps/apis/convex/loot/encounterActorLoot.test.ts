import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  LiveLoot,
  LiveLootInput,
  LootDocument,
  LootOwner,
  LootTable,
  SaveLootInput
} from '@artificer-toolkit/schema/api/lootTables'
import type { DeletePreparedEncounterInputDto } from '@artificer-toolkit/schema/api/encounterData'
import { lootTable, setupEncounterLoot } from '../../tests/fixtures/encounterLoot'

const get = makeFunctionReference<'query', { owner: LootOwner }, LootDocument>('loot/tables:get')
const live = makeFunctionReference<'query', LiveLootInput, LiveLoot>('loot/tables:live')
const save = makeFunctionReference<'mutation', SaveLootInput, LootDocument>('loot/tables:save')
const deletePrepared = makeFunctionReference<
  'mutation',
  DeletePreparedEncounterInputDto,
  { campaignId: string; encounterId: string }
>('encounters/runs:deletePrepared')

it('the GM saves loot on a creature placement, reopens it, and a stale version is refused', async () => {
  const { gm, first, ownerOf } = await setupEncounterLoot()
  const owner = ownerOf(first.id)
  await expect(gm.query(get, { owner })).resolves.toEqual({ owner, version: 0, tables: [] })

  const tables = [lootTable()]
  const saved = await gm.mutation(save, { owner, expectedVersion: 0, tables })
  expect(saved).toEqual({ owner, version: 1, tables })
  await expect(gm.query(get, { owner })).resolves.toEqual(saved)
  await expect(gm.mutation(save, { owner, expectedVersion: 0, tables: [] })).rejects.toThrow(
    'Loot tables changed before this save.'
  )
})

it('refuses overlapping ranges on a placement with the named message', async () => {
  const { gm, first, ownerOf, lootRows } = await setupEncounterLoot()
  const overlapping: LootTable = {
    ...lootTable(),
    ranges: [
      { id: crypto.randomUUID(), min: 5, max: 10, entries: [] },
      { id: crypto.randomUUID(), min: 10, max: 15, entries: [] }
    ]
  }
  await expect(
    gm.mutation(save, { owner: ownerOf(first.id), expectedVersion: 0, tables: [overlapping] })
  ).rejects.toThrow('LOOT_RANGE_OVERLAP')
  await expect(lootRows()).resolves.toEqual([])
})

it('players, Characters and strangers have no loot on an Encounter', async () => {
  const { base, gm, first, ownerOf } = await setupEncounterLoot()
  const owner = ownerOf(first.id)
  await gm.mutation(save, { owner, expectedVersion: 0, tables: [lootTable()] })
  const player = base.owner.caller
  await expect(player.query(get, { owner })).rejects.toThrow(
    'Loot tables are only available to the Campaign owner.'
  )
  await expect(player.mutation(save, { owner, expectedVersion: 1, tables: [] })).rejects.toThrow(
    'Loot tables are only available to the Campaign owner.'
  )
  await expect(gm.query(get, { owner: ownerOf(crypto.randomUUID()) })).rejects.toThrow(
    'Encounter creature is unavailable.'
  )
})

it('deleting the prepared Encounter deletes its placements’ loot', async () => {
  const { base, gm, first, second, ownerOf, lootRows } = await setupEncounterLoot()
  for (const actor of [first, second])
    await gm.mutation(save, { owner: ownerOf(actor.id), expectedVersion: 0, tables: [lootTable()] })
  await expect(lootRows()).resolves.toHaveLength(2)
  await gm.mutation(deletePrepared, {
    campaignId: base.campaign.id,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: base.run.version
  })
  await expect(lootRows()).resolves.toEqual([])
})

it('the live Loot panel reads the creatures that have tables, for the GM only', async () => {
  const { base, gm, first, second, ownerOf } = await setupEncounterLoot()
  const sceneDefinitionId = crypto.randomUUID()
  const input = { campaignId: base.campaign.id, sceneDefinitionId, encounterId: base.run.id }
  await expect(gm.query(live, input)).resolves.toEqual({ documents: [] })

  const saved = await gm.mutation(save, {
    owner: ownerOf(first.id),
    expectedVersion: 0,
    tables: [lootTable()]
  })
  await gm.mutation(save, { owner: ownerOf(second.id), expectedVersion: 0, tables: [lootTable()] })
  await gm.mutation(save, { owner: ownerOf(second.id), expectedVersion: 1, tables: [] })
  await expect(gm.query(live, input)).resolves.toEqual({ documents: [saved] })
  await expect(gm.query(live, { ...input, encounterId: null })).resolves.toEqual({ documents: [] })
  await expect(base.owner.caller.query(live, input)).rejects.toThrow(
    'Loot tables are only available to the Campaign owner.'
  )
})
