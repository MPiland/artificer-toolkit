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
import { compileDnd5eCreatureRuleFacts } from '@artificer-toolkit/rules-runtime/systems/dnd5e/creatureRuleFacts'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { insertInitiativeRound, memoryRoomDocuments } from './storedRunFixture.js'

const NOW = '2026-09-30T00:00:00.000Z'

/**
 * One ACTIVE manual Run in the Campaign with an unfrozen Character actor per entry of `actors` and
 * a hostile Creature actor per entry of `creatures` (the SRD System only), stored as the room holds
 * it: the Run, its actors and their normalized initiative round. `scene` binds the Encounter, the
 * first Character's token (when it names one) and each Creature's token to a Scene.
 */
export async function encounterRunFixture({
  campaignId,
  systemId,
  actors: entries,
  creatures = [],
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
  creatures?: readonly { label: string; tokenId: string; statBlock: CreatureAuthored }[]
  scene?: { sceneId: string; tokenId?: string }
  /** A PREPARED Run has not started: round 0, no initiative round. */
  status?: 'ACTIVE' | 'PREPARED'
  /** Holds the Run beside the Runs already in this store, which `documents` then lists too. */
  memory?: ReturnType<typeof createMemoryEncounterStore>
}) {
  const encounterId = crypto.randomUUID()
  const sideId = crypto.randomUUID()
  const vocabularyIdentity = {
    snapshotId: crypto.randomUUID(),
    systemId: srdSystemRecord.id,
    snapshotVersion: 1,
    schemaVersion: 1,
    document: srdSystemRecord
  }
  const vocabulary = systemVocabularySnapshotSchema.parse({
    ...vocabularyIdentity,
    checksum: checksumCanonicalJson(vocabularyIdentity)
  })
  const creatureActors = creatures.map(({ label, tokenId, statBlock }) => {
    const sourceId = crypto.randomUUID()
    return {
      tokenId,
      actor: encounterRunActorStateSchema.parse({
        id: crypto.randomUUID(),
        encounterId,
        sideId,
        kind: 'CREATURE',
        label,
        sourceId,
        sourceRevision: 1,
        public: true,
        controllerUserIds: [],
        disposition: 'HOSTILE',
        initiative: null,
        manualOrder: null,
        healthDisplay: null,
        systemId: srdSystemRecord.id,
        stableTieKey: crypto.randomUUID(),
        gmNotes: null,
        currentHitPoints: statBlock.hitPoints,
        maxHitPoints: statBlock.hitPoints,
        tempHitPoints: 0,
        defeated: false,
        absence: null,
        conditions: [],
        resources: {},
        createdAt: NOW,
        updatedAt: NOW,
        snapshot: {
          kind: 'CREATURE',
          id: sourceId,
          label,
          systemId: srdSystemRecord.id,
          sourceRevision: 1,
          sourceVersionId: crypto.randomUUID(),
          sourceChecksum: 'a'.repeat(64),
          maxHitPoints: statBlock.hitPoints,
          payload: { ...statBlock, id: sourceId, label },
          ruleFacts: compileDnd5eCreatureRuleFacts({ creature: statBlock, vocabulary })
        }
      })
    }
  })
  // Initiative participants are stored in ascending actor identity order.
  const actors = [
    ...entries.map(
      ({ characterId, label = 'Aria', controllerUserIds = [], public: visible = true }) =>
        encounterRunActorStateSchema.parse({
          id: crypto.randomUUID(),
          encounterId,
          sideId,
          kind: 'CHARACTER',
          sourceId: characterId,
          frozenState: null,
          absence: null,
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
    ),
    ...creatureActors.map(({ actor }) => actor)
  ].sort((left, right) => left.id.localeCompare(right.id))
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
      concentrationCasterCharacterIds: [],
      createdAt: NOW,
      updatedAt: NOW
    })
  )
  for (const actor of actors) await insertRunActor({ db: memory.store }, actor)
  // An ACTIVE Run projects from its normalized initiative round.
  if (status === 'ACTIVE')
    await insertInitiativeRound(memory, { encounterId, actors, currentActorId, now: NOW })
  if (scene) {
    const characterActor = actors.find((actor) => actor.kind === 'CHARACTER')
    const bindings = [
      ...(characterActor && scene.tokenId
        ? [{ actorId: characterActor.id, tokenId: scene.tokenId }]
        : []),
      ...creatureActors.map(({ actor, tokenId }) => ({ actorId: actor.id, tokenId }))
    ]
    for (const binding of bindings)
      await memory.store.insert('encounterActorTokenBindings', {
        encounterId,
        sceneId: scene.sceneId,
        ...binding
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
