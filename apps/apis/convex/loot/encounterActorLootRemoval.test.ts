import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type { LootDocument, SaveLootInput } from '@artificer-toolkit/schema/api/lootTables'
import { lootTable, setupEncounterLoot } from '../../tests/fixtures/encounterLoot'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

const save = makeFunctionReference<'mutation', SaveLootInput, LootDocument>('loot/tables:save')

it('removing a placement deletes only its loot', async () => {
  const { base, gm, first, second, ownerOf, lootRows } = await setupEncounterLoot()
  for (const actor of [first, second])
    await gm.mutation(save, { owner: ownerOf(actor.id), expectedVersion: 0, tables: [lootTable()] })
  await attachFixtureRoom(base.t, base.campaign.id)
  await executeInRoom(gm, {
    command: {
      type: 'REMOVE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      actorId: first.id
    }
  })
  await checkpointLiveRoom(base.campaign.id)
  const rows = await lootRows()
  expect(rows.map((row) => row.owner)).toEqual([ownerOf(second.id)])
})
