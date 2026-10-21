import type {
  ApplyEncounterForcedMovements,
  EncounterForcedMovementLanding
} from '@artificer-toolkit/encounter-persistence/actionCommitRecords'
import { readRunActors } from '@artificer-toolkit/encounter-persistence/documents'
import { readSpatialEffect } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import type { EncounterReadContext } from '@artificer-toolkit/encounter-persistence/store'
import { toSpatialInstances } from '@artificer-toolkit/rules-runtime/encounterSpatialCandidateExecution'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import type { LiveSessionForcedMovement } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '@artificer-toolkit/schema/shared/spatial'
import {
  collectSpatialMovementCandidates,
  convertSceneDistance,
  deriveSquareGridForcedMovementDestinations,
  feetInSceneUnit,
  measureSceneDistance,
  traceSquareGridForcedMovementRay,
  type CampaignSceneState,
  type ScenePoint,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'
import type { ForcedMovementPreview } from './nativeAreaPreparation.js'
import type { RoomTransaction } from './roomEncounterStore.js'
import { persistRoomSceneCommand } from './roomSceneCommandPersistence.js'
import { readRoomScene, readRoomSceneState } from './roomSceneRead.js'

const MISSING_TOKENS =
  "A forced movement needs the source's and target's tokens on the Encounter's Scene."

/** The Encounter's Scene and the token of each actor a forced movement moves or starts from. */
async function readForcedMovementTokens(
  ctx: EncounterReadContext,
  encounterId: string,
  sourceActorId: string,
  targetActorIds: readonly string[]
) {
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
    .unique()
  const tokenBindings = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', encounterId))
    .take(MAX_ENCOUNTER_ACTORS)
  const actorIdByTokenId = new Map(
    tokenBindings.map(({ tokenId, actorId }) => [tokenId, actorId] as const)
  )
  const tokenIdByActorId = new Map(
    tokenBindings.map(({ tokenId, actorId }) => [actorId, tokenId] as const)
  )
  const sourceTokenId = tokenIdByActorId.get(sourceActorId)
  if (!binding || !sourceTokenId || targetActorIds.some((id) => !tokenIdByActorId.has(id)))
    throw new Error(MISSING_TOKENS)
  return { sceneId: binding.sceneId, sourceTokenId, actorIdByTokenId, tokenIdByActorId }
}

const tokenOf = (scene: Pick<CampaignSceneState, 'tokens'>, tokenId: string) => {
  const token = scene.tokens.find(({ id }) => id.toLowerCase() === tokenId)
  if (!token) throw new Error(MISSING_TOKENS)
  return token
}

/**
 * The squares a forced movement may leave its target on, staying put first when that is legal, and
 * what stops it where it travels a straight line: its distance, an object, or the creature (by
 * token) in its way. A move that picks its square (aside, any) is stopped by nothing.
 */
function forcedMovementDestinations(
  scene: CampaignSceneState,
  source: SceneToken,
  token: SceneToken,
  movement: LiveSessionForcedMovement
) {
  const occupants = scene.tokens.filter(({ id }) => id !== token.id)
  const input = {
    distance: feetInSceneUnit(movement.feet, scene.grid.unit),
    upTo: movement.upTo,
    sourceReach:
      movement.sourceReachFeet === null
        ? null
        : feetInSceneUnit(movement.sourceReachFeet, scene.grid.unit),
    source,
    target: token,
    occupants,
    state: scene
  }
  if (movement.direction === 'RANDOM' && !movement.ray)
    throw new Error('A random forced movement needs the direction rolled for it.')
  const straight =
    movement.direction === 'RANDOM'
      ? { direction: 'RAY' as const, ray: movement.ray ?? undefined }
      : movement.direction === 'AWAY_FROM_SOURCE' || movement.direction === 'TOWARD_SOURCE'
        ? { direction: movement.direction }
        : null
  const destinations = deriveSquareGridForcedMovementDestinations({
    ...input,
    ...(straight ?? { direction: movement.direction as 'ASIDE' | 'ANY' })
  })
  if (!destinations?.length)
    throw new Error('A forced movement needs a square grid its tokens fill.')
  const traced = straight && traceSquareGridForcedMovementRay({ ...input, ...straight })
  return {
    destinations,
    occupants,
    end: traced?.reached.at(-1) ?? null,
    stop: traced?.stop ?? null
  }
}

/**
 * Lands each forced movement in turn on a copy of the Scene, the creature farthest from the source
 * first (ties by actor ID) so a nearer one never blocks it: on the square its source picked (D157),
 * which must still be legal, or on its one legal square (straight from the acting creature's token,
 * stopping before the first blocked square). It stops at the first creature with several legal
 * squares and no pick, and returns those squares as the pick its source owes next.
 */
function landForcedMovements(
  scene: CampaignSceneState,
  sourceTokenId: string,
  tokenIdByActorId: ReadonlyMap<string, string>,
  actorIdByTokenId: ReadonlyMap<string, string>,
  movements: readonly LiveSessionForcedMovement[]
) {
  const source = tokenOf(scene, sourceTokenId)
  const ordered = movements
    .map((movement) => {
      const tokenId = tokenIdByActorId.get(movement.targetActorId)!
      return {
        movement,
        tokenId,
        reach: measureSceneDistance(scene.grid, source.position, tokenOf(scene, tokenId).position)
      }
    })
    .sort(
      (left, right) =>
        right.reach - left.reach ||
        (left.movement.targetActorId < right.movement.targetActorId
          ? -1
          : left.movement.targetActorId > right.movement.targetActorId
            ? 1
            : 0)
    )
  const landings: {
    movement: LiveSessionForcedMovement
    tokenId: string
    destination: ScenePoint
    report: EncounterForcedMovementLanding
  }[] = []
  let landed = scene
  for (const { movement, tokenId } of ordered) {
    const token = tokenOf(landed, tokenId)
    const {
      destinations: legal,
      occupants,
      end,
      stop
    } = forcedMovementDestinations(landed, source, token, movement)
    const chosen = movement.position
    if (!chosen && legal.length > 1) {
      if (new Set(movements.map(({ targetActorId }) => targetActorId)).size !== movements.length)
        throw new Error('A creature moved more than one way with a choice is not supported yet.')
      return { landings, owed: { targetActorId: movement.targetActorId, positions: legal } }
    }
    const destination = chosen
      ? legal.find(({ x, y }) => x === chosen.x && y === chosen.y)
      : legal[0]
    if (!destination) throw new Error('The chosen forced-movement destination is no longer free.')
    // Only a move that ran its whole line reports what stopped it; a square its source picked short
    // of the line end was the source's choice.
    const blocked = end && destination.x === end.x && destination.y === end.y ? stop : null
    landings.push({
      movement,
      tokenId,
      destination,
      report: {
        targetActorId: movement.targetActorId,
        feet: convertSceneDistance(
          measureSceneDistance(landed.grid, token.position, destination),
          landed.grid.unit,
          'FEET'
        ),
        stoppedBy:
          blocked?.kind === 'OBJECT'
            ? 'OBJECT'
            : blocked?.kind === 'CREATURE'
              ? (actorIdByTokenId.get(occupants[blocked.occupantIndex]!.id) ?? 'OBJECT')
              : 'NONE',
        ray: movement.ray
      }
    })
    landed = {
      ...landed,
      tokens: landed.tokens.map((entry) =>
        entry.id === token.id ? { ...entry, position: destination } : entry
      )
    }
  }
  return { landings, owed: null }
}

/**
 * Where an action's forced movements land on the Encounter's Scene (D157): the pick they owe their
 * source next, with the farther creatures already on the squares picked for them (null when none is
 * owed), and the landings so far, in the order they land.
 */
export async function readRoomForcedMovementPick(input: {
  ctx: EncounterReadContext
  transaction: RoomTransaction
  encounterId: string
  sourceActorId: string
  movements: readonly LiveSessionForcedMovement[]
}): Promise<ForcedMovementPreview> {
  if (input.movements.length === 0) return { owed: null, landings: [] }
  const { sceneId, sourceTokenId, tokenIdByActorId, actorIdByTokenId } =
    await readForcedMovementTokens(
      input.ctx,
      input.encounterId,
      input.sourceActorId,
      input.movements.map(({ targetActorId }) => targetActorId)
    )
  const { scene } = await readRoomSceneState(input.transaction, sceneId)
  const { owed, landings } = landForcedMovements(
    scene,
    sourceTokenId,
    tokenIdByActorId,
    actorIdByTokenId,
    input.movements
  )
  return { owed, landings: landings.map(({ report }) => report) }
}

/**
 * Moves each creature an action moves on the Encounter's Scene, in the action's transaction (D139),
 * to where `landForcedMovements` lands it; every pick must already be made. Each move is a FORCED
 * Scene token move, so it provokes no reaction and spends no movement; its Scene command names the
 * action as its origin, so only the action's undo reverts it. A creature that does not move writes
 * no move.
 */
export async function applyRoomForcedMovements(input: {
  ctx: EncounterReadContext
  transaction: RoomTransaction
  userId: string
  movement: Parameters<ApplyEncounterForcedMovements>[0]
}): ReturnType<ApplyEncounterForcedMovements> {
  const { ctx, transaction } = input
  const { state, sourceActorId, commandId, movements } = input.movement
  const { sceneId, sourceTokenId, actorIdByTokenId, tokenIdByActorId } =
    await readForcedMovementTokens(
      ctx,
      state.id,
      sourceActorId,
      movements.map(({ targetActorId }) => targetActorId)
    )
  const sourceRecord = transaction.record('SCENE_CHECKPOINT_SOURCE', sceneId)
  if (!sourceRecord) throw new Error('Room Scene source is unavailable.')
  const { presentationVersion } = liveSessionCheckpointSceneSourceSchema.parse(
    JSON.parse(sourceRecord.json)
  )
  const effects = toSpatialInstances(
    (
      await ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_encounterId_sceneId_createdOrdinal_id', (q) =>
          q.eq('encounterId', state.id).eq('sceneId', sceneId)
        )
        .take(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
    ).map(readSpatialEffect),
    await readRunActors(ctx, state)
  )
  const { landings, owed } = landForcedMovements(
    (await readRoomSceneState(transaction, sceneId)).scene,
    sourceTokenId,
    tokenIdByActorId,
    actorIdByTokenId,
    movements
  )
  if (owed)
    throw new Error('A forced movement with several destinations needs its source to pick one.')
  const moves: Awaited<ReturnType<ApplyEncounterForcedMovements>>['moves'] = []
  for (const { tokenId, destination } of landings) {
    const { scene, baseOrdinals } = await readRoomSceneState(transaction, sceneId)
    const token = tokenOf(scene, tokenId)
    if (destination.x === token.position.x && destination.y === token.position.y) continue
    const path = [token.position, destination]
    if (
      collectSpatialMovementCandidates({
        actorIdByTokenId,
        effects,
        movementKind: 'FORCED',
        path,
        grid: scene.grid,
        tokens: scene.tokens,
        movingTokenId: token.id,
        zoneApplications: state.zoneApplications,
        turnSequence: state.turnSequence
      }).length
    )
      throw new Error('A forced movement through a Scene effect is not available yet.')
    const sceneCommandId = crypto.randomUUID()
    persistRoomSceneCommand({
      transaction,
      header: readRoomScene(transaction, sceneId).header,
      scene,
      baseOrdinals,
      command: {
        type: 'MOVE_SCENE_TOKEN',
        commandId: sceneCommandId,
        sceneId,
        expectedSceneVersion: scene.version,
        expectedEncounterVersion: null,
        correlationId: null,
        movementKind: 'FORCED',
        tokenId: token.id,
        path
      },
      actorUserId: input.userId,
      result: {
        commandId: sceneCommandId,
        delta: { kind: 'TOKEN_MOVED', tokenId: token.id, position: destination },
        occurrence: null,
        replayed: false,
        sceneId,
        version: scene.version + 1
      },
      presentationVersion,
      saveId: crypto.randomUUID(),
      now: Date.now(),
      actionOrigin: { encounterId: state.id, commandId }
    })
    moves.push({ sceneId, sceneCommandId })
  }
  return { moves, landings: landings.map(({ report }) => report) }
}
