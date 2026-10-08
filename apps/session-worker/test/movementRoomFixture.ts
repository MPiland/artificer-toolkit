import { runInDurableObject } from 'cloudflare:test'
import { vi } from 'vitest'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import {
  liveRoomDefinitionSchema,
  liveRoomInputsInputSchema,
  type LiveRoomInputsResponse
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { encounterSceneBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import { characterActiveRuleEffectStoredSchema } from '@artificer-toolkit/schema/projections/activeRuleEffectStorage'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { Dnd5eOptionalCombatRuleKindDto } from '@artificer-toolkit/schema/shared/optionalCombat'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import {
  currentSrdDefinition,
  srdEncounterState,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { SRD_REUSABLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import {
  concentrationDescriptor,
  reactionPolicyDefinitions,
  spatialDamageEffect
} from '../src/testing/movementPlannerFixture.js'
import type { CharacterPlayOverrides } from '../src/testing/characterPageFixture.js'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import {
  insertInitiativeRound,
  insertStoredRun,
  memoryRoomDocuments
} from '../src/testing/storedRunFixture.js'
import { characterRoomInputs, srdSystemRoomInputs } from './characterSheetInputsFixture.js'
import { doorScene, fixture, routeEncounterRequests, synchronizeScene } from './liveRoomFixture.js'
import { ROOM_AUTHORIZATION_PATH, roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import { ROOM_INPUTS_PATH, roomInputsResponse } from './roomInputsFixture.js'

const NOW = '2026-09-30T00:00:00.000Z'
const TOKEN_SIZE = 100
/** The maintained Concentration state a `concentration` room holds for its mover. */
export const CONCENTRATION_STATE_ID = testUuid(0x5001)

/** The Feature that gives the Character advantage on its Concentration saves. */
export const concentrationAdvantageFeature: ClassFeature = {
  id: testUuid(0x5301),
  label: 'Focused Concentration',
  description: 'You have advantage on Constitution saving throws to maintain Concentration.',
  availableAtLevel: 1,
  order: 0,
  grants: {
    modifiers: [
      {
        id: testUuid(0x5302),
        grantKind: 'MODIFIER_GRANT',
        valueDomainCode: 'SAVING_THROW_MODIFIER',
        domain: {
          ability: 'CONSTITUTION',
          ruleDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
        },
        modifierKind: 'ADVANTAGE',
        scope: 'GLOBAL',
        selectionKind: 'GRANTED',
        order: 0
      }
    ]
  }
}

/** An effect with no behavior of its own: it exists to end with the Concentration that maintains it. */
export function dependentEffectDefinition(input: { encounterId: string; sourceActorId: string }) {
  const definitionId = testUuid(0x5201)
  const entryId = testUuid(0x5202)
  return activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: testUuid(0x5203),
      rootCommandId: testUuid(0x5204),
      sourceActorId: input.sourceActorId
    },
    authoredEffectId: definitionId,
    compiledEntryId: entryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId: SRD_SYSTEM_ID,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: 'ENCOUNTER',
      expiration: { kind: 'TICKS', initialRemaining: 3, decrementStage: 'END_OF_TURN' }
    }
  })
}

/**
 * Serves the room's dice: each roll takes the next of `rolls`, then `fallback`. Each value is the
 * zero-based result of one die, so a d20 rolls face value + 1. Everything else the room asks the
 * platform's random source for is passed through.
 */
function rigDice(rolls: readonly number[], fallback: number) {
  const pending = [...rolls]
  const platform = crypto.getRandomValues
  let drawn = 0
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    if (!(array instanceof Uint32Array) || array.length !== 1) return platform.call(crypto, array)
    drawn += 1
    array[0] = pending.shift() ?? fallback
    return array
  })
  return () => drawn
}

export interface MovementRoomConfig {
  /** The Run's actors; the mover is the current actor. */
  actors: readonly EncounterRunActorState[]
  moverActorId: string
  /** The scene-pixel center of every actor's 100 px token. */
  positions: Readonly<Record<string, ScenePoint>>
  automationMode?: AutomationModeDto
  optionalCombatKinds?: readonly Dnd5eOptionalCombatRuleKindDto[]
  /** Whose stored preference rolls dice automatically: the GM's or the Character player's. */
  autoRoll?: 'GAME_MASTER' | 'PLAYER' | 'BOTH'
  /**
   * Spatial effects that deal 1 damage to whoever crosses them (or, with `save`, fails their save).
   * They are fixed to the Scene unless `moving` anchors them to the mover's token.
   */
  spatialEffects?: readonly {
    center: ScenePoint
    radius: number
    variant?: number
    save?: boolean
    /** Applies this condition instead of dealing damage. */
    condition?: { conditionId: string }
    moving?: { activation: 'ONE_SHOT' | 'REPEATABLE'; hidden: boolean }
  }[]
  /** The mover, a Character, maintains Concentration. */
  concentration?: boolean
  /** The Character who maintains Concentration, when not the mover. */
  concentrationOwnerActorId?: string
  /** Actors that each hold one effect the mover's Concentration maintains; they end with it. */
  concentrationDependentActorIds?: readonly string[]
  /** Features the mover Character's Class carries (see `concentrationAdvantageFeature`). */
  characterClassFeatures?: readonly ClassFeature[]
  /** Further SRD Equipment the mover Character carries, equipped (see healersKit10Uses). */
  characterEquipment?: readonly EquipmentAuthored[]
  /** The mover Character's starting play state, where it differs from the capture. */
  characterPlay?: CharacterPlayOverrides
  /** The next dice results (see `rigDice`); `fallbackRoll` serves every roll after them. */
  rolls?: readonly number[]
  fallbackRoll?: number
  /** Further reusable definitions the room serves, such as Encounter lifecycle policies. */
  definitions?: readonly ReturnType<typeof currentSrdDefinition>[]
  /** Writes rows into the Run's store before the room hydrates, such as turn effects. */
  seed?: (input: {
    effects: ReturnType<typeof createActiveRuleEffectStore>
    encounterId: string
    occurredAt: string
  }) => Promise<void>
}

/**
 * A native room playing one movement: an ACTIVE Encounter bound to the presented Scene, seeded
 * through the room's hydration inputs (Run, Scene, System, definitions, Character page and
 * authorization), so every command runs the real room path. The GM's socket sends the commands.
 */
export async function movementRoom(config: MovementRoomConfig) {
  const campaignId = crypto.randomUUID()
  const encounterId = crypto.randomUUID()
  const actors = config.actors.map((actor) =>
    encounterRunActorStateSchema.parse({ ...actor, encounterId })
  )
  const state = encounterRunStateSchema.parse({
    ...srdEncounterState({
      actors,
      currentActorId: config.moverActorId,
      automationMode: config.automationMode,
      optionalCombatKinds: config.optionalCombatKinds
    }),
    id: encounterId,
    campaignId
  })
  const tokenIdByActorId = new Map(actors.map((actor) => [actor.id, crypto.randomUUID()]))
  const moverTokenId = tokenIdByActorId.get(config.moverActorId)
  if (!moverTokenId) throw new Error('The mover is not an actor of the Run.')
  const scene: CampaignSceneStateDto = {
    ...doorScene(campaignId).scene,
    name: 'Movement planner scene',
    barriers: [],
    doorStates: {},
    // Encounter control, not exploration, decides these moves.
    fogMode: 'OFF',
    grid: {
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      cellSize: TOKEN_SIZE,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL',
      unit: 'FEET'
    },
    map: { assetId: crypto.randomUUID(), width: 1000, height: 1000, tileManifestAssetId: null },
    tokens: actors.map((actor) => ({
      id: tokenIdByActorId.get(actor.id)!,
      assetId: null,
      controlledByUserIds: [],
      height: TOKEN_SIZE,
      width: TOKEN_SIZE,
      hidden: false,
      locked: false,
      label: actor.label,
      rotationDegrees: 0,
      position: config.positions[actor.id]!,
      vision: null
    }))
  }
  const base = await fixture(scene)
  base.room.systemId = SRD_SYSTEM_ID
  base.capture.sceneEncounterId = encounterId

  const character = actors.find((actor) => actor.kind === 'CHARACTER')
  const characterId = character?.sourceId ?? null
  const characterPage = characterId
    ? await characterRoomInputs({
        campaignId,
        characterId,
        ownerUserId: base.playerId,
        classFeatures: config.characterClassFeatures,
        equipment: config.characterEquipment,
        play: config.characterPlay
      })
    : null
  const assignments = characterId ? [{ characterId, userId: base.playerId }] : []

  const memory = createMemoryEncounterStore({ idPrefix: 'movement-room' })
  await insertStoredRun(memory, state, actors)
  await insertInitiativeRound(memory, {
    encounterId,
    actors,
    currentActorId: config.moverActorId,
    now: NOW
  })
  for (const actor of actors)
    await memory.store.insert('encounterActorTokenBindings', {
      encounterId,
      actorId: actor.id,
      tokenId: tokenIdByActorId.get(actor.id)!,
      sceneId: scene.id
    })
  const bindingCommandId = crypto.randomUUID()
  await memory.store.insert(
    'encounterSceneBindings',
    encounterSceneBindingSchema.parse({
      encounterId,
      campaignId,
      sceneId: scene.id,
      commandId: bindingCommandId,
      commandFingerprint: checksumCanonicalJson({ commandId: bindingCommandId }),
      createdAt: NOW
    })
  )
  const spatial = await createSpatialRuleEffectStore({ db: memory.store }).scope({
    encounterId,
    sceneId: scene.id
  })
  if (!spatial) throw new Error('The Scene binding is missing.')
  const spatialEffectIds: string[] = []
  for (const { moving, ...effect } of config.spatialEffects ?? []) {
    const { id } = await spatial.create(
      await spatialDamageEffect({
        encounterId,
        targetActorId: config.moverActorId,
        ...effect,
        moving: moving && { ...moving, sourceTokenId: moverTokenId }
      })
    )
    spatialEffectIds.push(id)
  }
  const dependentEffectIds: string[] = []
  if (config.concentration) {
    const effects = createActiveRuleEffectStore({ db: memory.store })
    const concentrationOwnerId = config.concentrationOwnerActorId ?? config.moverActorId
    await effects.createMaintainedState({
      id: CONCENTRATION_STATE_ID,
      encounterId,
      ownerActorId: concentrationOwnerId,
      descriptor: await concentrationDescriptor(concentrationOwnerId),
      occurredAt: NOW
    })
    for (const [index, targetActorId] of (config.concentrationDependentActorIds ?? []).entries()) {
      const { id } = await effects.create({
        id: testUuid(0x5100 + index),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId },
        maintainedEffectStateId: CONCENTRATION_STATE_ID,
        lifecycle: { schemaVersion: 1, remainingTicks: 3 },
        definition: dependentEffectDefinition({ encounterId, sourceActorId: concentrationOwnerId }),
        occurredAt: NOW
      })
      dependentEffectIds.push(id)
    }
  }
  await config.seed?.({
    effects: createActiveRuleEffectStore({ db: memory.store }),
    encounterId,
    occurredAt: NOW
  })
  // A Character's dependents are rows of the Character, loaded with it, not of the Run.
  const characterOfActor = new Map(
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [[actor.id, actor.sourceId]] : []))
  )
  const characterDependents = memory
    .documents('encounterActiveRuleEffects')
    .filter((row) => characterOfActor.has(row.targetActorId))
  const characterDependentRowIds = new Set<string>(characterDependents.map((row) => row._id))
  const run: Extract<LiveRoomInputsResponse, { kind: 'RUN' }> = {
    kind: 'RUN',
    encounterVersion: state.version,
    activeEncounterId: null,
    maintenanceCharacterOwners: characterDependents.map((row) => ({
      maintainedStateId: CONCENTRATION_STATE_ID,
      characterId: characterOfActor.get(row.targetActorId)!
    })),
    documents: memoryRoomDocuments(memory, [
      'encounterRuns',
      'encounterRunActors',
      'encounterActorSnapshots',
      'encounterSourceProjectionFacts',
      'encounterInitiativeRounds',
      'encounterInitiativeParticipants',
      'encounterActorTokenBindings',
      'encounterSceneBindings',
      'encounterSpatialRuleEffects',
      'encounterMaintainedEffectStates',
      'encounterActiveRuleEffects'
    ]).filter((document) => !characterDependentRowIds.has(document.id)),
    continueCursor: null
  }
  const characterInputs = {
    parts: (characterPage?.parts ?? []).map((part) => {
      if (part.status !== 'ASSIGNED') throw new Error('The Character fixture part is not assigned.')
      return {
        ...part,
        documents: [
          ...part.documents,
          ...characterDependents.map((row) => ({
            table: 'characterActiveRuleEffects' as const,
            id: row._id,
            creationTime: row._creationTime,
            fields: characterActiveRuleEffectStoredSchema.parse({
              id: row.id,
              characterId: characterOfActor.get(row.targetActorId),
              sourceEncounterId: encounterId,
              maintainedEffectStateId: row.maintainedEffectStateId,
              createdOrdinal: row.createdOrdinal,
              version: row.version,
              definitionJson: row.definitionJson,
              definitionChecksum: row.definitionChecksum,
              lifecycle: row.lifecycle,
              lifecycleChecksum: row.lifecycleChecksum,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt
            })
          }))
        ]
      }
    }),
    system: characterPage?.system ?? srdSystemRoomInputs(campaignId),
    run
  }
  const definitions = [
    ...SRD_REUSABLE_DEFINITIONS.map(currentSrdDefinition),
    ...reactionPolicyDefinitions,
    ...(config.definitions ?? [])
  ].map((definition) =>
    liveRoomDefinitionSchema.parse({ id: definition.id, sourceKind: 'PLATFORM', definition })
  )
  const autoRollUserIds =
    config.autoRoll === 'GAME_MASTER'
      ? [base.userId]
      : config.autoRoll === 'PLAYER'
        ? [base.playerId]
        : config.autoRoll === 'BOTH'
          ? [base.userId, base.playerId]
          : []
  await routeEncounterRequests(base, async (pathname, request) => {
    if (pathname === ROOM_AUTHORIZATION_PATH)
      return Response.json(
        roomAuthorizationResponse({
          members: base.authorization.members,
          assignments,
          characterRevisions: characterPage
            ? [{ characterId: characterId!, revision: characterPage.characterRevision }]
            : [],
          autoRollUserIds,
          play: {
            encounter: {
              encounterId,
              sceneId: scene.id,
              healthDisplayDefault: state.healthDisplayDefault,
              actors: actors.map(({ id, kind, sourceId, controllerUserIds, healthDisplay }) => ({
                id,
                kind,
                sourceId,
                controllerUserIds,
                healthDisplay
              })),
              tokens: actors.map(({ id }) => ({
                actorId: id,
                tokenId: tokenIdByActorId.get(id)!
              }))
            }
          }
        })
      )
    if (pathname !== ROOM_INPUTS_PATH) return undefined
    const { scope } = liveRoomInputsInputSchema.parse(await request.json())
    // The Scene scopes stay with the base room's raw Scene.
    if (scope.kind === 'SCENE' || scope.kind === 'SCENE_DEFINITION') return undefined
    return Response.json(
      roomInputsResponse(scope, {
        campaignId,
        systemId: SRD_SYSTEM_ID,
        ownerUserId: base.userId,
        members: base.authorization.members,
        assignments,
        characterInputs,
        definitions
      })
    )
  })
  const diceDrawn = rigDice(config.rolls ?? [], config.fallbackRoll ?? 8)
  await synchronizeScene(base, scene)

  /** Sends one frame on the GM's socket and waits for the room's answer to `commandId`. */
  async function send(commandId: string, command: Record<string, unknown>) {
    const first = base.messages.length
    base.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command
      })
    )
    return vi.waitFor(() => {
      const answer = base.messages
        .slice(first)
        .find(
          (
            message
          ): message is Extract<
            LiveSessionWebSocketServerMessageDto,
            { type: 'COMMAND_COMMITTED' | 'COMMAND_REJECTED' }
          > =>
            (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
            message.commandId === commandId
        )
      if (!answer) throw new Error('The room has not answered the command.')
      return answer
    })
  }

  return {
    base,
    campaignId,
    encounterId,
    moverActorId: config.moverActorId,
    /** The Concentration-maintained effects, in `concentrationDependentActorIds` order. */
    dependentEffectIds,
    /** The spatial effects' ids, in `spatialEffects` order. */
    spatialEffectIds,
    /** How many dice the room has rolled since the room was built. */
    diceDrawn,
    scene,
    moverTokenId,
    send,
    /** The mover walks `path`, a voluntary move of its token through the room's Scene command. */
    move(path: readonly ScenePoint[], expectedEncounterVersion: number = state.version) {
      const commandId = crypto.randomUUID()
      return send(commandId, {
        scope: 'SCENE',
        command: {
          type: 'MOVE_SCENE_TOKEN',
          commandId,
          correlationId: null,
          expectedEncounterVersion,
          expectedSceneVersion: scene.version,
          movementKind: 'VOLUNTARY',
          path,
          sceneId: scene.id,
          tokenId: moverTokenId
        }
      })
    },
    /** The Encounter's one PENDING movement decision, as the room stored it; null when none waits. */
    pending() {
      return runInDurableObject(base.stub, async (_instance, context) => {
        const room = new RoomEncounterStore(context.storage)
        const occurrence = room
          .documents('encounterRuleOccurrences')
          .find((candidate) => candidate.state === 'PENDING')
        if (!occurrence) return null
        const snapshot = await readPendingSnapshot({ db: room.store }, occurrence)
        if (!snapshot) throw new Error('The pending occurrence holds no snapshot.')
        return {
          occurrence,
          encounterVersion: room.documents('encounterRuns')[0]!.version,
          ...readEncounterMovementPendingContext(snapshot)
        }
      })
    },
    /** The room's committed rule receipts in commit order, parsed. */
    receipts() {
      return runInDurableObject(base.stub, async (_instance, context) =>
        new RoomEncounterStore(context.storage)
          .documents('encounterRuleReceipts')
          .map(({ commandId, actorUserId, commandType, commandMetadataJson, resultJson }) => ({
            commandId,
            actorUserId,
            commandType,
            metadata: JSON.parse(commandMetadataJson) as unknown,
            result: JSON.parse(resultJson) as unknown
          }))
      )
    },
    /** Answers the PENDING movement decision with `resolution`. */
    async respond(resolution: Record<string, unknown>, expectedOccurrenceVersion?: number) {
      const pending = await this.pending()
      if (!pending) throw new Error('No movement decision is pending.')
      const commandId = crypto.randomUUID()
      return send(commandId, {
        scope: 'ENCOUNTER',
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId,
          commandId,
          expectedVersion: pending.encounterVersion,
          occurrenceId: pending.occurrence.id,
          expectedOccurrenceVersion: expectedOccurrenceVersion ?? pending.occurrence.version,
          correlationId: null,
          resolution
        }
      })
    }
  }
}
