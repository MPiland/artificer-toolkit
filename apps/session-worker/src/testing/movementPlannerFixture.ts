import { resolveRuleOccurrenceInputDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionCharacterRulesInput } from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import {
  liveSessionEncounterRulesResponseSchema,
  type LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { liveRoomCharacterPartSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  campaignSceneStateDtoSchema,
  sceneTokenMovementCommandInputDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import {
  encounterSpatialRuleEffectRecordSchema,
  type EncounterSpatialRuleEffectRecord
} from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { serverRuleExecutionPendingOccurrenceId } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import {
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionCompiler'
import {
  createDnd5eMovementReactionChoiceDefinition,
  createDnd5eOpportunityReactionEligibilityDefinition,
  DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import {
  createSrdRulesRuntime,
  creatureFeature,
  currentSrdDefinition,
  SRD_VOCABULARY,
  srdDefinitions,
  TIMESTAMP
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CampaignSceneState, ScenePoint } from '@artificer-toolkit/shared/vtt'
import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareNativeLiveMovement } from '../nativeEncounterMovement.js'
import type { LiveCaptureReads } from '../nativeEncounterReads.js'
import { prepareLiveCharacterSheetFacts } from '../nativeCharacterRules.js'
import { characterPageFixtureFor } from './characterPageFixture.js'
import {
  captureFake,
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  maintainedState,
  testUuid,
  USER_ID
} from './liveCaptureFixture.js'
import { buildSrdSourceKinds } from './srdCharacterSource.js'

const SCENE_ID = testUuid(0x7f00)
const SCENE_DEFINITION_ID = testUuid(0x7f01)
const SCENE_DEFINITION_SAVE_ID = testUuid(0x7f02)
const MAP_ASSET_ID = testUuid(0x7f03)
const SCENE_VERSION = 3
const AUTHORITY_EPOCH = testUuid(0xe007)
/** The root command and Rule Occurrence of the movement under test. */
const MOVE_COMMAND_ID = testUuid(0x9003)
const OCCURRENCE_ID = testUuid(0x9001)
const MOVE_SAVE_ID = testUuid(0x9002)
const SAVE_LIFETIME_MS = 60_000
const TOKEN_SIZE = 100
/** The stored-input observations every response carries; the response schema requires at least three. */
const STORED_REVISIONS = (['SYSTEM', 'CAMPAIGN', 'PLAY'] as const).map((scope, index) => ({
  scope,
  id: testUuid(0x7e00 + index),
  revision: testUuid(0x7e10 + index)
}))

const grid = {
  kind: 'SQUARE' as const,
  origin: { x: 0, y: 0 },
  cellSize: TOKEN_SIZE,
  distancePerCell: 5,
  diagonalPolicy: 'EQUAL' as const,
  unit: 'FEET' as const
}

/** The SRD Wolf as the corpus seeds it. */
const srdWolf = (() => {
  const record = srdCreatureRecords.find((candidate) => candidate.id === wolf.id)
  if (!record) throw new Error('The SRD Wolf is missing.')
  return record
})()

/** A plain SRD Wolf: nothing it carries reacts to movement. */
export const plainWolf: CreatureAuthored = srdWolf

/** An SRD Wolf whose Bite is an opportunity attack: a Reaction taken when a creature leaves its reach. */
export const reactionWolf: CreatureAuthored = (() => {
  const bite = creatureFeature(srdWolf, 'Bite')
  const biteEffect = bite.effects?.[0]
  if (!biteEffect || biteEffect.invocation.kind !== 'ACTION')
    throw new Error('The SRD Wolf Bite is missing.')
  return {
    ...srdWolf,
    features: [
      {
        ...bite,
        effects: [
          {
            ...biteEffect,
            invocation: {
              ...biteEffect.invocation,
              activation: { code: 'REACTION' as const, amount: 1 },
              reactionMovementTrigger: {
                kind: 'MOVEMENT' as const,
                stage: 'BEFORE_LEAVE_REACH' as const,
                perceptionRequirement: null,
                eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
                movementInterruption: null
              }
            },
            paths: biteEffect.paths.slice(0, 1)
          }
        ]
      }
    ]
  }
})()

/** The policy definitions a movement reaction names; the SRD reusable set does not publish them. */
export const reactionPolicyDefinitions = [
  createDnd5eOpportunityReactionEligibilityDefinition(),
  createDnd5eMovementReactionChoiceDefinition()
].map((published) =>
  currentSrdDefinition({
    id: published.id,
    definitionFamilyKey: published.definitionFamilyKey,
    label: 'Movement reaction policy',
    description: 'Current D&D movement reaction policy.',
    document: published.definition,
    checksum: published.checksum
  })
)

/**
 * A one-shot, public spatial effect that deals 1 fire damage to whoever crosses its circle. Its graph
 * is frozen by the installed rules runtime, as casting freezes it.
 */
export async function spatialDamageEffect(input: {
  targetActorId: string
  center: ScenePoint
  radius: number
}): Promise<EncounterSpatialRuleEffectRecord> {
  const fire = SRD_DAMAGE_TYPES.find((type) => type.code === 'FIRE')
  if (!fire) throw new Error('The SRD fire damage type is missing.')
  const definitionId = testUuid(0x6001)
  const entryId = testUuid(0x6002)
  const occurrenceId = testUuid(0x6003)
  const graph = {
    schemaVersion: 1,
    id: definitionId,
    gameSystemId: SRD_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'damage',
        operation: { key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
          amount: { kind: 'LITERAL', value: 1 },
          damageTypeId: { kind: 'LITERAL', value: fire.id }
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'damage', port: 'targetActorId' },
      amount: { kind: 'NODE_OUTPUT', nodeId: 'damage', port: 'amount' },
      damageTypeId: { kind: 'NODE_OUTPUT', nodeId: 'damage', port: 'damageTypeId' }
    },
    sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'damage' }]
  } satisfies RuleGraphDefinition
  const runtime = await createSrdRulesRuntime()
  const prepared = await runtime.executeResolvedWithGraph?.({
    command: {
      definitionId,
      occurrenceId,
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: input.targetActorId,
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
          targetActorId: input.targetActorId,
          currentHitPoints: 1,
          temporaryHitPoints: 0,
          maximumHitPoints: 1,
          conditionIds: []
        })
      }
    },
    published: {
      id: definitionId,
      gameSystemId: SRD_SYSTEM_ID,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      checksum: checksumRuleDocument(graph),
      definition: graph
    }
  })
  if (!prepared) throw new Error('Frozen graph compilation is unavailable.')
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: ENCOUNTER_ID,
      sourceOccurrenceId: occurrenceId,
      rootCommandId: testUuid(0x6004),
      sourceActorId: null
    },
    authoredEffectId: definitionId,
    compiledEntryId: entryId,
    frozenGraphNodeId: 'damage',
    frozenGraph: prepared.graph,
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
  const lifecycle = { schemaVersion: 1 as const, remainingTicks: 3 }
  const spatialState = { schemaVersion: 1 as const, revealed: true }
  const placement = {
    schemaVersion: 1 as const,
    anchorKind: 'FIXED' as const,
    sourceTokenId: null,
    geometry: {
      frame: 'SCENE_ABSOLUTE' as const,
      shape: { kind: 'CIRCLE' as const, center: input.center, radius: input.radius }
    },
    triggerModes: ['CROSS' as const],
    movementKinds: ['VOLUNTARY' as const],
    activation: 'ONE_SHOT' as const,
    visibility: 'PUBLIC' as const,
    revealOnTrigger: false
  }
  return encounterSpatialRuleEffectRecordSchema.parse({
    id: testUuid(0x6005),
    encounterId: ENCOUNTER_ID,
    sceneId: SCENE_ID,
    createdOrdinal: 1,
    version: 1,
    definition,
    definitionChecksum: checksumCanonicalJson(definition),
    lifecycle,
    lifecycleChecksum: checksumCanonicalJson(lifecycle),
    placement,
    placementChecksum: checksumCanonicalJson(placement),
    spatialState,
    spatialStateChecksum: checksumCanonicalJson(spatialState),
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
}

/**
 * The captured SRD Character's sheet, prepared from its stored inputs and the SRD snapshot objects
 * the way a room prepares it. Every Character actor reads this one Character.
 */
export async function srdCharacterReads(
  characterId: string
): Promise<LiveCaptureReads['prepareCharacter']> {
  const part = liveRoomCharacterPartSchema.parse(
    characterPageFixtureFor({ characterId, userId: USER_ID, campaignId: CAMPAIGN_ID })
  )
  if (part.status !== 'ASSIGNED' || !part.inputs) throw new Error('Missing Character fixture.')
  const { inputs } = part
  const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
  const objects = buildSrdSourceKinds(false).flatMap(({ built }) => [
    contentSnapshotIndexObjectSchema.parse(JSON.parse(built.index.json)),
    contentSnapshotDocumentsObjectSchema.parse(JSON.parse(built.documents.json))
  ])
  return async (scope: LiveSessionCharacterRulesInput) => ({
    ...(await prepareLiveCharacterSheetFacts({ scope, inputs, system, objects })),
    revisions: []
  })
}

/** A Character's maintained Concentration, matching the SRD maintenance definition. */
export async function concentrationSlot(actorId: string) {
  const definition = await srdDefinitions.requireCurrent(
    DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  )
  return maintainedState({
    id: testUuid(0x5001),
    ownerActorId: actorId,
    definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
    definitionChecksum: definition.checksum
  })
}

export interface MovementScenarioConfig {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  /** The scene-pixel center of every actor's 100 px token. */
  positions: Readonly<Record<string, ScenePoint>>
  moverActorId: string
  path: readonly ScenePoint[]
  autoRollByActorId?: Readonly<Record<string, boolean>>
  extraDefinitions?: readonly ReturnType<typeof currentSrdDefinition>[]
  maintenanceSlot?: Awaited<ReturnType<typeof concentrationSlot>>
  prepareCharacter?: LiveCaptureReads['prepareCharacter']
  spatialEffects?: readonly EncounterSpatialRuleEffectRecord[]
  random?: (maximum: number) => number
}

/** What one planner call reads: the Scene, the save that carries the move and the Rule Occurrence. */
interface MovementStage {
  scene: CampaignSceneState
  save: ReturnType<typeof moveSave>
  occurrenceId: string
}

function moveSave(input: {
  id: string
  commandId: string
  tokenId: string
  state: EncounterRunState
  sceneVersion: number
  path: readonly ScenePoint[]
  movementResolution?: { commandJson: string; pendingSnapshotJson: string }
}) {
  const command = sceneTokenMovementCommandInputDtoSchema.parse({
    type: 'MOVE_SCENE_TOKEN',
    sceneId: SCENE_ID,
    commandId: input.commandId,
    expectedSceneVersion: input.sceneVersion,
    expectedEncounterVersion: input.state.version,
    correlationId: null,
    movementKind: 'VOLUNTARY',
    tokenId: input.tokenId,
    path: input.path
  })
  return sceneStoredGeometrySaveSchema.parse({
    id: input.id,
    sceneId: SCENE_ID,
    commandId: input.commandId,
    actorUserId: USER_ID,
    input: command,
    inputChecksum: checksumCanonicalJson(command),
    ...(input.movementResolution
      ? {
          movementResolution: {
            commandJson: input.movementResolution.commandJson,
            commandChecksum: checksumCanonicalJson(
              JSON.parse(input.movementResolution.commandJson)
            ),
            pendingSnapshotJson: input.movementResolution.pendingSnapshotJson,
            pendingSnapshotChecksum: checksumCanonicalJson(
              JSON.parse(input.movementResolution.pendingSnapshotJson)
            )
          }
        }
      : {}),
    snapshotVersion: 0,
    status: 'RECEIVING',
    expiresAt: Date.parse(TIMESTAMP) + SAVE_LIFETIME_MS,
    fogSaves: []
  })
}

/**
 * Plans one live movement the way the room does, with the Encounter's reads served from fakes and
 * every rule from the installed SRD System. `start` plans the move; `respond` plans the stored
 * answer to a pending outcome, which is a new command on a new save against the Scene the pending
 * movement left behind.
 */
export async function createMovementScenario(config: MovementScenarioConfig) {
  const runtime = await createSrdRulesRuntime()
  const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
  const tokenIdByActorId = new Map(
    config.actors.map((actor, index) => [actor.id, testUuid(0x7000 + index)])
  )
  const moverTokenId = tokenIdByActorId.get(config.moverActorId)
  if (!moverTokenId) throw new Error('The mover is not an actor of the Run.')
  const extraDefinitions = new Map(
    (config.extraDefinitions ?? []).map((definition) => [definition.id, definition])
  )

  function buildScene(version: number, moverPosition: ScenePoint) {
    return campaignSceneStateDtoSchema.parse({
      id: SCENE_ID,
      campaignId: CAMPAIGN_ID,
      definitionId: SCENE_DEFINITION_ID,
      definitionVersion: 1,
      name: 'Planner scene',
      ambientIllumination: 'BRIGHT',
      fogMode: 'OFF',
      visionRevealMode: 'ON_DRAG',
      grid,
      map: { assetId: MAP_ASSET_ID, width: 1000, height: 1000, tileManifestAssetId: null },
      version,
      annotations: [],
      barriers: [],
      darknessZones: [],
      lights: [],
      measurements: [],
      fogLayers: [],
      doorStates: {},
      tokens: config.actors.map((actor) => ({
        id: tokenIdByActorId.get(actor.id),
        assetId: null,
        controlledByUserIds: [],
        height: TOKEN_SIZE,
        width: TOKEN_SIZE,
        hidden: false,
        locked: false,
        label: actor.label,
        rotationDegrees: 0,
        position: actor.id === config.moverActorId ? moverPosition : config.positions[actor.id],
        vision: null
      }))
    })
  }

  function buildHeader(scene: CampaignSceneState) {
    const counts = {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: scene.tokens.length
    }
    return sceneLiveStateHeaderSchema.parse({
      id: scene.id,
      campaignId: scene.campaignId,
      definitionId: scene.definitionId,
      definitionSaveId: SCENE_DEFINITION_SAVE_ID,
      definitionVersion: scene.definitionVersion,
      name: scene.name,
      ambientIllumination: scene.ambientIllumination,
      fogMode: scene.fogMode,
      visionRevealMode: scene.visionRevealMode,
      grid: scene.grid,
      map: scene.map,
      version: scene.version,
      fogLayerCount: 0,
      counts,
      currentCounts: { ...counts, measurements: 0 }
    })
  }

  async function answer(stage: MovementStage, request: LiveSessionEncounterRulesRequest) {
    switch (request.kind) {
      case 'MOVEMENT_INPUTS':
        return liveSessionEncounterRulesResponseSchema.parse({
          kind: request.kind,
          revisions: STORED_REVISIONS,
          campaignOwnerUserId: USER_ID,
          autoRollByActorId: config.autoRollByActorId ?? {},
          appRoll: null,
          save: stage.save,
          header: buildHeader(stage.scene),
          bindings: config.actors.map((actor) => ({
            actorId: actor.id,
            tokenId: tokenIdByActorId.get(actor.id)
          }))
        })
      case 'INPUTS':
        return liveSessionEncounterRulesResponseSchema.parse({
          kind: request.kind,
          revisions: STORED_REVISIONS,
          state: config.state,
          system
        })
      case 'ACTOR':
        return liveSessionEncounterRulesResponseSchema.parse({
          kind: request.kind,
          revisions: STORED_REVISIONS,
          actor: config.actors.find((actor) => actor.id === request.actorId),
          effects: [],
          continueAfter: null
        })
      case 'DEFINITION':
        return liveSessionEncounterRulesResponseSchema.parse({
          kind: request.kind,
          revisions: STORED_REVISIONS,
          definition:
            extraDefinitions.get(request.definitionId) ??
            (await srdDefinitions.requireCurrent(request.definitionId))
        })
      case 'SCENE_SPATIAL_EFFECTS':
        return liveSessionEncounterRulesResponseSchema.parse({
          kind: request.kind,
          revisions: STORED_REVISIONS,
          sceneId: SCENE_ID,
          sceneVersion: stage.scene.version,
          effects: config.spatialEffects ?? [],
          continueAfter: null
        })
      case 'SYSTEM_VOCABULARY':
        return liveSessionEncounterRulesResponseSchema.parse({
          kind: request.kind,
          revisions: STORED_REVISIONS,
          snapshot: SRD_VOCABULARY
        })
      case 'MAINTENANCE_SLOT':
        return liveSessionEncounterRulesResponseSchema.parse({
          kind: request.kind,
          revisions: STORED_REVISIONS,
          state: config.maintenanceSlot ?? null
        })
      case 'MAINTENANCE_DEPENDENTS':
        return liveSessionEncounterRulesResponseSchema.parse({
          kind: request.kind,
          revisions: STORED_REVISIONS,
          effects: [],
          continueCursor: null
        })
      default:
        throw new Error(`The movement planner made an unexpected ${request.kind} capture.`)
    }
  }

  async function plan(stage: MovementStage) {
    const fake = captureFake((request) => answer(stage, request))
    const result = await prepareNativeLiveMovement({
      scope: {
        campaignId: CAMPAIGN_ID,
        authorityEpoch: AUTHORITY_EPOCH,
        expectedUserId: USER_ID,
        expectedRole: 'OWNER',
        encounterId: ENCOUNTER_ID,
        expectedVersion: config.state.version,
        movement: { encounterId: ENCOUNTER_ID, saveId: stage.save.id, baseTokenOrdinal: null }
      },
      scene: stage.scene,
      occurrenceId: stage.occurrenceId,
      runtime,
      captures: {
        ...fake.reads,
        prepareCharacter: config.prepareCharacter ?? fake.reads.prepareCharacter
      },
      occurredAt: TIMESTAMP,
      random: config.random ?? (() => 9)
    })
    return { result, requests: fake.requests }
  }

  const moverStart = config.positions[config.moverActorId]
  if (!moverStart) throw new Error('The mover has no position.')

  return {
    start() {
      return plan({
        scene: buildScene(SCENE_VERSION, moverStart),
        save: moveSave({
          id: MOVE_SAVE_ID,
          commandId: MOVE_COMMAND_ID,
          tokenId: moverTokenId,
          state: config.state,
          sceneVersion: SCENE_VERSION,
          path: config.path
        }),
        occurrenceId: OCCURRENCE_ID
      })
    },
    /** Plans `resolution` against the pending outcome of `previous`. */
    respond(
      previous: Awaited<ReturnType<typeof plan>>['result'],
      resolution: ResolveRuleOccurrenceInputDto['resolution']
    ) {
      const { snapshot, root } = pendingMovement(previous)
      const occurrenceId = serverRuleExecutionPendingOccurrenceId(snapshot)
      const answered = root.resolutionCommands.length
      const command = resolveRuleOccurrenceInputDtoSchema.parse({
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: ENCOUNTER_ID,
        commandId: testUuid(0x9100 + answered),
        expectedVersion: config.state.version,
        correlationId: null,
        occurrenceId,
        expectedOccurrenceVersion: answered,
        resolution
      })
      return plan({
        scene: buildScene(root.currentSceneVersion, root.currentPosition),
        save: moveSave({
          id: testUuid(0x9200 + answered),
          commandId: command.commandId,
          tokenId: moverTokenId,
          state: config.state,
          sceneVersion: root.currentSceneVersion,
          path: config.path,
          movementResolution: {
            commandJson: JSON.stringify(command),
            pendingSnapshotJson: JSON.stringify(snapshot)
          }
        }),
        occurrenceId
      })
    }
  }
}

/** The pending snapshot a planned movement left, read as the planner reads it back. */
export function pendingMovement(planned: {
  outcome: { kind: string } | { kind: 'PENDING'; pendingSnapshot: unknown }
}) {
  if (planned.outcome.kind !== 'PENDING' || !('pendingSnapshot' in planned.outcome))
    throw new Error(`The movement is ${planned.outcome.kind}, not pending.`)
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
    JSON.parse(JSON.stringify(planned.outcome.pendingSnapshot))
  )
  return { snapshot, ...readEncounterMovementPendingContext(snapshot) }
}
