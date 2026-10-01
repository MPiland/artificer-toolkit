import type {
  EncounterCharacterWriteTransaction,
  EncounterWritePorts
} from '@artificer-toolkit/encounter-persistence/ports'
import { buildEncounterBlueprintEnemies } from '@artificer-toolkit/encounter-persistence/blueprintSnapshots'
import { postRulesChatMessage } from '@artificer-toolkit/encounter-persistence/rulesChatPersistence'
import { recordConcentrationCheckRoll } from '@artificer-toolkit/encounter-persistence/concentrationRollPersistence'
import type { RoomTransaction } from './roomEncounterStore.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { writeRoomCharacterPlay } from './roomCharacterWrites.js'
import { retainRoomPrivateRoll } from './roomPrivateRolls.js'

export type RoomEncounterWriteTransaction = EncounterCharacterWriteTransaction & {
  readonly ports: Pick<
    EncounterWritePorts,
    'snapshotBlueprintEnemies' | 'postRulesChatMessage' | 'recordConcentrationCheckRoll'
  >
}

/** Uses the same native read ports inside the caller's enclosing room transaction. */
export async function roomEncounterWriteTransaction(
  input: Omit<Parameters<typeof roomEncounterReadTransaction>[0], 'transaction'> & {
    transaction: RoomTransaction
  }
): Promise<RoomEncounterWriteTransaction> {
  const { store, transaction, inputs, authorization, campaignId, epoch, userId, observed } = input
  const read = await roomEncounterReadTransaction({
    store,
    transaction,
    inputs,
    authorization,
    campaignId,
    epoch,
    userId,
    observed
  })
  return {
    ...read,
    ports: {
      ...read.ports,
      postRulesChatMessage: (authority, message) =>
        postRulesChatMessage({ db: store.store, ports: read.ports }, authority, message),
      recordConcentrationCheckRoll: (roll) =>
        recordConcentrationCheckRoll(read, roll, async (userId, record, gmCampaignRoll) => {
          retainRoomPrivateRoll(transaction, { userId, record, gmCampaignRoll })
        }),
      writeCharacterRecord: (write) =>
        writeRoomCharacterPlay({
          store,
          transaction,
          inputs,
          campaignId,
          epoch,
          observed,
          write
        }),
      snapshotBlueprintEnemies: async (caller, input) => {
        const loaded = await inputs.system('VOCABULARY', observed, transaction)
        if (!loaded.vocabulary || loaded.vocabulary.systemId !== input.gameSystemId)
          throw new Error('Room Encounter vocabulary snapshot is unavailable.')
        return buildEncounterBlueprintEnemies({
          input,
          vocabulary: loaded.vocabulary,
          readSource: (id, kind) =>
            read.ports.readEncounterSource(caller, input.gameSystemId, id, kind)
        })
      }
    }
  }
}
