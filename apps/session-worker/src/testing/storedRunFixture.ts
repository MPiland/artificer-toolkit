import { insertRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import {
  followedActorId,
  rollsInitiative,
  takesInitiativeTurns
} from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import type { EncounterTableName } from '@artificer-toolkit/encounter-persistence/store'
import { encounterStoredRunSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterInitiativeRoundStateDtoSchema } from '@artificer-toolkit/schema/shared/initiativeState'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
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
 * Writes the manual initiative round an ACTIVE Run projects from: one participant per actor in
 * `actors` order, those before the current actor already acted. An owned actor acts on its owner's
 * turn and has none (D190a); one authored to act right after its owner is seated behind it (D200).
 */
export async function insertInitiativeRound(
  memory: ReturnType<typeof createMemoryEncounterStore>,
  input: {
    encounterId: string
    actors: readonly EncounterRunActorState[]
    currentActorId: string | undefined
    now: string
    /** The policy the Run froze, where its round is not the manual one. */
    policy?: { snapshot: EncounterInitiativePolicySnapshotDto; checksum: string }
  }
) {
  const { encounterId, currentActorId, now, policy } = input
  const actors = input.actors.filter(rollsInitiative)
  for (
    let pending = input.actors.filter(
      (actor) => takesInitiativeTurns(actor) && !rollsInitiative(actor)
    );
    pending.length > 0;
  ) {
    const unseated = pending.filter((follower) => {
      const anchorId = followedActorId(follower, input.actors, (id) =>
        actors.some((actor) => actor.id === id)
      )
      if (anchorId === null) return true
      actors.splice(actors.findIndex((actor) => actor.id === anchorId) + 1, 0, follower)
      return false
    })
    if (unseated.length === pending.length) break
    pending = unseated
  }
  const currentOrdinal = actors.findIndex((actor) => actor.id === currentActorId)
  const initiative = encounterInitiativeRoundStateDtoSchema.parse({
    round: {
      encounterId,
      round: 1,
      procedure: policy?.snapshot.policy.document.procedure ?? 'MANUAL',
      cadence: 'ENCOUNTER_START',
      status: 'ACTIVE',
      policySnapshotChecksum: policy?.checksum ?? null,
      nextTurnOrderOrdinal: actors.length,
      version: 0,
      createdAt: now,
      updatedAt: now
    },
    sides: [],
    // The contract stores participants by ascending actor identity; turn order is the ordinal.
    participants: actors
      .map((actor, turnOrderOrdinal) => ({
        encounterId,
        round: 1,
        actorId: actor.id,
        sideId: actor.sideId,
        status: !currentActorId
          ? 'READY'
          : actor.id === currentActorId
            ? 'ACTIVE'
            : turnOrderOrdinal < currentOrdinal
              ? 'ACTED'
              : 'READY',
        // A scored round seats its actors by descending score, so a late arrival sorts among them.
        initiativeScore: policy ? 20 - turnOrderOrdinal : null,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal,
        version: 0,
        createdAt: now,
        updatedAt: now
      }))
      .sort((left, right) => left.actorId.localeCompare(right.actorId))
  })
  await memory.store.insert('encounterInitiativeRounds', initiative.round)
  for (const participant of initiative.participants)
    await memory.store.insert('encounterInitiativeParticipants', participant)
}

/** Writes a Run row and its actors through the persistence write path. */
export async function insertStoredRun(
  memory: ReturnType<typeof createMemoryEncounterStore>,
  run: EncounterRunState,
  actors: readonly EncounterRunActorState[]
) {
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
      concentrationCasterCharacterIds: [],
      createdAt: run.createdAt,
      updatedAt: run.updatedAt
    })
  )
  for (const actor of actors) await insertRunActor({ db: memory.store }, actor)
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
  await insertStoredRun(memory, run, actors)
  return memoryRoomDocuments(memory, [
    'encounterRuns',
    'encounterRunActors',
    'encounterActorSnapshots',
    'encounterSourceProjectionFacts'
  ])
}
