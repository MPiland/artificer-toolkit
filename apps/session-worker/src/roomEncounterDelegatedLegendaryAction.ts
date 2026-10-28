import { readEncounterActorDefeated } from '@artificer-toolkit/encounter-persistence/characterStates'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import {
  delegatedLegendaryContinuationCommandId,
  systemTriggerAreaCommand
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { RoomTransaction } from './roomEncounterStore.js'
import { readRoomScene } from './roomSceneRead.js'

/**
 * Runs a turn end split around a delegated Legendary Action (an area its owner centers on itself):
 * once the turn that delegated it commits, the option runs as its own rule-raised root through the
 * area coordinator, then, once nothing waits on a decision, a continuation ADVANCE_TURN offers the
 * remaining windows and begins the next turn. A holder that fell or left its Scene meanwhile forgoes
 * the option. `turnRootCommandId` is the turn root this command committed or answered. Returns
 * whether anything committed, and the continuation that ran, whose turn start raises its own effects.
 */
export async function raiseRoomDelegatedLegendaryAction(input: {
  ctx: EncounterWriteTransaction
  transaction: RoomTransaction
  encounterId: string
  turnRootCommandId: string
  execute(command: ResolveEncounterActionInputDto): Promise<unknown>
  executeTurn(command: {
    type: 'ADVANCE_TURN'
    encounterId: string
    commandId: string
    expectedVersion: number
  }): Promise<unknown>
}) {
  const { ctx, encounterId } = input
  let turnRootCommandId = input.turnRootCommandId.toLowerCase()
  let raisedFor: string | null = null
  let continuationCommandId: string | null = null
  for (;;) {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', encounterId))
      .unique()
    if (!run || run.status !== 'ACTIVE') break
    const state = readRunState(run)
    const delegation = state.delegatedLegendaryAction
    const waiting = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (query) =>
        query.eq('encounterId', encounterId).eq('state', 'PENDING')
      )
      .first()
    if (!delegation || waiting) break
    const binding = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (query) =>
        query.eq('encounterId', encounterId).eq('actorId', delegation.holderActorId)
      )
      .unique()
    if (
      delegation.parentCommandId === turnRootCommandId &&
      raisedFor !== turnRootCommandId &&
      binding &&
      !(await readEncounterActorDefeated(
        ctx,
        await readRunActor(ctx, state, delegation.holderActorId)
      ))
    ) {
      raisedFor = turnRootCommandId
      await input.execute(
        systemTriggerAreaCommand({
          encounterId,
          expectedVersion: run.version,
          parentCommandId: delegation.parentCommandId,
          holderActorId: delegation.holderActorId,
          actionId: delegation.actionId,
          scene: {
            sceneId: binding.sceneId,
            expectedSceneVersion: readRoomScene(input.transaction, binding.sceneId).header.version
          },
          trigger: 'LEGENDARY_ACTION'
        })
      )
      continue
    }
    continuationCommandId = delegatedLegendaryContinuationCommandId(delegation.parentCommandId)
    await input.executeTurn({
      type: 'ADVANCE_TURN',
      encounterId,
      commandId: continuationCommandId,
      expectedVersion: run.version
    })
    turnRootCommandId = continuationCommandId
  }
  return { committed: raisedFor !== null || continuationCommandId !== null, continuationCommandId }
}
