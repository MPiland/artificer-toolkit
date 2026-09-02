import {
  createSpatialRuleEffectRepository,
  createVttSceneRepository,
  type DBLike,
  type EncounterRecord,
  type EncounterSpatialRuleEffectRecord
} from '@artificer-toolkit/db'
import {
  canTokenFootprintMoveBetween,
  collectSpatialMovementCandidates,
  deriveSquareGridShoveAsideDestinations,
  enumerateSquareGridFootprint,
  lengthMeasurementInSceneUnits,
  measureSceneDistance,
  SceneBarrierIndex,
  type CampaignSceneState,
  type SceneGrid,
  type ScenePoint,
  type SceneToken,
  type SpatialEffectInstance
} from '@artificer-toolkit/shared/vtt'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterRuleActionSpatialDirective } from '../rules/characterRuleActionSystemAdapter.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import type { LockedEncounterActionSceneContext } from './encounterActionSceneContext.js'
import { commitSpatialSceneMovement, type LiveSceneCommandContext } from './vttSceneService.js'

const BINARY_SEARCH_ITERATIONS = 32
const MINIMUM_MOVEMENT_DISTANCE = 1e-6
const DIRECTIVE_PROVENANCE_MAX_LENGTH = 240

function hasBoundedDirectiveProvenance(value: string | null): value is string {
  return (
    value !== null && value.trim().length > 0 && value.length <= DIRECTIVE_PROVENANCE_MAX_LENGTH
  )
}

function pointAt(from: ScenePoint, to: ScenePoint, progress: number): ScenePoint {
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress }
}

function tokenAt(token: SceneToken, position: ScenePoint): SceneToken {
  return { ...token, position }
}

function rectanglesOverlap(left: SceneToken, right: SceneToken): boolean {
  const leftHalfWidth = left.width / 2
  const leftHalfHeight = left.height / 2
  const rightHalfWidth = right.width / 2
  const rightHalfHeight = right.height / 2
  return (
    Math.abs(left.position.x - right.position.x) < leftHalfWidth + rightHalfWidth &&
    Math.abs(left.position.y - right.position.y) < leftHalfHeight + rightHalfHeight
  )
}

function pathIsLegal(input: {
  state: Pick<CampaignSceneState, 'barriers' | 'doorStates' | 'map'>
  token: SceneToken
  from: ScenePoint
  to: ScenePoint
  index: SceneBarrierIndex
}): boolean {
  const halfWidth = input.token.width / 2
  const halfHeight = input.token.height / 2
  if (
    input.to.x - halfWidth < 0 ||
    input.to.y - halfHeight < 0 ||
    input.to.x + halfWidth > input.state.map.width ||
    input.to.y + halfHeight > input.state.map.height
  )
    return false
  return canTokenFootprintMoveBetween(input.state, input.from, input.to, input.token, input.index)
}

/**
 * Computes the one deterministic pull path used by the current forced-movement
 * action seam. It intentionally knows no effects, actors, or receipts.
 */
export function planTowardSourceForcedMovement(input: {
  state: Pick<CampaignSceneState, 'barriers' | 'doorStates' | 'map'>
  grid: SceneGrid
  sourceToken: SceneToken
  targetToken: SceneToken
  distance: number
}): readonly ScenePoint[] {
  if (!Number.isFinite(input.distance) || input.distance <= 0)
    throw new EncounterValidationError('Forced movement distance is invalid.')
  const start = input.targetToken.position
  const dx = input.sourceToken.position.x - start.x
  const dy = input.sourceToken.position.y - start.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return [start]
  const sourcePosition = input.sourceToken.position
  const maximumRangeProgress = (() => {
    if (input.grid.kind === 'GRIDLESS')
      return Math.min(1, (input.distance * input.grid.pixelsPerUnit) / length)
    let low = 0
    let high = 1
    for (let iteration = 0; iteration < BINARY_SEARCH_ITERATIONS; iteration += 1) {
      const middle = (low + high) / 2
      if (
        measureSceneDistance(input.grid, start, pointAt(start, sourcePosition, middle)) <=
        input.distance
      )
        low = middle
      else high = middle
    }
    return low
  })()
  const requestedEnd = pointAt(start, sourcePosition, maximumRangeProgress)
  const index = new SceneBarrierIndex(input.state.barriers)
  const legal = (progress: number) => {
    const position = pointAt(start, requestedEnd, progress)
    return (
      !rectanglesOverlap(tokenAt(input.targetToken, position), input.sourceToken) &&
      pathIsLegal({
        state: input.state,
        token: input.targetToken,
        from: start,
        to: position,
        index
      })
    )
  }
  if (legal(1)) return [start, requestedEnd]
  if (!legal(0)) return [start]
  let low = 0
  let high = 1
  for (let iteration = 0; iteration < BINARY_SEARCH_ITERATIONS; iteration += 1) {
    const middle = (low + high) / 2
    if (legal(middle)) low = middle
    else high = middle
  }
  const end = pointAt(start, requestedEnd, low)
  return Math.hypot(end.x - start.x, end.y - start.y) <= MINIMUM_MOVEMENT_DISTANCE
    ? [start]
    : [start, end]
}

function typedSceneLength(amount: number, unit: string) {
  switch (unit) {
    case 'INCHES':
    case 'FEET':
    case 'YARDS':
    case 'MILES':
      return { amount, unit }
    default:
      throw new EncounterValidationError('Forced movement distance unit is unsupported.')
  }
}

function requireSupportedDirective(input: {
  directive: CharacterRuleActionSpatialDirective
  targetActorId: string
  targetStateChecksum: string
}): Extract<CharacterRuleActionSpatialDirective, { kind: 'FORCED_MOVEMENT' }> {
  const { directive } = input
  if (
    directive.kind !== 'FORCED_MOVEMENT' ||
    directive.targetActorId !== input.targetActorId ||
    directive.targetStateChecksum !== input.targetStateChecksum ||
    directive.direction !== 'TOWARD_SOURCE' ||
    directive.distanceMode !== 'FIXED_DISTANCE' ||
    directive.amount === null ||
    directive.amount <= 0 ||
    directive.unit === null ||
    directive.actionEconomy !== 'NONE' ||
    !hasBoundedDirectiveProvenance(directive.sourceNodeId) ||
    !hasBoundedDirectiveProvenance(directive.sourceOperationKey) ||
    !hasBoundedDirectiveProvenance(directive.authoredPath) ||
    !hasBoundedDirectiveProvenance(directive.resolvedPath)
  ) {
    throw new EncounterValidationError(
      'The completed action has an unsupported forced movement directive.'
    )
  }
  return directive
}

function spatialInstances(
  effects: readonly EncounterSpatialRuleEffectRecord[]
): readonly SpatialEffectInstance[] {
  return effects.map((effect) => ({
    effectId: effect.id,
    sourceActorId:
      effect.definition.origin.kind === 'ENCOUNTER'
        ? (effect.definition.origin.sourceActorId ?? null)
        : null,
    sourceTokenId: effect.placement.sourceTokenId,
    anchorKind: effect.placement.anchorKind,
    geometry: effect.placement.geometry,
    triggerModes: effect.placement.triggerModes,
    movementKinds: effect.placement.movementKinds
  }))
}

/** Applies one sealed direct-action spatial directive within the root action transaction. */
export async function settleEncounterActionForcedMovement(input: {
  db: DBLike
  encounter: EncounterRecord
  sceneContext: LockedEncounterActionSceneContext | null
  actorUserId: string
  commandId: string
  commandFingerprint: string
  sourceActorId: string
  targetActorId: string
  targetStateChecksum: string
  directives: readonly CharacterRuleActionSpatialDirective[]
  liveSessionAuthority?: { authorityId: string; sessionId: string }
}): Promise<void> {
  if (input.directives.length === 0) return
  if (input.directives.length !== 1)
    throw new EncounterValidationError('A direct action may produce at most one spatial directive.')
  const directive = requireSupportedDirective({
    directive: input.directives[0]!,
    targetActorId: input.targetActorId,
    targetStateChecksum: input.targetStateChecksum
  })
  if (!input.sceneContext)
    throw new EncounterConflictError('Forced movement requires the locked action Scene context.')
  const scene = input.sceneContext.scene
  if (!scene)
    throw new EncounterConflictError('Forced movement requires the locked live Scene record.')
  if (
    scene.state.id !== input.sceneContext.sceneId ||
    scene.state.version !== input.sceneContext.sceneVersion
  )
    throw new EncounterConflictError('Forced movement Scene context is stale.')
  const source = scene.state.tokens.find(
    (token) => token.id === input.sceneContext!.sourceToken.tokenId
  )
  const target = scene.state.tokens.find(
    (token) => token.id === input.sceneContext!.targetToken.tokenId
  )
  if (!source || !target) throw new EncounterConflictError('Forced movement tokens are stale.')
  const distance = lengthMeasurementInSceneUnits(
    typedSceneLength(directive.amount!, directive.unit!),
    input.sceneContext.grid
  )
  if (distance === null || distance <= 0)
    throw new EncounterValidationError(
      'Forced movement distance cannot be converted for this Scene.'
    )
  const path = planTowardSourceForcedMovement({
    state: scene.state,
    grid: input.sceneContext.grid,
    sourceToken: source,
    targetToken: target,
    distance
  })
  const repository = createVttSceneRepository(input.db)
  const bindings = await repository.listActorTokenBindings(input.encounter.id)
  const actorIdByTokenId = new Map(bindings.map((binding) => [binding.tokenId, binding.actorId]))
  if (
    actorIdByTokenId.get(source.id) !== input.sourceActorId ||
    actorIdByTokenId.get(target.id) !== input.targetActorId
  ) {
    throw new EncounterConflictError('Forced movement actor token bindings are stale.')
  }
  const spatialScope = await createSpatialRuleEffectRepository(input.db).lockScope({
    encounterId: input.encounter.id,
    sceneId: scene.state.id
  })
  if (!spatialScope) throw new EncounterConflictError('Forced movement spatial scope is stale.')
  const candidates = collectSpatialMovementCandidates({
    actorIdByTokenId,
    effects: spatialInstances(await spatialScope.snapshot()),
    movementKind: 'FORCED',
    path,
    tokens: scene.state.tokens,
    movingTokenId: target.id
  })
  if (candidates.length > 0)
    throw new EncounterConflictError(
      'Action-originated forced movement intersects a configured spatial rule effect.'
    )
  const end = path.at(-1)!
  await commitSpatialSceneMovement({
    repository,
    scene,
    encounterId: input.encounter.id,
    actorUserId: input.actorUserId,
    commandId: input.commandId,
    commandType: 'RESOLVE_ACTION',
    commandFingerprint: input.commandFingerprint,
    tokenId: target.id,
    path,
    startDistance: 0,
    endDistance: Math.hypot(end.x - path[0]!.x, end.y - path[0]!.y),
    endPosition: end,
    ...(input.liveSessionAuthority
      ? {
          liveSceneContext: {
            authorityId: input.liveSessionAuthority.authorityId,
            campaignId: input.encounter.campaignId,
            sessionId: input.liveSessionAuthority.sessionId
          } satisfies LiveSceneCommandContext
        }
      : {})
  })
}

export function shoveAsideSceneStateChecksum(input: {
  destination: ScenePoint
  displacement: { amount: 5; unit: 'FEET'; sceneUnits: number }
  scene: CampaignSceneState
  sourceToken: SceneToken
  targetToken: SceneToken
}): string {
  return checksumRuleDocument({
    destination: input.destination,
    displacement: input.displacement,
    sceneId: input.scene.id,
    sceneVersion: input.scene.version,
    sourceToken: {
      height: input.sourceToken.height,
      id: input.sourceToken.id,
      position: input.sourceToken.position,
      width: input.sourceToken.width
    },
    targetToken: {
      height: input.targetToken.height,
      id: input.targetToken.id,
      position: input.targetToken.position,
      width: input.targetToken.width
    }
  })
}

/** Applies the exact sealed Shove Aside destination; it never reselects a destination. */
export async function settleEncounterShoveAsideMovement(input: {
  actorUserId: string
  commandFingerprint: string
  commandId: string
  db: DBLike
  encounter: EncounterRecord
  liveSessionAuthority?: { authorityId: string; sessionId: string }
  sceneContext: LockedEncounterActionSceneContext
  sourceActorId: string
  stateChecksum: string
  targetActorId: string
  destination: ScenePoint
  displacement: { amount: 5; unit: 'FEET'; sceneUnits: number }
}): Promise<void> {
  const scene = input.sceneContext.scene
  if (
    !scene ||
    scene.state.id !== input.sceneContext.sceneId ||
    scene.state.version !== input.sceneContext.sceneVersion
  ) {
    throw new EncounterConflictError('Shove Aside Scene context is stale.')
  }
  const source = scene.state.tokens.find(
    (token) => token.id === input.sceneContext.sourceToken.tokenId
  )
  const target = scene.state.tokens.find(
    (token) => token.id === input.sceneContext.targetToken.tokenId
  )
  if (!source || !target) throw new EncounterConflictError('Shove Aside tokens are stale.')
  if (
    input.displacement.amount !== 5 ||
    input.displacement.unit !== 'FEET' ||
    !Number.isFinite(input.displacement.sceneUnits) ||
    input.displacement.sceneUnits <= 0
  ) {
    throw new EncounterConflictError('Shove Aside displacement evidence is stale.')
  }
  let currentDisplacement: number | null
  try {
    currentDisplacement = lengthMeasurementInSceneUnits(
      { amount: input.displacement.amount, unit: input.displacement.unit },
      input.sceneContext.grid
    )
  } catch {
    throw new EncounterConflictError('Shove Aside displacement cannot be converted for this Scene.')
  }
  if (
    currentDisplacement === null ||
    Math.abs(currentDisplacement - input.displacement.sceneUnits) > Number.EPSILON
  ) {
    throw new EncounterConflictError('Shove Aside displacement is no longer current.')
  }
  if (
    shoveAsideSceneStateChecksum({
      destination: input.destination,
      displacement: input.displacement,
      scene: scene.state,
      sourceToken: source,
      targetToken: target
    }) !== input.stateChecksum
  ) {
    throw new EncounterConflictError('Shove Aside destination state is stale.')
  }
  const sourceFootprint = enumerateSquareGridFootprint(input.sceneContext.grid, source)
  const targetFootprint = enumerateSquareGridFootprint(input.sceneContext.grid, target)
  if (!sourceFootprint || !targetFootprint)
    throw new EncounterConflictError('Shove Aside token geometry is stale.')
  const occupants = scene.state.tokens
    .filter((token) => token.id !== source.id && token.id !== target.id)
    .map((token) => {
      const footprint = enumerateSquareGridFootprint(input.sceneContext.grid, token)
      return footprint ? { footprint, tokenId: token.id } : null
    })
  if (occupants.some((occupant) => occupant === null))
    throw new EncounterConflictError('Shove Aside occupancy is stale.')
  const legal = deriveSquareGridShoveAsideDestinations({
    attacker: { footprint: sourceFootprint, tokenId: source.id },
    displacement: input.displacement.sceneUnits,
    occupants: occupants as { footprint: NonNullable<typeof sourceFootprint>; tokenId: string }[],
    state: { ...scene.state, grid: input.sceneContext.grid },
    target: { footprint: targetFootprint, tokenId: target.id }
  }).some(
    (candidate) =>
      candidate.position.x === input.destination.x && candidate.position.y === input.destination.y
  )
  if (!legal) throw new EncounterConflictError('Shove Aside destination is no longer legal.')
  const repository = createVttSceneRepository(input.db)
  const bindings = await repository.listActorTokenBindings(input.encounter.id)
  const actorIdByTokenId = new Map(bindings.map((binding) => [binding.tokenId, binding.actorId]))
  if (
    actorIdByTokenId.get(source.id) !== input.sourceActorId ||
    actorIdByTokenId.get(target.id) !== input.targetActorId
  ) {
    throw new EncounterConflictError('Shove Aside actor token bindings are stale.')
  }
  const spatialScope = await createSpatialRuleEffectRepository(input.db).lockScope({
    encounterId: input.encounter.id,
    sceneId: scene.state.id
  })
  if (!spatialScope) throw new EncounterConflictError('Shove Aside spatial scope is stale.')
  const candidates = collectSpatialMovementCandidates({
    actorIdByTokenId,
    effects: spatialInstances(await spatialScope.snapshot()),
    movementKind: 'FORCED',
    path: [target.position, input.destination],
    tokens: scene.state.tokens,
    movingTokenId: target.id
  })
  if (candidates.length > 0) {
    throw new EncounterConflictError(
      'Action-originated forced movement intersects a configured spatial rule effect.'
    )
  }
  await commitSpatialSceneMovement({
    repository,
    scene,
    encounterId: input.encounter.id,
    actorUserId: input.actorUserId,
    commandId: input.commandId,
    commandType: 'RESOLVE_OPTIONAL_COMBAT',
    commandFingerprint: input.commandFingerprint,
    tokenId: target.id,
    path: [target.position, input.destination],
    startDistance: 0,
    endDistance: Math.hypot(
      input.destination.x - target.position.x,
      input.destination.y - target.position.y
    ),
    endPosition: input.destination,
    ...(input.liveSessionAuthority
      ? {
          liveSceneContext: {
            authorityId: input.liveSessionAuthority.authorityId,
            campaignId: input.encounter.campaignId,
            sessionId: input.liveSessionAuthority.sessionId
          } satisfies LiveSceneCommandContext
        }
      : {})
  })
}
