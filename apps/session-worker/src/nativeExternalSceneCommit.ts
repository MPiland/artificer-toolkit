import type {
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  LiveSessionExpectedScene,
  LiveSessionExternalAuthority,
  LiveSessionMovementCommitInput,
  LiveSessionMovementCommitResponse,
  LiveSessionMovementPrepareInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { LiveSessionMovementStage } from '@artificer-toolkit/schema/api/liveSessionMovementStage'
import { liveSessionEncounterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionScenePublicationDto } from '@artificer-toolkit/schema/api/liveSessionState'
import type {
  SceneBaseOrdinals,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneSessionVisionComposition } from '@artificer-toolkit/schema/api/sceneSessionVision'
import type {
  CampaignSceneStateDto,
  SceneDoorStateCommandInputDto,
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
  type SceneAtomicDelta,
  type SceneFogLayer,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'

import {
  callLiveSessionRoute,
  LiveSessionRouteError,
  type NativeLiveSessionEnvironment
} from './liveSessionRoutes.js'
import {
  BUNDLED_MAINTENANCE_DEFINITION_IDS,
  bundleCaptures,
  LiveCaptureCache,
  type LiveCaptureReads
} from './nativeCaptureCache.js'
import { prepareNativeLiveMovement } from './nativeEncounterMovement.js'
import type { LiveEncounterActor } from './nativeRoomEncounterCommand.js'

/** A room command that commits to Convex first (D27): a Scene change or a movement decision. */
export type ExternalSceneCommand =
  | SceneTokenMovementCommandInputDto
  | SceneDoorStateCommandInputDto
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
      commit: Omit<LiveSessionMovementCommitInput, 'authority' | 'expectedScene'>
    }
  | {
      kind: 'GEOMETRY'
      finish: LiveSessionMovementCommitInput['finish']
      fogLayers: SceneFogLayer[]
    }
)

/**
 * Stages a Convex-first command in one private call (D52): Convex routes a decision, begins and
 * observes the save with the room's Scene vision, and reads a bound move's capture bundle.
 */
export function stageExternalSceneCommand(input: {
  environment: NativeLiveSessionEnvironment
  accessToken: string
  actor: LiveEncounterActor
  command: ExternalSceneCommand
  context: ExternalSceneContext
  /** The command's capture view; the same view must later take the stage's bundle. */
  captures?: LiveCaptureReads
}): Promise<LiveSessionMovementStage> {
  const { command, context } = input
  const decision =
    command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE'
  return callLiveSessionRoute(input.environment, input.accessToken, 'encounterMovementStage', {
    ...input.actor,
    command,
    ...(decision ? {} : { presentation: context.presentation }),
    characterRevisions: context.characterRevisions,
    tokenOrdinals: context.baseOrdinals.tokens,
    maintenanceDefinitionIds: BUNDLED_MAINTENANCE_DEFINITION_IDS,
    cachedSystem: input.captures?.systemStamp() ?? null
  })
}

/**
 * Plans a Convex-first command up to its commit from its stage (`staged` when the room already
 * staged a held decision): any Encounter rules run in the DO on the stage's capture bundle, each fog
 * owner's complete layer is derived, and the published Scene is predicted. The commit freezes the
 * plan and stages the fog in its own transaction; nothing here changes gameplay or authority.
 */
export async function prepareExternalSceneCommit(input: {
  environment: NativeLiveSessionEnvironment
  accessToken: string
  actor: LiveEncounterActor
  command: ExternalSceneCommand
  context: ExternalSceneContext
  runtime: RulesRuntimeService
  random(maximum: number): number
  captures?: LiveCaptureReads
  staged?: LiveSessionMovementStage
}): Promise<PreparedExternalSceneCommit> {
  const { environment, accessToken, actor, command, context } = input
  const { scene } = context
  // Without the room's cache, one view both stages and takes the bundle.
  const captures = input.captures ?? new LiveCaptureCache().reads()
  const stage = input.staged ?? (await stageExternalSceneCommand({ ...input, captures }))
  // Convex holds a published command the room has no receipt for (its ID was already used), or
  // the decision is no longer a movement decision.
  if (stage.kind !== 'STAGED') throw new LiveSessionRouteError(409)
  const { begun, saveId } = stage
  if (begun.header.id !== scene.id || begun.header.version !== scene.version)
    throw new LiveSessionRouteError(409)
  const staged = begun.input
  const baseOrdinal =
    staged.type === 'MOVE_SCENE_TOKEN'
      ? (context.baseOrdinals.tokens.find((entry) => entry.tokenId === staged.tokenId)
          ?.baseOrdinal ?? null)
      : staged.type === 'SET_SCENE_DOOR_STATE'
        ? (context.baseOrdinals.barriers.find((entry) => entry.barrierId === staged.barrierId)
            ?.baseOrdinal ?? null)
        : null
  let movement: {
    prepareInput: LiveSessionMovementPrepareInput
    planned: Awaited<ReturnType<typeof prepareNativeLiveMovement>>
  } | null = null
  if (staged.type === 'MOVE_SCENE_TOKEN' && staged.expectedEncounterVersion !== null) {
    const capture = stage.capture
    if (
      !begun.encounterId ||
      !capture ||
      capture.movement.encounterId !== begun.encounterId ||
      capture.movement.saveId !== saveId ||
      capture.movement.baseTokenOrdinal !== baseOrdinal
    )
      throw new LiveSessionRouteError(409)
    const scope = {
      ...actor,
      encounterId: begun.encounterId,
      expectedVersion: staged.expectedEncounterVersion,
      movement: capture.movement
    }
    bundleCaptures(
      liveSessionEncounterRulesInputSchema.parse({
        ...scope,
        request: { kind: 'MOVEMENT_INPUTS' }
      }),
      capture.bundle,
      captures
    )
    // A decision continues its issued occurrence; a new move opens one.
    const decision =
      command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE'
    const occurrenceId = decision ? command.occurrenceId.toLowerCase() : crypto.randomUUID()
    const occurredAt = new Date().toISOString()
    const planned = await prepareNativeLiveMovement({
      environment,
      accessToken,
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
  let explorationDelta: Extract<SceneAtomicDelta, { kind: 'TOKEN_MOVED' | 'DOOR_STATE_SET' }>
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
  } else if (staged.type === 'SET_SCENE_DOOR_STATE') {
    explorationDelta = { kind: 'DOOR_STATE_SET', barrierId: staged.barrierId, state: staged.state }
    publishedDelta = explorationDelta
  } else throw new LiveSessionRouteError(409)
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

/** Commits a staged command; Convex advances the room's authority to `authority.sequence` with it. */
export async function commitExternalSceneCommit(input: {
  environment: NativeLiveSessionEnvironment
  accessToken: string
  actor: LiveEncounterActor
  prepared: PreparedExternalSceneCommit
  authority: LiveSessionExternalAuthority
}): Promise<{
  scene: SceneGeometryCommandResult
  encounter: LiveSessionMovementCommitResponse['encounter']
}> {
  const { environment, accessToken, prepared, authority } = input
  if (prepared.kind === 'MOVEMENT')
    return callLiveSessionRoute(environment, accessToken, 'encounterMovementCommit', {
      ...prepared.commit,
      authority,
      expectedScene: prepared.expectedScene
    })
  return {
    scene: await callLiveSessionRoute(environment, accessToken, 'sceneGeometryCommit', {
      ...input.actor,
      finish: prepared.finish,
      fogLayers: prepared.fogLayers,
      authority,
      expectedScene: prepared.expectedScene
    }),
    encounter: null
  }
}
