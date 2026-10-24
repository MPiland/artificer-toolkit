import type { LiveSessionEncounterEscapeResponseCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { settledCheckD20MatchesFrozen } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { basicActionCheckRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import { findStoredEscape } from './escapeEffectVerification.js'
import { endEncounterEscapedEffect } from './escapedEffectEndPersistence.js'
import { recordRuleRollCard } from './ruleRollCards.js'
import type { EncounterWriteTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

type EscapeCheckSettlement = LiveSessionEncounterEscapeResponseCommitInput['settlement']
export type EscapeCheckOutput = Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'ESCAPE_CHECK' }
>

/**
 * Settles an Escape check: checks the planned result against the frozen check and the held
 * creature's current effects, ends the relationship effect and the conditions it owned when the
 * escape succeeded, then posts the roller's roll card unless the app already carded that die. The
 * roller is the held creature, or the rescuer within reach that frees it. Returns the actors with
 * the held creature released.
 */
export async function settleEncounterEscapeCheck(
  ctx: EncounterWriteTransaction,
  input: {
    campaign: EncounterDocument<'campaigns'>
    state: { id: string; gameSystemId: string }
    actors: readonly EncounterRunActorState[]
    settlement: EscapeCheckSettlement
    rootCommandId: string
    initiatorUserId: string
    occurredAt: string
    occurrenceVersion: number
    /** The held dice a d20 window added to the frozen check's d20. */
    windowDice?: Parameters<typeof settledCheckD20MatchesFrozen>[2]
  }
): Promise<{ actors: EncounterRunActorState[]; output: EscapeCheckOutput }> {
  const { state, actors, settlement } = input
  const { context, execution } = settlement
  const output =
    execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'ESCAPE_CHECK'
      ? execution.applicationOutputs
      : null
  const roller = actors.find((actor) => actor.id === context.actorId)
  // A rescuer rolls; the effect lives on, and the escape frees, the creature it holds.
  const holder = context.heldActorId
    ? actors.find((actor) => actor.id === context.heldActorId)
    : roller
  if (
    !output ||
    execution.status !== 'COMPLETE' ||
    !roller ||
    roller.kind === 'CUSTOM' ||
    !holder ||
    holder.kind === 'CUSTOM' ||
    output.heldActorId !== context.heldActorId ||
    execution.occurrenceVersion !== input.occurrenceVersion ||
    output.occurrenceId !== execution.occurrenceId ||
    output.commandId !== context.commandId ||
    context.commandId !== input.rootCommandId ||
    output.actorId !== context.actorId ||
    output.activeEffectId !== context.activeEffectId ||
    output.check.checkDefinitionId !== context.check.checkDefinitionId ||
    output.check.dc !== context.check.dc ||
    !settledCheckD20MatchesFrozen(output.d20, context.d20, input.windowDice)
  )
    throw new Error('Live Session escape check scope mismatch.')
  const stillHeld =
    (await findStoredEscape(ctx, { encounterId: state.id, holder, context })) !== null
  if (
    output.outcome !==
    (!stillHeld ? 'ALREADY_ENDED' : output.d20.total >= context.check.dc ? 'ESCAPED' : 'FAILED')
  )
    throw new Error('Live Session escape check scope mismatch.')
  let nextActors = [...actors]
  if (output.outcome === 'ESCAPED') {
    const ended = await endEncounterEscapedEffect(ctx, {
      encounterId: state.id,
      actors: nextActors,
      holderActorId: holder.id,
      activeEffectId: context.activeEffectId,
      occurredAt: input.occurredAt
    })
    if (
      !ended ||
      checksumCanonicalJson(ended.endedConditionIds) !==
        checksumCanonicalJson(output.removedConditionIds)
    )
      throw new Error('Live Session escape differs from its plan.')
    nextActors = ended.actors
  } else if (output.removedConditionIds.length > 0) {
    throw new Error('Live Session escape check scope mismatch.')
  }
  // The app already carded the die an app roll settled with; any other die gets the holder's card.
  if (settlement.appRollId === null) {
    const system = await ctx.ports.requireSystem(state.gameSystemId)
    const roll = basicActionCheckRollRecord({
      occurrenceId: execution.occurrenceId,
      d20: output.d20,
      actionLabel: context.actionLabel,
      checkLabel: context.check.label,
      rollerLabel: roller.label,
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      createdAt: input.occurredAt
    })
    await recordRuleRollCard(ctx, {
      campaign: input.campaign,
      encounterId: state.id,
      roller,
      initiatorUserId: input.initiatorUserId,
      visibility: undefined,
      clientNonce: roll.id,
      roll
    })
  }
  return { actors: nextActors, output }
}
