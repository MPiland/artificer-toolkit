import type { EncounterTableName } from '@artificer-toolkit/encounter-persistence/store'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import type { RoomDocument, RoomEncounterStore, RoomRecord } from '../roomEncounterStore.js'

export const uuid = (index: number) =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
export const encounterId = uuid(1)
const checksum = (label: string) => sha256Hex(label)
export const playState = (characterIndex: number) => ({
  kind: 'CHARACTER_PLAY_STATE',
  key: uuid(0x500 + characterIndex)
})

/** A Run aggregate sized like a live Encounter: JSON blobs the way the stored tables carry them. */
export function aggregate(actorCount: number) {
  let creationTime = 1_780_000_000_000
  const documents: RoomDocument[] = []
  const add = (table: EncounterTableName, id: string, fields: Record<string, unknown>) =>
    documents.push({ table, id, creationTime: creationTime++, fields })
  add('encounterRuns', 'convex:run', {
    id: encounterId,
    campaignId: uuid(2),
    gameSystemId: uuid(3),
    status: 'ACTIVE',
    version: 1,
    stateJson: JSON.stringify({ padding: 'x'.repeat(30_000) }),
    stateChecksum: checksum('run'),
    createCommandId: uuid(4),
    createCommandFingerprint: checksum('create'),
    concentrationCasterCharacterIds: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  })
  const sources = Math.ceil(actorCount / 5)
  for (let source = 0; source < sources; source++) {
    add('encounterSourceProjectionFacts', `convex:source:${source}`, {
      encounterId,
      checksum: checksum(`source:${source}`),
      factsJson: JSON.stringify({ statBlock: 'é'.repeat(40_000) })
    })
    add('encounterActorSnapshots', `convex:snapshot:${source}`, {
      encounterId,
      checksum: checksum(`snapshot:${source}`),
      snapshotJson: JSON.stringify({ payload: 's'.repeat(6_000) })
    })
  }
  for (let actor = 0; actor < actorCount; actor++)
    add('encounterRunActors', `convex:actor:${actor}`, {
      id: uuid(0x100 + actor),
      encounterId,
      stateJson: JSON.stringify({ hitPoints: 10 + actor, padding: 'a'.repeat(1_500) }),
      stateChecksum: checksum(`actor:${actor}`),
      snapshotChecksum: checksum(`snapshot:${actor % sources}`),
      sourceFactsChecksum: checksum(`source:${actor % sources}`)
    })
  const records: RoomRecord[] = Array.from({ length: Math.min(actorCount, 6) }, (_, index) => ({
    ...playState(index),
    revision: null,
    json: JSON.stringify({ streamVersion: index })
  }))
  return { documents, records }
}

/** One command: a Run patch, a movement insert (and an earlier movement's delete), and a record. */
export async function command(room: RoomEncounterStore, ordinal: number) {
  await room.transact(async (transaction) => {
    const run = await room.store
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique()
    await room.store.patch(run!._id, {
      version: run!.version + 1,
      stateJson: JSON.stringify({ ordinal })
    })
    await room.store.insert('encounterTurnMovements', {
      encounterId,
      round: 1 + ordinal,
      turnActorId: uuid(0x100),
      actorId: uuid(0x100 + (ordinal % 11)),
      usedFeet: ordinal,
      speedBonuses: 0,
      speedId: null
    })
    if (ordinal % 3 === 0) {
      const [oldest] = await room.store.query('encounterTurnMovements').collect()
      await room.store.delete(oldest!._id)
    }
    transaction.setRecord({
      ...playState(ordinal % 6),
      revision: null,
      json: JSON.stringify({ streamVersion: ordinal })
    })
  })
}
