import type {
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  LiveSessionExpectedScene,
  LiveSessionMovementCommitInput,
  LiveSessionMovementPrepareInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { LiveSessionMovementCaptureScope } from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import type { LiveSessionScenePublicationDto } from '@artificer-toolkit/schema/api/liveSessionState'
import type {
  SceneBaseOrdinals,
  SceneGeometryBeginResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneSessionVisionComposition } from '@artificer-toolkit/schema/api/sceneSessionVision'
import type {
  CampaignSceneStateDto,
  SceneGeometryCommandInputDto,
  SceneTokenMovementCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  preparedMovementCost,
  preparedMovementSceneDelta,
  preparedMovementSegment,
  preparedMoverSceneDelta
} from '@artificer-toolkit/rules-runtime/encounterMovementPublication'
import { encounterMovementPassageFacts } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePolicy'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { toSpatialInstances } from '@artificer-toolkit/rules-runtime/encounterSpatialCandidateExecution'
import {
  applySceneDelta,
  applySceneGeometryDelta,
  deriveSceneCommandFogLayer,
  planSceneCommandExploration,
  VTT_SCENE_LIMITS,
  type SceneFogLayer,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import { geometryTarget } from '@artificer-toolkit/encounter-persistence/sceneGeometryValues'

import {
  withCharacterControllers,
  type CharacterControlAssignment
} from '@artificer-toolkit/shared/campaign/characterControl'
import { LiveSessionRouteError } from './liveSessionRoutes.js'
import { RoomSceneCommandRefusal } from './roomSceneEdits.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { prepareNativeLiveMovement } from './nativeEncounterMovement.js'
import { planConcealmentPrune } from './nativeConcealmentPrune.js'
import type { LiveEncounterActor } from './nativeRoomEncounterCommand.js'

/**
 * A room command that stages a Scene save first: a token move, door change, token or barrier edit,
 * or a movement decision.
 */
export type StagedSceneCommand =
  | SceneTokenMovementCommandInputDto
  | SceneGeometryCommandInputDto
  | ResolveRuleOccurrenceInputDto
  | VoidRuleOccurrenceInputDto

/** The room's synchronized Scene the command is planned against, never filtered for a member. */
export interface StagedSceneContext {
  scene: CampaignSceneStateDto
  baseOrdinals: SceneBaseOrdinals
  characterRevisions: SceneSessionVisionComposition['characterRevisions']
  presentation: LiveSessionScenePublicationDto['presentation']
}

type PreparedStagedSceneCommit = {
  saveId: string
  expectedScene: LiveSessionExpectedScene
  nextScene: CampaignSceneStateDto
  fogChanged: boolean
} & (
  | {
      kind: 'MOVEMENT'
      commit: Omit<LiveSessionMovementCommitInput, 'expectedScene'>
      concealmentPrunes: Awaited<ReturnType<typeof planConcealmentPrune>>
    }
  | {
      kind: 'GEOMETRY'
      finish: LiveSessionMovementCommitInput['finish']
      fogLayers: SceneFogLayer[]
    }
)

/**
 * Plans a staged command up to its commit from the room's admitted save: any Encounter rules run in
 * the DO, each fog owner's complete layer is derived, and the published Scene is predicted. The
 * caller commits the plan in its own transaction; nothing here changes gameplay or authority.
 */
export async function prepareStagedSceneCommit(input: {
  actor: LiveEncounterActor
  assignments: readonly CharacterControlAssignment[]
  command: StagedSceneCommand
  context: StagedSceneContext
  runtime: RulesRuntimeService
  random(maximum: number): number
  captures: LiveCaptureReads
  staged: { begun: Extract<SceneGeometryBeginResult, { kind: 'READY' }>; saveId: string }
  movement: LiveSessionMovementCaptureScope | null
}): Promise<PreparedStagedSceneCommit> {
  const { actor, command, context, captures } = input
  const { scene } = context
  const stage = input.staged
  const { begun, saveId } = stage
  if (begun.header.id !== scene.id || begun.header.version !== scene.version)
    throw new LiveSessionRouteError(409)
  const staged = begun.input
  const target = geometryTarget(staged)
  const baseOrdinal =
    target.collection === 'tokens'
      ? (context.baseOrdinals.tokens.find((entry) => entry.tokenId === target.entityId)
          ?.baseOrdinal ?? null)
      : (context.baseOrdinals.barriers.find((entry) => entry.barrierId === target.entityId)
          ?.baseOrdinal ?? null)
  let movement: {
    prepareInput: LiveSessionMovementPrepareInput
    planned: Awaited<ReturnType<typeof prepareNativeLiveMovement>>
  } | null = null
  if (staged.type === 'MOVE_SCENE_TOKEN' && staged.expectedEncounterVersion !== null) {
    const capture = input.movement
    if (
      !begun.encounterId ||
      !capture ||
      capture.encounterId !== begun.encounterId ||
      capture.saveId !== saveId ||
      capture.baseTokenOrdinal !== baseOrdinal
    )
      throw new LiveSessionRouteError(409)
    const scope = {
      ...actor,
      encounterId: begun.encounterId,
      expectedVersion: staged.expectedEncounterVersion,
      movement: capture
    }
    // A decision continues its issued occurrence; a new move opens one.
    const decision =
      command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE'
    const occurrenceId = decision ? command.occurrenceId.toLowerCase() : crypto.randomUUID()
    const occurredAt = new Date().toISOString()
    const planned = await prepareNativeLiveMovement({
      scope,
      scene,
      occurrenceId,
      occurredAt,
      runtime: input.runtime,
      random: input.random,
      captures
    })
    // Each dragged token moves by the mover's published displacement (D105).
    const moverToken = scene.tokens.find(({ id }) => id === staged.tokenId)
    const moverDelta = preparedMoverSceneDelta({
      tokenId: staged.tokenId,
      path: staged.path,
      outcome: planned.outcome,
      sceneVersion: scene.version
    })
    const offset =
      moverToken && moverDelta
        ? {
            x: moverDelta.position.x - moverToken.position.x,
            y: moverDelta.position.y - moverToken.position.y
          }
        : null
    const draggedTokens =
      planned.drag && offset && (offset.x !== 0 || offset.y !== 0)
        ? planned.drag.tokens.map(({ tokenId }) => {
            const from = scene.tokens.find(({ id }) => id === tokenId)!.position
            return { tokenId, from, to: { x: from.x + offset.x, y: from.y + offset.y } }
          })
        : []
    const prepareInput: LiveSessionMovementPrepareInput = {
      ...actor,
      movement: scope.movement,
      preparation: {
        encounterId: begun.encounterId,
        expectedEncounterVersion: staged.expectedEncounterVersion,
        occurrenceId,
        occurredAt,
        ...(draggedTokens.length ? { draggedTokens } : {}),
        outcome: planned.outcome
      },
      revisions: planned.revisions(),
      maintenanceOwners: planned.dependencies.flatMap(({ request }) =>
        request.kind === 'MAINTENANCE_OWNER' ? [request] : []
      )
    }
    movement = { prepareInput, planned }
  }
  const outcome = movement?.prepareInput.preparation.outcome ?? null
  const draggedTokens = movement?.prepareInput.preparation.draggedTokens

  // Exploration follows each walked segment; the published delta is what Convex will write.
  let explorations: { delta: typeof target.delta; path: ScenePoint[] | null }[]
  let publishedDelta: ReturnType<typeof preparedMovementSceneDelta> | typeof target.delta
  // The walked segment's cost becomes a bound actor's turn movement (D38).
  let movementCost: number | undefined
  if (staged.type === 'MOVE_SCENE_TOKEN') {
    const walk = {
      path: staged.path,
      startDistance: begun.movementStartDistance ?? 0,
      outcome
    }
    const segment = preparedMovementSegment(walk)
    // A dragged token walks the mover's segment from its own place.
    const start = segment.path[0]!
    explorations = [
      { tokenId: staged.tokenId, from: start, to: segment.position },
      ...(draggedTokens ?? [])
    ].map(({ tokenId, from, to }) => ({
      delta: { kind: 'TOKEN_MOVED' as const, tokenId, position: to },
      path: segment.path.map((point) => ({
        x: point.x + from.x - start.x,
        y: point.y + from.y - start.y
      }))
    }))
    const moverActorId = movement?.planned.actorIdByTokenId.get(staged.tokenId)
    movementCost = preparedMovementCost({
      ...walk,
      grid: scene.grid,
      scene,
      mover: movement
        ? {
            tokenId: staged.tokenId,
            actorId: moverActorId!,
            tokens: scene.tokens,
            effects: toSpatialInstances(movement.planned.spatialEffects, movement.planned.actors),
            carefully: staged.carefully === true,
            dragDoublesCost:
              draggedTokens !== undefined && movement.planned.drag?.doublesCost === true,
            passage: {
              costMultiplier: encounterMovementPassageFacts(movement.planned.targets, moverActorId)
                .mover.costMultiplier,
              creatureTokenIds: [...movement.planned.actorIdByTokenId.keys()].filter(
                (id) => id !== staged.tokenId
              )
            }
          }
        : undefined
    })
    publishedDelta = preparedMovementSceneDelta({
      tokenId: staged.tokenId,
      path: staged.path,
      outcome,
      sceneVersion: scene.version,
      facingDegrees: staged.facingDegrees,
      draggedTokens
    })
  } else {
    explorations = [{ delta: target.delta, path: null }]
    publishedDelta = target.delta
  }
  const explored = explorations.reduce(
    (state, { delta }) => applySceneGeometryDelta(state, delta),
    scene
  )
  // Each owner's layer accumulates what every moved token explored.
  const layerByOwner = new Map<string | null, SceneFogLayer>()
  for (const { delta, path } of explorations) {
    // Fog owners include a Character's grantees, though the stored Scene lists only the GM's controllers (D162).
    const plan = planSceneCommandExploration(
      withCharacterControllers(scene, input.assignments),
      withCharacterControllers(explored, input.assignments),
      delta
    )
    for (const ownerUserId of plan.owners) {
      const layer = deriveSceneCommandFogLayer(plan, {
        ownerUserId,
        existing:
          layerByOwner.get(ownerUserId) ??
          scene.fogLayers.find((candidate) => candidate.ownerUserId === ownerUserId) ??
          null,
        ...(path !== null && delta.kind === 'TOKEN_MOVED'
          ? { movement: { tokenId: delta.tokenId, path } }
          : {})
      })
      if (layer) layerByOwner.set(ownerUserId, layer)
    }
  }
  const layers = [...layerByOwner.values()]

  const version = publishedDelta || layers.length ? scene.version + 1 : scene.version
  const moved = publishedDelta ? applySceneDelta(scene, publishedDelta, version) : scene
  const staleOwners = new Set(layers.map((layer) => layer.ownerUserId))
  const nextScene: CampaignSceneStateDto = {
    ...moved,
    version,
    fogLayers: [
      ...moved.fogLayers.filter((layer) => !staleOwners.has(layer.ownerUserId)),
      ...layers
    ]
  }
  if (
    nextScene.tokens.length > VTT_SCENE_LIMITS.tokens ||
    nextScene.barriers.length > VTT_SCENE_LIMITS.barriers
  )
    throw new RoomSceneCommandRefusal(
      'INVALID_COMMAND',
      'Scene geometry exceeds the supported entity count.'
    )
  const expectedScene = { sceneId: scene.id, version, delta: publishedDelta }
  const finish = { saveId, baseOrdinal }
  if (!movement)
    return {
      kind: 'GEOMETRY',
      saveId,
      expectedScene,
      nextScene,
      fogChanged: layers.length > 0,
      finish,
      fogLayers: layers
    }
  return {
    kind: 'MOVEMENT',
    saveId,
    expectedScene,
    nextScene,
    fogChanged: layers.length > 0,
    commit: {
      ...movement.prepareInput,
      finish: {
        ...finish,
        tokenOrdinals: context.baseOrdinals.tokens,
        movementCost,
        ...(movement.planned.teleportCastCommandId
          ? { teleportCastCommandId: movement.planned.teleportCastCommandId }
          : {})
      },
      rules: movement.planned.rules,
      settlements: movement.planned.settlementInputs,
      fogLayers: layers,
      ...(command.type === 'VOID_RULE_OCCURRENCE' ? { voidCommand: command } : {})
    },
    concealmentPrunes: await planConcealmentPrune(movement.planned, nextScene)
  }
}
