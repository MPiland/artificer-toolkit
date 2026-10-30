import type { EncounterWritePorts } from '@artificer-toolkit/encounter-persistence/ports'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  characterStoredRowSchema,
  characterStoredPlayStateSchema
} from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  encodeCharacterRecord,
  readCharacterRecord,
  readCharacterSheetState,
  readCharacterSheetStructure
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { resolveCharacterRecordStats } from '@artificer-toolkit/rules-runtime/character/characterRecordStats'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'

/** Stages play-only Encounter mechanics; the caller owns commit, rollback and stream sequencing. */
export async function writeRoomCharacterPlay(input: {
  store: RoomEncounterStore
  inputs: RoomInputs
  transaction: RoomTransaction
  campaignId: string
  epoch: string
  observed: LiveSessionRulesRevisions
  write: Parameters<EncounterWritePorts['writeCharacterRecord']>[0]
}): Promise<void> {
  const { store, inputs, transaction, campaignId, epoch, observed, write } = input
  if (store.epoch !== epoch || inputs.epoch !== epoch)
    throw new Error('Room Character write epoch mismatch.')
  const supplied = characterStoredRowSchema.parse(write.current)
  await inputs.authority(observed, transaction)
  const part = await inputs.character(supplied.id, observed, transaction)
  const current = part.inputs?.owner
  const localPlay = store
    .documents('characterPlayStates')
    .find((play) => play.characterId === supplied.id)
  const campaign = await store.store
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaignId))
    .unique()
  if (
    !current ||
    !localPlay ||
    !part.inputs ||
    part.inputs.campaign.id !== campaignId ||
    !campaign ||
    campaign.status !== 'ACTIVE' ||
    current.status !== 'ACTIVE' ||
    current.systemId !== campaign.gameSystemId
  )
    throw new Error('Room Character write scope mismatch.')
  if (
    supplied._id !== current._id ||
    supplied.id !== current.id ||
    supplied.userId !== current.userId ||
    supplied.systemId !== current.systemId ||
    supplied.checksum !== current.checksum ||
    checksumRuleDocument(readCharacterSheetStructure(supplied.sheetState)) !==
      checksumRuleDocument(readCharacterSheetStructure(current.sheetState)) ||
    supplied.play._id !== current.play._id ||
    supplied.play.characterId !== current.id ||
    supplied.play.userId !== current.userId ||
    supplied.play.streamVersion !== current.play.streamVersion ||
    supplied.play.checksum !== current.play.checksum ||
    localPlay._id !== current.play._id ||
    localPlay.userId !== current.userId ||
    localPlay.streamVersion !== current.play.streamVersion ||
    localPlay.checksum !== current.play.checksum
  )
    throw new Error('Room Character write base is stale.')
  readCharacterRecord(supplied)
  const encoded = encodeCharacterRecord(current, {
    document: write.document ?? readCharacterRecord(current),
    sheetState: write.sheetState ?? readCharacterSheetState(current),
    streamVersion: write.fields.streamVersion,
    updatedAt: write.fields.updatedAt
  })
  if (
    encoded.checksum !== current.checksum ||
    checksumRuleDocument(readCharacterSheetStructure(encoded.sheetState)) !==
      checksumRuleDocument(readCharacterSheetStructure(current.sheetState))
  )
    throw new Error('Room Character writer only accepts play changes.')
  const { _id, _creationTime, ...fields } = encoded.play
  const play = characterStoredPlayStateSchema.parse(fields)
  const { _id: _currentId, _creationTime: _currentCreationTime, ...currentFields } = current.play
  if (canonicalizeJson(play) !== canonicalizeJson(currentFields))
    await store.store.replace(localPlay._id, play)
  const facts = await prepareRoomLiveCharacterSheet(
    store,
    inputs,
    {
      campaignId,
      authorityEpoch: epoch,
      characterId: current.id,
      expectedUserId: campaign.ownerUserId,
      expectedRole: 'OWNER'
    },
    observed,
    transaction,
    { reconcile: false }
  )
  const stats = resolveCharacterRecordStats(facts.ruleEvaluation)
  if (
    stats.maximumHitPoints !== play.maximumHitPoints ||
    canonicalizeJson(stats.speeds) !== canonicalizeJson(play.speeds)
  )
    await store.store.patch(localPlay._id, stats)
}
