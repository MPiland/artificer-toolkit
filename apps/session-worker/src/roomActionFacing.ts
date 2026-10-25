import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import type { EncounterReadContext } from '@artificer-toolkit/encounter-persistence/store'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import {
  sceneStoredGeometryCommandSchema,
  sceneStoredLiveEntitySchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import type { RoomTransaction } from './roomEncounterStore.js'
import { persistRoomSceneCommand } from './roomSceneCommandPersistence.js'
import { readRoomScene, readRoomSceneState } from './roomSceneRead.js'
import { readRoomSceneRow } from './roomSceneRecords.js'

type ActionOrigin = { encounterId: string; commandId: string }

/** Stages one `SET_SCENE_TOKEN_FACING` command for an Encounter action and returns its Scene command ID. */
async function writeRoomTokenFacing(input: {
  transaction: RoomTransaction
  userId: string
  sceneId: string
  tokenId: string
  rotationDegrees: number
  origin: ActionOrigin
}) {
  const { transaction, sceneId, tokenId, rotationDegrees } = input
  const sourceRecord = transaction.record('SCENE_CHECKPOINT_SOURCE', sceneId)
  if (!sourceRecord) throw new Error('Room Scene source is unavailable.')
  const { presentationVersion } = liveSessionCheckpointSceneSourceSchema.parse(
    JSON.parse(sourceRecord.json)
  )
  const { scene, baseOrdinals } = await readRoomSceneState(transaction, sceneId)
  const sceneCommandId = crypto.randomUUID()
  persistRoomSceneCommand({
    transaction,
    header: readRoomScene(transaction, sceneId).header,
    scene,
    baseOrdinals,
    command: {
      type: 'SET_SCENE_TOKEN_FACING',
      commandId: sceneCommandId,
      sceneId,
      expectedSceneVersion: scene.version,
      tokenId,
      rotationDegrees
    },
    actorUserId: input.userId,
    result: {
      commandId: sceneCommandId,
      delta: { kind: 'TOKEN_FACING_SET', tokenId, rotationDegrees },
      occurrence: null,
      replayed: false,
      sceneId,
      version: scene.version + 1
    },
    presentationVersion,
    saveId: crypto.randomUUID(),
    now: Date.now(),
    actionOrigin: input.origin
  })
  return sceneCommandId
}

/**
 * Turns an Encounter actor's token on the Encounter's Scene for its Change facing reaction
 * (ATTACK-12). The Scene command names the action as its origin, so only the action's undo reverts it.
 */
export async function setRoomActorFacing(input: {
  ctx: EncounterReadContext
  transaction: RoomTransaction
  userId: string
  actorId: string
  rotationDegrees: number
  origin: ActionOrigin
}) {
  const { ctx, origin } = input
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', origin.encounterId))
    .unique()
  const tokenBinding = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (q) =>
      q.eq('encounterId', origin.encounterId).eq('actorId', input.actorId)
    )
    .unique()
  if (!binding || !tokenBinding || tokenBinding.sceneId !== binding.sceneId)
    throw new Error("Changing facing needs the actor's token on the Encounter's Scene.")
  const { sceneId, tokenId } = tokenBinding
  const sceneCommandId = await writeRoomTokenFacing({ ...input, sceneId, tokenId })
  return { sceneId, tokenId, sceneCommandId }
}

/**
 * Turns a token back to the facing an action's facing change found, refusing a token moved or
 * turned since, so an undo never overwrites a later change.
 */
export async function restoreRoomActorFacing(input: {
  transaction: RoomTransaction
  userId: string
  sceneId: string
  sceneCommandId: string
  origin: ActionOrigin
}) {
  const { transaction, sceneId, origin } = input
  const storedRow = readRoomSceneRow(transaction, 'sceneLiveCommands', [
    sceneId,
    input.sceneCommandId
  ])
  const stored = storedRow && sceneStoredGeometryCommandSchema.parse(storedRow)
  if (
    stored?.input.type !== 'SET_SCENE_TOKEN_FACING' ||
    stored.priorRotationDegrees === undefined ||
    stored.actionOrigin?.encounterId !== origin.encounterId ||
    stored.actionOrigin.commandId !== origin.commandId
  )
    throw new Error('The facing change is unavailable.')
  const { tokenId } = stored.input
  const entityRow = readRoomSceneRow(transaction, 'sceneLiveEntities', [sceneId, 'tokens', tokenId])
  const entity = entityRow && sceneStoredLiveEntitySchema.parse(entityRow)
  if (entity?.version !== stored.result.version)
    rejectDomain('REVERT_UNAVAILABLE', 'The token has moved or turned since; adjust it manually.')
  await writeRoomTokenFacing({
    transaction,
    userId: input.userId,
    sceneId,
    tokenId,
    rotationDegrees: stored.priorRotationDegrees,
    origin
  })
}
