import type { LiveSessionCommandRejectionCodeDto } from '@artificer-toolkit/schema/api/liveSessions'
import { sceneFogPublishCommandInputSchema } from '@artificer-toolkit/schema/api/sceneFog'
import {
  sceneDoorStateCommandInputDtoSchema,
  sceneGeometryCommandInputDtoSchema,
  sceneLiveCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema,
  sceneUndoLastMoveCommandInputDtoSchema,
  type CampaignSceneStateDto,
  type SceneCommandResultDto,
  type SceneLiveCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  isSceneEntityVisibleToViewer,
  sceneDerivesExploration,
  sceneDoorChangeFailure,
  sceneTokenMovementFailure
} from '@artificer-toolkit/shared/vtt'
import type { LiveSessionTransientCapture } from '@artificer-toolkit/schema/api/liveSessionTransient'
import { z } from 'zod'

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

/**
 * Every Scene command the room writes (D79): token and barrier geometry, inline edits, undo and the
 * publication of a staged fog patch. A whole-layer `PATCH_SCENE_FOG` is not one; fog is uploaded.
 */
export const liveSessionSceneCommandInputSchema = z.union([
  sceneGeometryCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema,
  sceneLiveCommandInputDtoSchema,
  sceneUndoLastMoveCommandInputDtoSchema,
  sceneFogPublishCommandInputSchema
])

/** The Scene commands the planner decides; the room commits `UNDO_LAST_SCENE_MOVE` through Scene history. */
export const liveSessionSceneGeometryCommandInputSchema = z.union([
  sceneDoorStateCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema
])

type LiveSceneCommand = z.infer<typeof liveSessionSceneCommandInputSchema>

/** Settings, lights, darkness, annotations and measurements: edits with no geometry save. */
export function isInlineSceneCommand(
  command: LiveSceneCommand
): command is SceneLiveCommandInputDto {
  return sceneLiveCommandInputDtoSchema.safeParse(command).success
}

/**
 * Whether a Scene command stages a geometry save before it commits instead of writing its delta
 * directly: every Encounter-bound move and every move on an Encounter-bound Scene, any move or door
 * change that derives fog exploration, and every token or barrier edit. Door changes and moves that
 * do neither commit directly.
 */
export function isStagedSceneCommand(
  command: LiveSceneCommand,
  scene: CampaignSceneStateDto,
  encounterId: string | null
): boolean {
  const derivesExploration = sceneDerivesExploration({
    fogMode: scene.fogMode,
    fogLayerCount: scene.fogLayers.length,
    tokens: scene.tokens
  })
  switch (command.type) {
    case 'MOVE_SCENE_TOKEN':
      return command.expectedEncounterVersion !== null || encounterId !== null || derivesExploration
    case 'SET_SCENE_DOOR_STATE':
      return derivesExploration
    case 'UPSERT_SCENE_TOKEN':
    case 'REMOVE_SCENE_TOKEN':
    case 'UPSERT_SCENE_BARRIER':
    case 'REMOVE_SCENE_BARRIER':
      return true
    default:
      return false
  }
}

type SceneCommandPlan =
  | { kind: 'ACCEPTED'; delta: NonNullable<SceneCommandResultDto['delta']> }
  | { kind: 'STAGED' }
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
 * Decides the Scene delta for one synchronized token move or door change, or that it requires
 * geometry planning. Pure; journal writes, broadcast and publication stay with the room.
 */
export function planLiveSceneCommand(input: {
  command: z.infer<typeof liveSessionSceneGeometryCommandInputSchema>
  scene: CampaignSceneStateDto
  encounterId: string | null
  actor: { role: 'OWNER' | 'PLAYER'; userId: string }
}): SceneCommandPlan {
  const { command, scene, actor } = input
  const staged = isStagedSceneCommand(command, scene, input.encounterId)
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
    if (staged) return { kind: 'STAGED' }
    return {
      kind: 'ACCEPTED',
      delta: { barrierId: command.barrierId, kind: 'DOOR_STATE_SET', state: command.state }
    }
  }
  // A bound token follows its actor's controllers, which Convex checks; the room never applies
  // the Scene token's own list to it.
  const token = scene.tokens.find((candidate) => candidate.id === command.tokenId)
  if (
    command.expectedEncounterVersion === null &&
    actor.role !== 'OWNER' &&
    (!token || !token.controlledByUserIds.includes(actor.userId))
  )
    return reject('FORBIDDEN', 'The current user does not control this Scene token.', false)
  const position = command.path.at(-1)!
  const failure = sceneTokenMovementFailure(scene, command.tokenId, position, command.path)
  if (failure) return reject('INVALID_COMMAND', failure, true)
  if (staged) return { kind: 'STAGED' }
  return { kind: 'ACCEPTED', delta: { kind: 'TOKEN_MOVED', position, tokenId: command.tokenId } }
}
