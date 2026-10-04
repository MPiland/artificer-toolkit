import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterSceneBindingSchema,
  encounterStoredRunSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { encounterInitiativeRoundStateDtoSchema } from '@artificer-toolkit/schema/shared/initiativeState'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { insertRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomDocument } from '../roomEncounterStore.js'

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
  status = 'ACTIVE'
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
  const native = createMemoryEncounterStore({ idPrefix: 'sheet-fixture' })
  await native.store.insert(
    'encounterRuns',
    encounterStoredRunSchema.parse({
      id: encounterId,
      campaignId,
      gameSystemId: systemId,
      status: state.status,
      version: state.version,
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      createdAt: NOW,
      updatedAt: NOW
    })
  )
  for (const actor of actors) await insertRunActor({ db: native.store }, actor)
  // An ACTIVE Run projects from its normalized initiative round.
  const initiative = encounterInitiativeRoundStateDtoSchema.parse({
    round: {
      encounterId,
      round: 1,
      procedure: 'MANUAL',
      cadence: 'ENCOUNTER_START',
      status: 'ACTIVE',
      policySnapshotChecksum: null,
      nextTurnOrderOrdinal: actors.length,
      version: 0,
      createdAt: NOW,
      updatedAt: NOW
    },
    sides: [],
    participants: actors.map((actor, turnOrderOrdinal) => ({
      encounterId,
      round: 1,
      actorId: actor.id,
      sideId,
      // Actors before the current one have acted, matching the Run's current actor.
      status: !currentActorId
        ? 'READY'
        : actor.id === currentActorId
          ? 'ACTIVE'
          : turnOrderOrdinal < actors.findIndex((entry) => entry.id === currentActorId)
            ? 'ACTED'
            : 'READY',
      initiativeScore: null,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration: null,
      declarationChecksum: null,
      turnOrderOrdinal,
      version: 0,
      createdAt: NOW,
      updatedAt: NOW
    }))
  })
  if (status === 'ACTIVE') {
    await native.store.insert('encounterInitiativeRounds', initiative.round)
    for (const participant of initiative.participants)
      await native.store.insert('encounterInitiativeParticipants', participant)
  }
  if (scene) {
    await native.store.insert('encounterActorTokenBindings', {
      encounterId,
      actorId: actors[0]!.id,
      tokenId: scene.tokenId,
      sceneId: scene.sceneId
    })
    const commandId = crypto.randomUUID()
    await native.store.insert(
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
  const documents: RoomDocument[] = []
  for (const table of [
    'encounterRuns',
    'encounterRunActors',
    'encounterActorProjectionFacts',
    'encounterSourceProjectionFacts',
    'encounterInitiativeRounds',
    'encounterInitiativeParticipants',
    'encounterActorTokenBindings',
    'encounterSceneBindings'
  ] as const) {
    for (const { _id, _creationTime, ...fields } of native.documents(table))
      documents.push({ table, id: _id, creationTime: _creationTime, fields })
  }
  return {
    encounterId,
    actorIds: actors.map(({ id }) => id),
    documents,
    version: state.version
  }
}
