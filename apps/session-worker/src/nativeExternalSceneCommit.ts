import {
  resolveRuleOccurrenceInputDtoSchema,
  type ResolveRuleOccurrenceInputDto,
  type VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  LiveSessionExpectedScene,
  LiveSessionExternalAuthority,
  LiveSessionMovementCommitInput,
  LiveSessionMovementCommitResponse,
  LiveSessionMovementPrepareInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { LiveSessionMovementStage } from '@artificer-toolkit/schema/api/liveSessionMovementStage'
import type {
  LiveSessionMovementAnswerInput,
  LiveSessionMovementPrefetch
} from '@artificer-toolkit/schema/api/liveSessionMovementAnswer'
import {
  movementDecisionSubject,
  type LiveSessionMovementCaptureScope
} from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import type { LiveSessionEncounterCaptureBundle } from '@artificer-toolkit/schema/api/liveSessionEncounterCaptureBundle'
import { liveSessionEncounterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionScenePublicationDto } from '@artificer-toolkit/schema/api/liveSessionState'
import type {
  SceneBaseOrdinals,
  SceneGeometryBeginResult,
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
import {
  movementResponseSceneCommand,
  readEncounterMovementPendingContext
} from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
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

/**
 * How the room holds a movement decision's answer before planning it: staged in Convex
 * (`encounter-movement-stage`), or planned on the bundle the room prefetched for the answering member
 * when the decision was issued (D64), which Convex stages in the answer's own commit.
 */
export type HeldMovementStage =
  | LiveSessionMovementStage
  | { kind: 'PREFETCHED'; prefetch: LiveSessionMovementPrefetch }

type AnswerPlan = LiveSessionMovementAnswerInput['plan']

export type PreparedExternalSceneCommit = {
  expectedScene: LiveSessionExpectedScene
  nextScene: CampaignSceneStateDto
  fogChanged: boolean
} & (
  | {
      kind: 'MOVEMENT'
      saveId: string
      commit: Omit<LiveSessionMovementCommitInput, 'authority' | 'expectedScene'>
    }
  | {
      kind: 'ANSWER'
      sceneId: string
      commandId: string
      answer: Omit<LiveSessionMovementAnswerInput, 'plan' | 'expiresAt'> & {
        plan: Omit<AnswerPlan, 'authority' | 'expectedScene'>
      }
    }
  | {
      kind: 'GEOMETRY'
      saveId: string
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
 * staged or prefetched a held decision): any Encounter rules run in the DO on the capture bundle,
 * each fog owner's complete layer is derived, and the published Scene is predicted. The commit
 * freezes the plan and stages the fog in its own transaction; nothing here changes gameplay or
 * authority. A decision's answer is the room's own command, or a GM void's decline as its stage
 * returned it (D64).
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
  staged?: HeldMovementStage
}): Promise<PreparedExternalSceneCommit> {
  const { environment, accessToken, actor, command, context } = input
  const { scene } = context
  // Without the room's cache, one view both stages and takes the bundle.
  const captures = input.captures ?? new LiveCaptureCache().reads()
  const stage = input.staged ?? (await stageExternalSceneCommand({ ...input, captures }))
  // Convex holds a published command the room has no receipt for (its ID was already used), or
  // the decision is no longer a movement decision.
  if (stage.kind === 'ROUTED' || stage.kind === 'REPLAY') throw new LiveSessionRouteError(409)
  const prefetched = stage.kind === 'PREFETCHED' ? stage.prefetch : null
  let staged: Extract<SceneGeometryBeginResult, { kind: 'READY' }>['input']
  let begun: {
    header: { id: string; version: number }
    encounterId: string | null
    startDistance: number
    saveId: string | null
    answer: ResolveRuleOccurrenceInputDto | null
    capture: {
      movement: LiveSessionMovementCaptureScope
      bundle: LiveSessionEncounterCaptureBundle
    } | null
  }
  if (stage.kind === 'PREFETCHED') {
    // A prefetched answer plans the move its decision continues; Convex stages it at commit.
    const { prefetch } = stage
    const [admitted] = prefetch.bundle.encounter
    if (
      command.type !== 'RESOLVE_RULE_OCCURRENCE' ||
      admitted?.response.kind !== 'MOVEMENT_INPUTS' ||
      admitted.response.subject.kind !== 'DECISION'
    )
      throw new LiveSessionRouteError(409)
    const answer = resolveRuleOccurrenceInputDtoSchema.parse(command)
    const { root } = readEncounterMovementPendingContext(admitted.response.subject.pendingSnapshot)
    staged = movementResponseSceneCommand(root, answer)
    begun = {
      header: admitted.response.header,
      encounterId: prefetch.movement.encounterId,
      startDistance: root.pathStartDistance,
      saveId: null,
      answer,
      capture: { movement: prefetch.movement, bundle: prefetch.bundle }
    }
  } else {
    staged = stage.begun.input
    begun = {
      header: stage.begun.header,
      encounterId: stage.begun.encounterId ?? null,
      startDistance: stage.begun.movementStartDistance ?? 0,
      saveId: stage.saveId,
      answer: stage.answer,
      capture: stage.capture
    }
  }
  if (begun.header.id !== scene.id || begun.header.version !== scene.version)
    throw new LiveSessionRouteError(409)
  const baseOrdinal =
    staged.type === 'MOVE_SCENE_TOKEN'
      ? (context.baseOrdinals.tokens.find((entry) => entry.tokenId === staged.tokenId)
          ?.baseOrdinal ?? null)
      : staged.type === 'SET_SCENE_DOOR_STATE'
        ? (context.baseOrdinals.barriers.find((entry) => entry.barrierId === staged.barrierId)
            ?.baseOrdinal ?? null)
        : null
  let movement: {
    scope: LiveSessionMovementCaptureScope
    preparation: LiveSessionMovementPrepareInput['preparation']
    planned: Awaited<ReturnType<typeof prepareNativeLiveMovement>>
  } | null = null
  if (staged.type === 'MOVE_SCENE_TOKEN' && staged.expectedEncounterVersion !== null) {
    const { capture, encounterId, answer } = begun
    // An answer reads under its issued decision, a new move under its staged save (D64).
    const subject = answer
      ? movementDecisionSubject(answer)
      : begun.saveId && { kind: 'SAVE' as const, saveId: begun.saveId }
    if (
      !encounterId ||
      !capture ||
      !subject ||
      capture.movement.encounterId !== encounterId ||
      capture.movement.baseTokenOrdinal !== baseOrdinal ||
      checksumCanonicalJson(capture.movement.subject) !== checksumCanonicalJson(subject)
    )
      throw new LiveSessionRouteError(409)
    const scope = {
      ...actor,
      encounterId,
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
    const occurrenceId = answer ? answer.occurrenceId.toLowerCase() : crypto.randomUUID()
    const occurredAt = new Date().toISOString()
    const planned = await prepareNativeLiveMovement({
      environment,
      accessToken,
      scope,
      scene,
      occurrenceId,
      occurredAt,
      answer,
      runtime: input.runtime,
      random: input.random,
      captures
    })
    movement = {
      scope: capture.movement,
      preparation: {
        encounterId,
        expectedEncounterVersion: staged.expectedEncounterVersion,
        occurrenceId,
        occurredAt,
        outcome: planned.outcome
      },
      planned
    }
  }
  const outcome = movement?.preparation.outcome ?? null

  // Exploration follows the walked segment; the published delta is what Convex will write.
  let explorationDelta: Extract<SceneAtomicDelta, { kind: 'TOKEN_MOVED' | 'DOOR_STATE_SET' }>
  let publishedDelta: typeof explorationDelta | null
  let explorationPath: ScenePoint[] | null = null
  // The walked segment's cost becomes a bound actor's turn movement (D38).
  let movementCost: number | undefined
  if (staged.type === 'MOVE_SCENE_TOKEN') {
    const walk = { path: staged.path, startDistance: begun.startDistance, outcome }
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
  const fogChanged = layers.length > 0
  if (!movement) {
    if (!begun.saveId) throw new LiveSessionRouteError(409)
    return {
      kind: 'GEOMETRY',
      saveId: begun.saveId,
      expectedScene,
      nextScene,
      fogChanged,
      finish: { saveId: begun.saveId, baseOrdinal },
      fogLayers: layers
    }
  }
  const { planned } = movement
  const planInput = {
    preparation: movement.preparation,
    revisions: planned.revisions(),
    maintenanceOwners: planned.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER' ? [request] : []
    ),
    finish: { baseOrdinal, tokenOrdinals: context.baseOrdinals.tokens, movementCost },
    rules: planned.rules,
    settlements: planned.settlementInputs,
    fogLayers: layers
  }
  if (prefetched && begun.answer)
    return {
      kind: 'ANSWER',
      sceneId: scene.id,
      commandId: begun.answer.commandId.toLowerCase(),
      expectedScene,
      nextScene,
      fogChanged,
      answer: {
        ...actor,
        command: begun.answer,
        characterRevisions: context.characterRevisions,
        prefetch: {
          movement: prefetched.movement,
          maintenanceDefinitionIds: BUNDLED_MAINTENANCE_DEFINITION_IDS,
          checksum: prefetched.checksum
        },
        plan: planInput
      }
    }
  if (!begun.saveId) throw new LiveSessionRouteError(409)
  const { saveId } = begun
  return {
    kind: 'MOVEMENT',
    saveId,
    expectedScene,
    nextScene,
    fogChanged,
    commit: {
      ...actor,
      ...planInput,
      movement: {
        encounterId: movement.scope.encounterId,
        baseTokenOrdinal: movement.scope.baseTokenOrdinal,
        subject: { kind: 'SAVE', saveId }
      },
      finish: { ...planInput.finish, saveId },
      ...(command.type === 'VOID_RULE_OCCURRENCE' ? { voidCommand: command } : {})
    }
  }
}
/**
 * Commits a prepared command; Convex advances the room's authority to `authority.sequence` with it.
 * A prefetched answer stages and commits in one call that Convex refuses after `expiresAt`.
 */
export async function commitExternalSceneCommit(input: {
  environment: NativeLiveSessionEnvironment
  accessToken: string
  actor: LiveEncounterActor
  prepared: PreparedExternalSceneCommit
  authority: LiveSessionExternalAuthority
  expiresAt: number
}): Promise<{
  scene: SceneGeometryCommandResult
  encounter: LiveSessionMovementCommitResponse['encounter']
}> {
  const { environment, accessToken, prepared, authority } = input
  if (prepared.kind === 'ANSWER')
    return callLiveSessionRoute(environment, accessToken, 'encounterMovementAnswer', {
      ...prepared.answer,
      plan: { ...prepared.answer.plan, authority, expectedScene: prepared.expectedScene },
      expiresAt: input.expiresAt
    })
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
