import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterSceneBindingSchema,
  encounterStoredRunSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { insertRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { insertInitiativeRound, memoryRoomDocuments } from './storedRunFixture.js'

const NOW = '2026-09-30T00:00:00.000Z'

/**
 * One ACTIVE manual Run in the Campaign with an unfrozen Character actor per entry of `actors`,
 * stored as the room holds it: the Run, its actors and their normalized initiative round. `scene`
 * binds the Encounter, and the first actor's token, to a Scene.
 */
export async function encounterRunFixture({
  campaignId,
  systemId,
  actors: entries,
  scene,
  status = 'ACTIVE',
  memory = createMemoryEncounterStore({ idPrefix: 'sheet-fixture' })
}: {
  campaignId: string
  systemId: string
  actors: readonly {
    characterId: string
    label?: string
    controllerUserIds?: string[]
    /** Whether the table sees the actor; a hidden current actor is withheld from players. */
    public?: boolean
    /** Makes this the Run's current actor. */
    current?: boolean
  }[]
  scene?: { sceneId: string; tokenId: string }
  /** A PREPARED Run has not started: round 0, no initiative round. */
  status?: 'ACTIVE' | 'PREPARED'
  /** Holds the Run beside the Runs already in this store, which `documents` then lists too. */
  memory?: ReturnType<typeof createMemoryEncounterStore>
}) {
  const encounterId = crypto.randomUUID()
  const sideId = crypto.randomUUID()
  // Initiative participants are stored in ascending actor identity order.
  const actors = entries
    .map(({ characterId, label = 'Aria', controllerUserIds = [], public: visible = true }) =>
      encounterRunActorStateSchema.parse({
        id: crypto.randomUUID(),
        encounterId,
        sideId,
        kind: 'CHARACTER',
        sourceId: characterId,
        frozenState: null,
        outOfInitiative: false,
        label,
        systemId,
        stableTieKey: crypto.randomUUID(),
        public: visible,
        controllerUserIds,
        disposition: 'FRIENDLY',
        healthDisplay: null,
        resources: {},
        gmNotes: null,
        initiative: null,
        manualOrder: null,
        createdAt: NOW,
        updatedAt: NOW,
        snapshot: { kind: 'CHARACTER', id: characterId, label, systemId }
      })
    )
    .sort((left, right) => left.id.localeCompare(right.id))
  const currentActorId = actors.find((actor) =>
    entries.some((entry) => entry.current && entry.characterId === actor.sourceId)
  )?.id
  const optionalCombatSnapshot = {
    schemaVersion: 1,
    gameSystemId: systemId,
    definitions: []
  }
  const state = encounterRunStateSchema.parse({
    id: encounterId,
    campaignId,
    gameSystemId: systemId,
    blueprintId: crypto.randomUUID(),
    blueprintVersion: 1,
    blueprintChecksum: 'b'.repeat(64),
    name: 'Native Sheet Encounter',
    status,
    automationMode: 'MANUAL',
    manualReminderMode: 'OFF',
    healthDisplayDefault: 'HIDDEN',
    version: 1,
    round: status === 'ACTIVE' ? 1 : 0,
    currentActorId: currentActorId ?? null,
    actorIds: actors.map(({ id }) => id),
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    turnSequence: 0,
    sides: [{ id: sideId, label: 'Party', sortOrder: 0 }],
    createdAt: NOW,
    updatedAt: NOW
  })
  await memory.store.insert(
    'encounterRuns',
    encounterStoredRunSchema.parse({
      id: encounterId,
      campaignId,
      gameSystemId: systemId,
      status: state.status,
      version: state.version,
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      createCommandId: crypto.randomUUID(),
      createCommandFingerprint: checksumCanonicalJson(state),
      createdAt: NOW,
      updatedAt: NOW
    })
  )
  for (const actor of actors) await insertRunActor({ db: memory.store }, actor)
  // An ACTIVE Run projects from its normalized initiative round.
  if (status === 'ACTIVE')
    await insertInitiativeRound(memory, { encounterId, actors, currentActorId, now: NOW })
  if (scene) {
    await memory.store.insert('encounterActorTokenBindings', {
      encounterId,
      actorId: actors[0]!.id,
      tokenId: scene.tokenId,
      sceneId: scene.sceneId
    })
    const commandId = crypto.randomUUID()
    await memory.store.insert(
      'encounterSceneBindings',
      encounterSceneBindingSchema.parse({
        encounterId,
        campaignId,
        sceneId: scene.sceneId,
        commandId,
        commandFingerprint: checksumCanonicalJson({ commandId }),
        createdAt: NOW
      })
    )
  }
  return {
    encounterId,
    actorIds: actors.map(({ id }) => id),
    documents: memoryRoomDocuments(memory, [
      'encounterRuns',
      'encounterRunActors',
      'encounterActorSnapshots',
      'encounterSourceProjectionFacts',
      'encounterInitiativeRounds',
      'encounterInitiativeParticipants',
      'encounterActorTokenBindings',
      'encounterSceneBindings'
    ]),
    version: state.version
  }
}
