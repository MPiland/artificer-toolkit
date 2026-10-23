import { expect, it } from 'vitest'

import { damageMirrorLedger } from './roomDamageMirrorCollector.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'

const pending = {
  effectId: '00000000-0000-4000-8000-00000000e101',
  sourceActorId: '00000000-0000-4000-8000-00000000e102',
  damageTypeId: '00000000-0000-4000-8000-00000000e103',
  amount: 4,
  occurrenceId: '00000000-0000-4000-8000-00000000e104',
  rootCommandId: '00000000-0000-4000-8000-00000000e105'
}

it('fails the command of any path that collected a damage mirror and never settled it', async () => {
  const store = new RoomEncounterStore(createNodeSqliteRoomStorage().storage)
  await expect(
    store.transact(async (transaction) => {
      damageMirrorLedger(transaction).entries.push(pending)
    })
  ).rejects.toThrow('Collected damage mirrors were never settled.')
})

it('commits a command whose collected mirrors were all settled', async () => {
  const store = new RoomEncounterStore(createNodeSqliteRoomStorage().storage)
  await expect(
    store.transact(async (transaction) => {
      const ledger = damageMirrorLedger(transaction)
      ledger.entries.push(pending)
      ledger.entries.splice(0)
    })
  ).resolves.toBeUndefined()
})
