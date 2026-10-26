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
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollHistoryEntryDto } from '@artificer-toolkit/schema/api/rolls'
import { presentRetainedRoll } from '@artificer-toolkit/rules-runtime/character/rollPresentation'
import type { RoomTransaction } from './roomEncounterStore.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { writeRoomCharacterPlay } from './roomCharacterWrites.js'
import { retainRoomPrivateRoll } from './roomPrivateRolls.js'
import { readRoomScene } from './roomSceneRead.js'

export type RoomEncounterWriteTransaction = EncounterCharacterWriteTransaction & {
  readonly ports: Pick<
    EncounterWritePorts,
    | 'snapshotBlueprintEnemies'
    | 'postRulesChatMessage'
    | 'recordConcentrationCheckRoll'
    | 'insertTableRoll'
    | 'retainPrivateRoll'
  >
  /**
   * Table chat entries this command posted (roll cards), in order. The caller fans them out to the
   * conversation's members in the commit, as it does a chat entry.
   */
  readonly postedChatEntries: readonly CampaignChatEntryDto[]
  /** Rolls this command retained for the Campaign owner, presented for a live push to that user. */
  readonly retainedPrivateRolls: readonly { userId: string; roll: RollHistoryEntryDto }[]
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
    observed,
    sceneTokens: input.sceneTokens
  })
  const postedChatEntries: CampaignChatEntryDto[] = []
  const retainedPrivateRolls: { userId: string; roll: RollHistoryEntryDto }[] = []
  const writeTransaction: RoomEncounterWriteTransaction = {
    ...read,
    postedChatEntries,
    retainedPrivateRolls,
    ports: {
      ...read.ports,
      sceneReaders: { readScene: async (sceneId) => readRoomScene(store, sceneId) },
      postRulesChatMessage: async (authority, message) => {
        const entry = await postRulesChatMessage(
          { db: store.store, ports: read.ports },
          authority,
          message
        )
        postedChatEntries.push(entry)
        return entry
      },
      // The room charges the TABLE bucket for the whole command (D72), so the roll consumes no
      // separate conversation rate.
      insertTableRoll: async (authority, author, clientNonce, roll) => {
        const entry = await insertPreEvaluatedCampaignTableRoll(
          { db: store.store },
          authority,
          author,
          clientNonce,
          roll,
          {
            requireAuthenticatedUsername: async (author) => {
              const username = authorization.preferences.find(
                (entry) => entry.userId === author
              )?.username
              if (!username) throw new Error('A username is required to post in this Campaign.')
              return username
            },
            requirePeerAuthority: read.ports.requireCampaignAuthority,
            readCampaignAccessTime: async (campaign) => {
              const members = await readActiveCampaignMembers(
                store.store.query('campaignMemberships'),
                campaign
              )
              return Math.max(
                Date.now(),
                ...members.map((member) => Date.parse(member.accessStartedAt))
              )
            },
            consumeConversationRate: async () => {},
            presentChatEntry: async (header, payload, conversation, contentMaturity) => {
              const [entry] = presentChatEntries(
                [{ header, payload }],
                conversation,
                contentMaturity,
                [payload.authorUsername]
              )
              return entry!
            }
          }
        )
        postedChatEntries.push(entry)
        return entry
      },
      retainPrivateRoll: async (userId, record, gmCampaignRoll) => {
        retainRoomPrivateRoll(store, transaction, { userId, record, gmCampaignRoll })
        const { campaign } = await read.ports.requireCampaignAuthority(campaignId, userId)
        retainedPrivateRolls.push({
          userId,
          roll: presentRetainedRoll({ ...record, gmCampaignRoll }, campaign.contentMaturity)
        })
      },
      recordConcentrationCheckRoll: async (roll) => {
        const entry = await recordConcentrationCheckRoll(writeTransaction, roll)
        if (entry) postedChatEntries.push(entry)
        return entry
      },
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
  return writeTransaction
}
