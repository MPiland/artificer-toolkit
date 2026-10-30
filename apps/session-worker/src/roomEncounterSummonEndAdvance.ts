import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { SummonSweep } from '@artificer-toolkit/encounter-persistence/summonRemoval'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { summonEndAdvanceCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'

/**
 * Ends the turn of a conjured creature whose carrier ended while it was acting (D200). The sweep
 * leaves that creature standing, a valid current actor a GM ADVANCE_TURN can recover, so the room
 * advances the turn as its own system command, keyed to the command that ended the carrier and the
 * Run version it left. The advance raises its turn start as any advance does, and the sweep then
 * removes the creature, which has acted. A creature the advance lands on whose carrier has ended too
 * (it comes first after a wrap) repeats this, and the repeat stops when a decision is pending, the
 * Run is not active, or no creature is left to end. Returns whether any turn advanced.
 */
export async function advanceRoomPastEndedSummon(input: {
  ctx: EncounterWriteTransaction
  encounterId: string
  parentCommandId: string
  sweep(): Promise<SummonSweep>
  executeTurn(command: {
    type: 'ADVANCE_TURN'
    encounterId: string
    commandId: string
    expectedVersion: number
  }): Promise<unknown>
  /** Raises what the new turn's start and the rules fire, as the commanded advance would. */
  settleTurnStart(advanceCommandId: string): Promise<unknown>
}) {
  const { ctx, encounterId } = input
  let parentCommandId = input.parentCommandId
  let advanced = false
  let passes: number | null = null
  for (;;) {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', encounterId))
      .unique()
    if (!run || run.status !== 'ACTIVE') break
    const waiting = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (query) =>
        query.eq('encounterId', encounterId).eq('state', 'PENDING')
      )
      .first()
    // A turn start that paused on a decision keeps the creature standing until it is answered.
    if (waiting) break
    // Every pass moves the cursor on and removes a creature that acted, so the actors bound the loop.
    passes ??= readRunState(run).actorIds.length
    if (passes-- === 0) break
    const commandId = summonEndAdvanceCommandId(parentCommandId, run.version)
    await input.executeTurn({
      type: 'ADVANCE_TURN',
      encounterId,
      commandId,
      expectedVersion: run.version
    })
    advanced = true
    await input.settleTurnStart(commandId)
    const sweep = await input.sweep()
    if (!sweep.currentActorOrphaned) break
    parentCommandId = commandId
  }
  return advanced
}
