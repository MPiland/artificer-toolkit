import type { ApplyEncounterSummonTokens } from '@artificer-toolkit/encounter-persistence/actionCommitRecords'
import type { EncounterWriteContext } from '@artificer-toolkit/encounter-persistence/store'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { encounterActorTokenBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { RoomTransaction } from './roomEncounterStore.js'
import { persistRoomSceneTokenCreate } from './roomSceneCommandPersistence.js'
import { readRoomScene, readRoomSceneState } from './roomSceneRead.js'

/**
 * Puts each creature an action conjures on the Encounter's Scene, in the action's transaction
 * (D187b): its token is a new Scene entity whose command names the action as its origin, and the
 * Encounter binds the token to the actor the cast created. The Scene rows and the binding commit or
 * roll back with the rest of the cast.
 */
export async function applyRoomSummonTokens(input: {
  ctx: EncounterWriteContext
  transaction: RoomTransaction
  userId: string
  summon: Omit<Parameters<ApplyEncounterSummonTokens>[0], 'state'> & { state: { id: string } }
}): ReturnType<ApplyEncounterSummonTokens> {
  const { ctx, transaction, summon } = input
  const { state, commandId, summons } = summon
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  if (!binding) throw new Error("A summon needs the Encounter's Scene.")
  const { sceneId } = binding
  const sourceRecord = transaction.record('SCENE_CHECKPOINT_SOURCE', sceneId)
  if (!sourceRecord) throw new Error('Room Scene source is unavailable.')
  const { presentationVersion } = liveSessionCheckpointSceneSourceSchema.parse(
    JSON.parse(sourceRecord.json)
  )
  const created: Awaited<ReturnType<ApplyEncounterSummonTokens>> = []
  for (const { actorId, token } of summons) {
    const { scene } = await readRoomSceneState(transaction, sceneId)
    const sceneCommandId = crypto.randomUUID()
    persistRoomSceneTokenCreate({
      transaction,
      header: readRoomScene(transaction, sceneId).header,
      scene,
      token,
      commandId: sceneCommandId,
      actorUserId: input.userId,
      presentationVersion,
      saveId: crypto.randomUUID(),
      now: Date.now(),
      actionOrigin: { encounterId: state.id, commandId }
    })
    await ctx.db.insert(
      'encounterActorTokenBindings',
      encounterActorTokenBindingSchema.parse({
        actorId,
        encounterId: state.id,
        sceneId,
        tokenId: token.id
      })
    )
    created.push({ sceneId, sceneCommandId, tokenId: token.id, actorId })
  }
  return created
}
