import {
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandRejectionCodeDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  sceneDoorStateCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema,
  sceneUndoLastMoveCommandInputDtoSchema,
  type CampaignSceneStateDto,
  type SceneCommandResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  isSceneEntityVisibleToViewer,
  sceneDoorChangeFailure,
  sceneTokenMovementFailure,
  VTT_SCENE_LIMITS
} from '@artificer-toolkit/shared/vtt'
import type { LiveSessionTransientCapture } from '@artificer-toolkit/schema/api/liveSessionTransient'
import { z } from 'zod'

import type { DurableCommandJournal } from './durableCommandJournal.js'

/**
 * Whether a member may drag-preview a token: the GM always; a player never for hidden tokens; an
 * Encounter-bound token follows its bound actor's controllers (the same rule as the Convex commit
 * and the web), and an unbound token its Scene `controlledByUserIds`.
 */
export function canPreviewSceneTokenDrag(input: {
  token: CampaignSceneStateDto['tokens'][number]
  role: 'OWNER' | 'PLAYER'
  userId: string
  originBoundTokenControl: LiveSessionTransientCapture['originBoundTokenControl'] | null
}): boolean {
  const { token } = input
  if (token.locked) return false
  if (input.role === 'OWNER') return true
  if (token.hidden) return false
  const bound = input.originBoundTokenControl?.find((entry) => entry.tokenId === token.id)
  return bound ? bound.controlled : token.controlledByUserIds.includes(input.userId)
}

export const liveSessionSceneCommandInputSchema = z.union([
  sceneDoorStateCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema,
  sceneUndoLastMoveCommandInputDtoSchema
])

// Older receipts contain the entire Scene; the same fields recover their token positions.
const sceneMovementUndoSchema = z.object({
  id: z.uuid(),
  version: z.number().int().nonnegative(),
  tokens: z
    .array(
      z.object({
        id: z.uuid(),
        position: z.strictObject({ x: z.number().finite(), y: z.number().finite() })
      })
    )
    .min(1)
    .max(VTT_SCENE_LIMITS.tokens)
})

type SceneCommandPlan =
  | { kind: 'ACCEPTED'; delta: NonNullable<SceneCommandResultDto['delta']> }
  | {
      kind: 'REJECTED'
      code: LiveSessionCommandRejectionCodeDto
      message: string
      /** Whether the rejection should restore the sender's Scene projection. */
      correct: boolean
    }

function reject(
  code: LiveSessionCommandRejectionCodeDto,
  message: string,
  correct: boolean
): SceneCommandPlan {
  return { kind: 'REJECTED', code, message, correct }
}

/**
 * Decides the Scene delta for one synchronized live command. Pure apart from reading the
 * latest undoable move; journal writes, broadcast and publication stay with the room.
 */
export function planLiveSceneCommand(input: {
  command: z.infer<typeof liveSessionSceneCommandInputSchema>
  scene: CampaignSceneStateDto
  sceneEncounterBound: boolean
  actor: { role: 'OWNER' | 'PLAYER'; userId: string }
  latestUnmatchedMove: () => ReturnType<DurableCommandJournal['latestUnmatchedSceneTokenMove']>
}): SceneCommandPlan {
  const { command, scene, actor } = input
  if (command.type === 'SET_SCENE_DOOR_STATE') {
    const door = scene.barriers.find(
      (barrier) => barrier.id === command.barrierId && barrier.kind === 'DOOR'
    )
    const viewer = {
      role: actor.role === 'OWNER' ? ('GM' as const) : ('PLAYER' as const),
      userId: actor.userId
    }
    if (
      !door ||
      !isSceneEntityVisibleToViewer(scene, viewer, { collection: 'barriers', entity: door })
    )
      return reject('INVALID_COMMAND', 'The door is not available.', true)
    const failure = sceneDoorChangeFailure(
      actor.role === 'OWNER',
      scene.doorStates[door.id],
      command.state
    )
    if (failure) return reject('FORBIDDEN', failure, false)
    return {
      kind: 'ACCEPTED',
      delta: { barrierId: command.barrierId, kind: 'DOOR_STATE_SET', state: command.state }
    }
  }
  if (command.type === 'MOVE_SCENE_TOKEN') {
    if (
      command.expectedEncounterVersion !== null ||
      input.sceneEncounterBound ||
      // Fog OFF derives no exploration, so kept fog layers and token vision do not apply.
      (scene.fogMode !== 'OFF' &&
        (scene.fogLayers.length > 0 ||
          scene.tokens.some((token) => token.vision?.enabled === true)))
    )
      return reject(
        'UNAVAILABLE',
        'Encounter-bound or fog-derived token movement is not available through live play yet.',
        true
      )
    const token = scene.tokens.find((candidate) => candidate.id === command.tokenId)
    if (actor.role !== 'OWNER' && (!token || !token.controlledByUserIds.includes(actor.userId)))
      return reject('FORBIDDEN', 'The current user does not control this Scene token.', false)
    const position = command.path.at(-1)!
    const failure = sceneTokenMovementFailure(scene, command.tokenId, position, command.path)
    if (failure) return reject('INVALID_COMMAND', failure, true)
    return { kind: 'ACCEPTED', delta: { kind: 'TOKEN_MOVED', position, tokenId: command.tokenId } }
  }
  if (actor.role !== 'OWNER')
    return reject('FORBIDDEN', 'Only the Campaign owner may undo Scene movement.', false)
  const targetReceipt = input.latestUnmatchedMove()
  if (!targetReceipt?.undoJson)
    return reject('INVALID_COMMAND', 'There is no committed token move to undo.', true)
  const target = liveSessionWebSocketServerMessageDtoSchema.parse(
    JSON.parse(targetReceipt.receiptJson)
  )
  const targetResult =
    target.type === 'COMMAND_COMMITTED' && target.delta?.scope === 'SCENE'
      ? target.delta.result
      : null
  const beforeMove = sceneMovementUndoSchema.parse(JSON.parse(targetReceipt.undoJson))
  if (
    !targetResult ||
    targetResult.delta?.kind !== 'TOKEN_MOVED' ||
    targetResult.commandId !== targetReceipt.commandId ||
    targetResult.sceneId !== scene.id ||
    beforeMove.id !== scene.id ||
    beforeMove.version + 1 !== targetResult.version
  )
    throw new Error('Stored live Session token movement receipt is inconsistent.')
  const moveDelta = targetResult.delta
  const priorToken = beforeMove.tokens.find((candidate) => candidate.id === moveDelta.tokenId)
  const currentToken = scene.tokens.find((candidate) => candidate.id === moveDelta.tokenId)
  if (
    !priorToken ||
    !currentToken ||
    currentToken.position.x !== moveDelta.position.x ||
    currentToken.position.y !== moveDelta.position.y
  )
    return reject('INVALID_COMMAND', 'The latest token move can no longer be safely undone.', true)
  return {
    kind: 'ACCEPTED',
    delta: {
      kind: 'TOKEN_MOVE_UNDONE',
      position: priorToken.position,
      tokenId: currentToken.id,
      undoneCommandId: targetReceipt.commandId
    }
  }
}
