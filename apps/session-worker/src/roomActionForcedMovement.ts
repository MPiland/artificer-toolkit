import type { ApplyEncounterForcedMovements } from '@artificer-toolkit/encounter-persistence/actionCommitRecords'
import { readSpatialEffect } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import type { EncounterReadContext } from '@artificer-toolkit/encounter-persistence/store'
import { toSpatialInstance } from '@artificer-toolkit/rules-runtime/encounterSpatialCandidateExecution'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '@artificer-toolkit/schema/shared/spatial'
import {
  collectSpatialMovementCandidates,
  deriveSquareGridForcedMovementDestination,
  feetInSceneUnit,
  measureSceneDistance
} from '@artificer-toolkit/shared/vtt'
import type { RoomTransaction } from './roomEncounterStore.js'
import { persistRoomSceneCommand } from './roomSceneCommandPersistence.js'
import { readRoomScene, readRoomSceneState } from './roomSceneRead.js'

const MISSING_TOKENS =
  "A forced movement needs the source's and target's tokens on the Encounter's Scene."

/**
 * Moves each creature an action pushes or pulls on the Encounter's Scene, in the action's
 * transaction (D139): straight from the acting creature's token, stopping before the first blocked
 * square, farthest creature first (ties by actor ID) so a nearer one never blocks it. Each move is a
 * FORCED Scene token move, so it provokes no reaction and spends no movement; its Scene command
 * names the action as its origin, so only the action's undo reverts it. A creature that cannot move
 * at all writes no move.
 */
export async function applyRoomForcedMovements(input: {
  ctx: EncounterReadContext
  transaction: RoomTransaction
  userId: string
  movement: Parameters<ApplyEncounterForcedMovements>[0]
}): ReturnType<ApplyEncounterForcedMovements> {
  const { ctx, transaction } = input
  const { state, sourceActorId, commandId, movements } = input.movement
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  const tokenBindings = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', state.id))
    .take(MAX_ENCOUNTER_ACTORS)
  const actorIdByTokenId = new Map(
    tokenBindings.map(({ tokenId, actorId }) => [tokenId, actorId] as const)
  )
  const tokenIdByActorId = new Map(
    tokenBindings.map(({ tokenId, actorId }) => [actorId, tokenId] as const)
  )
  const sourceTokenId = tokenIdByActorId.get(sourceActorId)
  if (
    !binding ||
    !sourceTokenId ||
    movements.some(({ targetActorId }) => !tokenIdByActorId.has(targetActorId))
  )
    throw new Error(MISSING_TOKENS)
  const { sceneId } = binding
  const sourceRecord = transaction.record('SCENE_CHECKPOINT_SOURCE', sceneId)
  if (!sourceRecord) throw new Error('Room Scene source is unavailable.')
  const { presentationVersion } = liveSessionCheckpointSceneSourceSchema.parse(
    JSON.parse(sourceRecord.json)
  )
  const effects = (
    await ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_encounterId_sceneId_createdOrdinal_id', (q) =>
        q.eq('encounterId', state.id).eq('sceneId', sceneId)
      )
      .take(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
  ).map((row) => toSpatialInstance(readSpatialEffect(row)))
  const initial = (await readRoomSceneState(transaction, sceneId)).scene
  const tokenOf = (scene: typeof initial, tokenId: string) => {
    const token = scene.tokens.find(({ id }) => id.toLowerCase() === tokenId)
    if (!token) throw new Error(MISSING_TOKENS)
    return token
  }
  const source = tokenOf(initial, sourceTokenId)
  const ordered = movements
    .map((movement) => {
      const tokenId = tokenIdByActorId.get(movement.targetActorId)!
      return {
        ...movement,
        tokenId,
        reach: measureSceneDistance(
          initial.grid,
          source.position,
          tokenOf(initial, tokenId).position
        )
      }
    })
    .sort(
      (left, right) =>
        right.reach - left.reach ||
        (left.targetActorId < right.targetActorId
          ? -1
          : left.targetActorId > right.targetActorId
            ? 1
            : 0)
    )
  const moves: Awaited<ReturnType<ApplyEncounterForcedMovements>> = []
  for (const target of ordered) {
    const { scene, baseOrdinals } = await readRoomSceneState(transaction, sceneId)
    const token = tokenOf(scene, target.tokenId)
    const destination = deriveSquareGridForcedMovementDestination({
      direction: target.direction,
      distance: feetInSceneUnit(target.feet, scene.grid.unit),
      source,
      target: token,
      occupants: scene.tokens.filter(({ id }) => id !== token.id),
      state: scene
    })
    if (!destination) throw new Error('A forced movement needs a square grid its tokens fill.')
    if (destination.x === token.position.x && destination.y === token.position.y) continue
    const path = [token.position, destination]
    if (
      collectSpatialMovementCandidates({
        actorIdByTokenId,
        effects,
        movementKind: 'FORCED',
        path,
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
  return moves
}
