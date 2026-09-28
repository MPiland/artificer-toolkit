import { v } from 'convex/values'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  liveSessionEncounterRollCommitInputSchema,
  liveSessionEncounterRollDiceSchema,
  liveSessionEncounterRollInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { internalQuery } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { recordEncounterCommand } from '@artificer-toolkit/encounter-persistence/commands'
import { readRunProjection, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readEvidenceRollDice } from '@artificer-toolkit/encounter-persistence/evidenceRolls'
import { readActorInitiativeRoll } from '../encounters/initiativeSources'
import { requireLiveEncounterRun } from './encounterCommandAdmission'
import { encounterReadTransaction, encounterWriteTransaction } from '../encounters/encounterPorts'

/**
 * The dice a room roll command draws (D41), as die sizes in draw order; none for a retried
 * command. Initiative and enemy actions are the GM's; "Roll dice" is any member's who may answer
 * the decision.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const dice = internalQuery({
  args: v.any(),
  handler: async (ctx, args: unknown) => {
    const { command, ...scope } = liveSessionEncounterRollInputSchema.parse(args)
    const { userId, campaign, membership, run } = await requireLiveEncounterRun(ctx, {
      ...scope,
      encounterId: command.encounterId
    })
    if (command.type === 'ROLL_RULE_EVIDENCE')
      return liveSessionEncounterRollDiceSchema.parse({
        dice: await readEvidenceRollDice(encounterReadTransaction(ctx), command, userId)
      })
    if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
    // A retried command replays its recorded roll, so the room draws nothing for it.
    const recorded = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', run.campaignId).eq('commandId', command.commandId.toLowerCase())
      )
      .unique()
    if (recorded) return liveSessionEncounterRollDiceSchema.parse({ dice: [] })
    if (command.type === 'ROLL_ACTOR_INITIATIVE') {
      const { rollMode } = await readActorInitiativeRoll(
        ctx,
        readRunState(run),
        campaign,
        command.actorId.toLowerCase()
      )
      return liveSessionEncounterRollDiceSchema.parse({
        dice: rollMode === 'NORMAL' ? [20] : [20, 20]
      })
    }
    const definition = readRunProjection(run)
      .actors.find((actor) => actor.id === command.actorId.toLowerCase())
      ?.features.find((feature) => feature.id === command.featureId)
      ?.rollDefinitions?.find((candidate) => candidate.id === command.rollDefinitionId)
    if (!definition) throw new Error('Encounter enemy action is unavailable.')
    const { count, die } = definition.expression
    return liveSessionEncounterRollDiceSchema.parse({
      dice: definition.rollMode === 'NORMAL' ? Array.from({ length: count }, () => die) : [die, die]
    })
  }
})

/**
 * Records a room roll command with the room's draws. A replay draws nothing; any other roll must
 * use every draw, each within its die, or the dice changed since the room read them.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const { command, draws, ...scope } = liveSessionEncounterRollCommitInputSchema.parse(args)
    const { userId } = await requireLiveEncounterRun(ctx, {
      ...scope,
      encounterId: command.encounterId
    })
    let drawn = 0
    const result = await recordEncounterCommand(
      encounterWriteTransaction(ctx),
      command,
      userId,
      (size) => {
        const draw = draws[drawn++]
        if (draw === undefined || draw >= size)
          rejectDomain('VERSION_STALE', 'The roll changed; roll again.')
        return draw
      }
    )
    if (drawn !== 0 && drawn !== draws.length)
      rejectDomain('VERSION_STALE', 'The roll changed; roll again.')
    return result
  }
})
