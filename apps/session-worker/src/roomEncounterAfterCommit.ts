import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { raiseQueuedReactionOffer } from '@artificer-toolkit/encounter-persistence/reactionOffer'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { RoomNativeEncounterCommand } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { endRoomOrphanedSummons } from './roomActionSummonTokens.js'
import { settleDamageMirrors } from './roomDamageMirror.js'
import { settleDefeatRewards } from './roomDefeatReward.js'
import { raiseRoomDelegatedLegendaryAction } from './roomEncounterDelegatedLegendaryAction.js'
import { raiseRoomHpZeroEffects } from './roomEncounterHpZeroTriggers.js'
import { flagRoomReturnsOntoOccupiedSpace } from './roomEncounterReturnsToPlay.js'
import { raiseRoomRuleEffects } from './roomEncounterRuleTriggers.js'
import { raiseRoomStartOfTurnEffects } from './roomEncounterStartOfTurnTriggers.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import { advanceRoomPastEndedSummon } from './roomEncounterSummonEndAdvance.js'
import type { RoomInputs } from './roomInputs.js'

/**
 * Everything a committed room Encounter command owes before its result is presented, in the one
 * order the room runs it. Each stage reads the Run the stages before it left:
 *
 * 1. the damage mirrors and defeat rewards the command collected, so a source a mirror defeats is
 *    seen by the hit-point effects;
 * 2. the effects of creatures the command brought to 0 hit points;
 * 3. a delegated Legendary Action and the continuation that finishes its turn end;
 * 4. the start-of-turn effects of a turn the command or that continuation began;
 * 5. the actions the rules raise for failed saves;
 * 6. the flag on a creature that returned to play onto an occupied space;
 * 7. the mirrors and rewards the roots raised in stages 2 to 5 collected;
 * 8. the sweep of summons whose carrier ended, and the advance past one that was acting;
 * 9. the next queued reaction offer (D219), once the Run waits on nothing else.
 *
 * Stages 2 to 5 run only on an ACTIVE Run in a room that executes rules (`raisesRoots`). Returns
 * whether any stage changed the Run, so the caller reads it again before presenting it.
 */
export async function settleRoomEncounterAfterCommit(input: {
  ctx: EncounterWriteTransaction
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  campaignId: string
  epoch: string
  userId: string
  observed: LiveSessionRulesRevisions
  encounterId: string
  random(maximum: number): number
  command: Pick<RoomNativeEncounterCommand, 'type' | 'commandId'>
  /** The turn root the command committed or answered: its own id unless it answered a decision. */
  turnRootCommandId: string
  /** Whether the Run was ACTIVE once the command committed. */
  active: boolean
  raisesRoots: boolean
  defeatedBefore: ReadonlySet<string>
  outOfPlayBefore: ReadonlySet<string>
  executeAction(command: ResolveEncounterActionInputDto): Promise<unknown>
  executeTurn(
    command: {
      type: 'ADVANCE_TURN'
      encounterId: string
      commandId: string
      expectedVersion: number
    },
    actingUserId?: string
  ): Promise<unknown>
}): Promise<boolean> {
  const { ctx, transaction, campaignId, userId, encounterId, command, executeTurn } = input
  const execute = input.executeAction
  const raisesRoots = input.active && input.raisesRoots
  const settleLedgers = async () => {
    const settlement = {
      ctx,
      store: input.store,
      transaction,
      inputs: input.inputs,
      campaignId,
      epoch: input.epoch,
      userId,
      observed: input.observed,
      encounterId,
      random: input.random
    }
    const mirrored = await settleDamageMirrors(settlement)
    return (await settleDefeatRewards(settlement)) || mirrored
  }
  const raiseTurnStart = (parentCommandId: string) =>
    raiseRoomStartOfTurnEffects({ ctx, encounterId, parentCommandId, execute })
  const raiseRules = () => raiseRoomRuleEffects({ ctx, encounterId, execute })

  const settledLedgers = await settleLedgers()
  const raisedHpZeroEffects = raisesRoots
    ? await raiseRoomHpZeroEffects({
        ctx,
        transaction,
        encounterId,
        parentCommandId: command.commandId.toLowerCase(),
        defeatedBefore: input.defeatedBefore,
        execute
      })
    : false
  const delegatedLegendaryAction = raisesRoots
    ? await raiseRoomDelegatedLegendaryAction({
        ctx,
        transaction,
        encounterId,
        turnRootCommandId: input.turnRootCommandId,
        execute,
        executeTurn
      })
    : { committed: false, continuationCommandId: null }
  // A continuation that finished a split turn end began the next turn, under its own id.
  const raisedStartOfTurnEffects =
    raisesRoots &&
    (delegatedLegendaryAction.continuationCommandId !== null ||
      command.type === 'START' ||
      command.type === 'ADVANCE_TURN' ||
      command.type === 'RESOLVE_RULE_OCCURRENCE')
      ? await raiseTurnStart(
          (delegatedLegendaryAction.continuationCommandId ?? input.turnRootCommandId).toLowerCase()
        )
      : false
  const raisedRuleEffects = raisesRoots ? await raiseRules() : false
  const flaggedReturn =
    input.active &&
    (await flagRoomReturnsOntoOccupiedSpace({
      ctx,
      transaction,
      encounterId,
      userId,
      occurredAt: new Date().toISOString(),
      outOfPlayBefore: input.outOfPlayBefore
    }))
  // What the raised roots dealt to a mirror's holder reaches its source too.
  const settledRaisedLedgers = await settleLedgers()
  // After every effect the command and its raised roots ended, so a carrier that ended takes its creature.
  const sweepSummons = () =>
    endRoomOrphanedSummons({
      ctx,
      transaction,
      userId,
      encounterId,
      occurredAt: new Date().toISOString()
    })
  const summonSweep = input.active
    ? await sweepSummons()
    : { ended: false, currentActorOrphaned: false }
  // A creature whose carrier ended on its own turn stands until that turn ends (D200).
  const advancedPastSummon = summonSweep.currentActorOrphaned
    ? await advanceRoomPastEndedSummon({
        ctx,
        encounterId,
        parentCommandId: input.turnRootCommandId.toLowerCase(),
        sweep: sweepSummons,
        // The system advance runs as the GM: the player whose command ended the carrier may not control the creature.
        executeTurn: async (turn) =>
          executeTurn(
            turn,
            (await ctx.ports.requireCampaignAuthority(campaignId, userId)).campaign.ownerUserId
          ),
        // Unlike stages 4 and 5, the rule actions are raised here only when the turn start raised no root.
        settleTurnStart: async (advanceCommandId) =>
          (await raiseTurnStart(advanceCommandId)) || (await raiseRules())
      })
    : false
  // Last, once the command and every root it raised have settled: the next reaction offer a
  // committed attack queued (D219) becomes the Run's decision when it waits on nothing else.
  const raisedReactionOffer = await raiseQueuedReactionOffer(
    ctx,
    encounterId,
    new Date().toISOString()
  )
  return (
    settledLedgers ||
    settledRaisedLedgers ||
    raisedHpZeroEffects ||
    delegatedLegendaryAction.committed ||
    raisedStartOfTurnEffects ||
    raisedRuleEffects ||
    flaggedReturn ||
    summonSweep.ended ||
    advancedPastSummon ||
    raisedReactionOffer
  )
}
