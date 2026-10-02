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
  preparedMovementSegment
} from '@artificer-toolkit/rules-runtime/encounterMovementPublication'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
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

import { LiveSessionRouteError } from './liveSessionRoutes.js'
import { RoomSceneCommandRefusal } from './roomSceneEdits.js'
import type { LiveCaptureReads } from './nativeCaptureCache.js'
import { prepareNativeLiveMovement } from './nativeEncounterMovement.js'
import type { LiveEncounterActor } from './nativeRoomEncounterCommand.js'

/**
 * A room command that stages a Scene save first: a token move, door change, token or barrier edit,
 * or a movement decision.
 */
export type ExternalSceneCommand =
  | SceneTokenMovementCommandInputDto
  | SceneGeometryCommandInputDto
  | ResolveRuleOccurrenceInputDto
  | VoidRuleOccurrenceInputDto

/** The room's synchronized Scene the command is planned against, never filtered for a member. */
export interface ExternalSceneContext {
  scene: CampaignSceneStateDto
  baseOrdinals: SceneBaseOrdinals
  characterRevisions: SceneSessionVisionComposition['characterRevisions']
  presentation: LiveSessionScenePublicationDto['presentation']
}

export type PreparedExternalSceneCommit = {
  saveId: string
  expectedScene: LiveSessionExpectedScene
  nextScene: CampaignSceneStateDto
  fogChanged: boolean
} & (
  | {
      kind: 'MOVEMENT'
      commit: Omit<LiveSessionMovementCommitInput, 'expectedScene'>
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
  command: ExternalSceneCommand
  context: ExternalSceneContext
  runtime: RulesRuntimeService
  random(maximum: number): number
  captures: LiveCaptureReads
  staged: { begun: Extract<SceneGeometryBeginResult, { kind: 'READY' }>; saveId: string }
  movement: LiveSessionMovementCaptureScope | null
}): Promise<PreparedExternalSceneCommit> {
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
    const prepareInput: LiveSessionMovementPrepareInput = {
      ...actor,
      movement: scope.movement,
      preparation: {
        encounterId: begun.encounterId,
        expectedEncounterVersion: staged.expectedEncounterVersion,
        occurrenceId,
        occurredAt,
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

  // Exploration follows the walked segment; the published delta is what Convex will write.
  let explorationDelta: typeof target.delta
  let publishedDelta: typeof explorationDelta | null
  let explorationPath: ScenePoint[] | null = null
  // The walked segment's cost becomes a bound actor's turn movement (D38).
  let movementCost: number | undefined
  if (staged.type === 'MOVE_SCENE_TOKEN') {
    const walk = {
      path: staged.path,
      startDistance: begun.movementStartDistance ?? 0,
      outcome
    }
    const segment = preparedMovementSegment(walk)
    explorationDelta = { kind: 'TOKEN_MOVED', tokenId: staged.tokenId, position: segment.position }
    explorationPath = segment.path
    movementCost = preparedMovementCost({ ...walk, grid: scene.grid, scene })
    publishedDelta = preparedMovementSceneDelta({
      tokenId: staged.tokenId,
      path: staged.path,
      outcome,
      sceneVersion: scene.version
    })
  } else {
    explorationDelta = target.delta
    publishedDelta = explorationDelta
  }
  const plan = planSceneCommandExploration(
    scene,
    applySceneGeometryDelta(scene, explorationDelta),
    explorationDelta
  )
  const layers: SceneFogLayer[] = []
  for (const ownerUserId of plan.owners) {
    const layer = deriveSceneCommandFogLayer(plan, {
      ownerUserId,
      existing: scene.fogLayers.find((candidate) => candidate.ownerUserId === ownerUserId) ?? null,
      ...(explorationPath !== null && explorationDelta.kind === 'TOKEN_MOVED'
        ? { movement: { tokenId: explorationDelta.tokenId, path: explorationPath } }
        : {})
    })
    if (layer) layers.push(layer)
  }

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
      finish: { ...finish, tokenOrdinals: context.baseOrdinals.tokens, movementCost },
      rules: movement.planned.rules,
      settlements: movement.planned.settlementInputs,
      fogLayers: layers,
      ...(command.type === 'VOID_RULE_OCCURRENCE' ? { voidCommand: command } : {})
    }
  }
}
