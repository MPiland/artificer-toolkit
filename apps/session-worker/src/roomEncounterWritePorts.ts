import type {
  EncounterCharacterWriteTransaction,
  EncounterWritePorts
} from '@artificer-toolkit/encounter-persistence/ports'
import { buildEncounterBlueprintEnemies } from '@artificer-toolkit/encounter-persistence/blueprintSnapshots'
import { postRulesChatMessage } from '@artificer-toolkit/encounter-persistence/rulesChatPersistence'
import { recordConcentrationCheckRoll } from '@artificer-toolkit/encounter-persistence/concentrationRollPersistence'
import { readActiveCampaignMembers } from '@artificer-toolkit/encounter-persistence/campaignMemberships'
import { presentChatEntries } from '@artificer-toolkit/encounter-persistence/conversationPresentation'
import { insertPreEvaluatedCampaignTableRoll } from '@artificer-toolkit/encounter-persistence/tableRollPersistence'
import type { RoomTransaction } from './roomEncounterStore.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { writeRoomCharacterPlay } from './roomCharacterWrites.js'
import { retainRoomPrivateRoll } from './roomPrivateRolls.js'

export type RoomEncounterWriteTransaction = EncounterCharacterWriteTransaction & {
  readonly ports: Pick<
    EncounterWritePorts,
    | 'snapshotBlueprintEnemies'
    | 'postRulesChatMessage'
    | 'recordConcentrationCheckRoll'
    | 'insertTableRoll'
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
      // The room charges the TABLE bucket for the whole command (D72), so the roll consumes no
      // separate conversation rate.
      insertTableRoll: (authority, author, clientNonce, roll) =>
        insertPreEvaluatedCampaignTableRoll({ db: store.store }, authority, author, clientNonce, roll, {
          requireAuthenticatedUsername: async (author) => {
            const username = authorization.preferences.find(
              (entry) => entry.userId === author
            )?.username
            if (!username) throw new Error('A username is required to post in this Campaign.')
            return username
          },
          requirePeerAuthority: read.ports.requireCampaignAuthority,
          readEntryPayload: async (entryId) => {
            const payload = await store.store
              .query('campaignConversationEntryPayloads')
              .withIndex('by_entryId', (q) => q.eq('entryId', entryId))
              .unique()
            if (!payload) throw new Error('Stored conversation payload is unavailable.')
            return payload
          },
          readCampaignAccessTime: async (campaign) => {
            const members = await readActiveCampaignMembers(
              store.store.query('campaignMemberships'),
              campaign
            )
            return Math.max(Date.now(), ...members.map((member) => Date.parse(member.accessStartedAt)))
          },
          consumeConversationRate: async () => {},
          presentChatEntry: async (header, payload, conversation, contentMaturity) => {
            const [entry] = presentChatEntries([{ header, payload }], conversation, contentMaturity, [
              payload.authorUsername
            ])
            return entry!
          }
        }),
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
