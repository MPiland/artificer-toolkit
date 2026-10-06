import { insertRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import type { EncounterTableName } from '@artificer-toolkit/encounter-persistence/store'
import { encounterStoredRunSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomDocument } from '../roomEncounterStore.js'

/** The documents of `tables` held by a memory store, as the room hydrates them. */
export function memoryRoomDocuments(
  memory: ReturnType<typeof createMemoryEncounterStore>,
  tables: readonly EncounterTableName[]
) {
  const documents: RoomDocument[] = []
  for (const table of tables)
    for (const { _id, _creationTime, ...fields } of memory.documents(table))
      documents.push({ table, id: _id, creationTime: _creationTime, fields })
  return documents
}

/**
 * A Run and its actors as the room stores them: the Run row, each actor's play-state row and the
 * snapshot and source-facts rows it names, all written through the persistence write path.
 */
export async function storedRunDocuments(
  run: EncounterRunState,
  actors: readonly EncounterRunActorState[]
) {
  const memory = createMemoryEncounterStore({ idPrefix: 'stored-run' })
  await memory.store.insert(
    'encounterRuns',
    encounterStoredRunSchema.parse({
      id: run.id,
      campaignId: run.campaignId,
      gameSystemId: run.gameSystemId,
      status: run.status,
      version: run.version,
      stateJson: JSON.stringify(run),
      stateChecksum: checksumCanonicalJson(run),
      createCommandId: crypto.randomUUID(),
      createCommandFingerprint: checksumCanonicalJson(run),
      createdAt: run.createdAt,
      updatedAt: run.updatedAt
    })
  )
  for (const actor of actors) await insertRunActor({ db: memory.store }, actor)
  return memoryRoomDocuments(memory, [
    'encounterRuns',
    'encounterRunActors',
    'encounterActorSnapshots',
    'encounterSourceProjectionFacts'
  ])
}
