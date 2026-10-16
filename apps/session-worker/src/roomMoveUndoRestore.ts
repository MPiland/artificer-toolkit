import { restoreConcealmentPrune } from '@artificer-toolkit/encounter-persistence/concealmentPrune'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { restoreTurnTeleportAllowance } from '@artificer-toolkit/encounter-persistence/turnMovement'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { sceneStoredConcealmentPruneSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { roomEncounterWriteTransaction } from './roomEncounterWritePorts.js'
import { readRoomSceneRow } from './roomSceneRecords.js'

/**
 * Gives back what a token move took when the GM undoes that move: the observers its prune dropped
 * from concealments (only concealments that still exist get them; an ended one stays ended) and the
 * teleport allowance it spent (SPELLS-28.2).
 */
export async function restoreRoomMoveUndo(input: {
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
  userId: string
  sceneId: string
  undoneCommandId: string
}) {
  const { store, transaction, inputs, authorization, campaignId } = input
  const row = readRoomSceneRow(transaction, 'sceneConcealmentPrunes', [
    input.sceneId,
    input.undoneCommandId
  ])
  const held = authorization.play.encounter
  if (held?.sceneId !== input.sceneId) return
  await inputs.encounter(held.encounterId, transaction)
  const ctx = await roomEncounterWriteTransaction({
    store,
    transaction,
    inputs,
    authorization,
    campaignId,
    epoch: input.epoch,
    userId: input.userId,
    observed: inputs.revisions(campaignId, authorization.revisions)
  })
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', held.encounterId))
    .unique()
  if (!run) return
  const state = readRunState(run)
  await restoreTurnTeleportAllowance(ctx, { state, commandId: input.undoneCommandId })
  if (row)
    await restoreConcealmentPrune(ctx, {
      state,
      actors: await readRunActors(ctx, state),
      entries: sceneStoredConcealmentPruneSchema.parse(row).entries
    })
}
