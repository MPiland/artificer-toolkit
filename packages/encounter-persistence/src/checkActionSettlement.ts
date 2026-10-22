import type { CheckActionSettlement } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { settledCheckD20MatchesFrozen } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { basicActionCheckRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { recordRuleRollCard } from './ruleRollCards.js'
import type { EncounterWriteTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'
import { settleTargetOutcome } from './targetOutcomeSettlement.js'

export const isCheckActionSettlement = <Settlement extends { context: { kind: string } }>(
  settlement: Settlement
): settlement is Extract<Settlement, CheckActionSettlement> =>
  settlement.context.kind === 'ENCOUNTER_CHECK_ACTION'

/**
 * Settles a fixed-DC check action whose success runs its authored outcome (D173): checks the room's
 * result against the frozen check, the admitted command and its authored check, re-applies a
 * success's outcome on the target through the shared target-outcome settler, and posts the actor's
 * roll card unless the app already carded that die. It returns the actors with the target settled.
 */
export async function settleEncounterCheckAction(
  ctx: EncounterWriteTransaction,
  input: {
    campaign: EncounterDocument<'campaigns'>
    state: { id: string; version: number; gameSystemId: string }
    actors: readonly EncounterRunActorState[]
    settlement: CheckActionSettlement
    /** The admitted command and the action's current definition and authored check. */
    admitted: {
      commandFingerprint: string
      actorId: string
      targetActorId: string
      definition: { id: string; version: number; checksum: string }
      checkDefinitionIds: readonly string[]
      dc: number | null
    }
    rootCommandId: string
    initiatorUserId: string
    occurredAt: string
    occurrenceVersion: number
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
  }
) {
  const { state, actors, settlement, admitted } = input
  const { context, execution } = settlement
  const output =
    execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'CHECK_ACTION'
      ? execution.applicationOutputs
      : null
  const actor = actors.find((entry) => entry.id === context.actorId)
  const target = actors.find((entry) => entry.id === context.targetActorId)
  if (
    !output ||
    execution.status !== 'COMPLETE' ||
    !actor ||
    actor.kind === 'CUSTOM' ||
    !target ||
    execution.occurrenceVersion !== input.occurrenceVersion ||
    output.occurrenceId !== execution.occurrenceId ||
    output.commandId !== context.commandId ||
    context.commandId !== input.rootCommandId ||
    context.commandFingerprint !== admitted.commandFingerprint ||
    context.actorId !== admitted.actorId ||
    context.targetActorId !== admitted.targetActorId ||
    checksumCanonicalJson(context.definition) !== checksumCanonicalJson(admitted.definition) ||
    checksumCanonicalJson(output.definition) !== checksumCanonicalJson(context.definition) ||
    output.actorId !== context.actorId ||
    output.targetActorId !== context.targetActorId ||
    !admitted.checkDefinitionIds.includes(context.check.checkDefinitionId) ||
    context.check.dc !== admitted.dc ||
    output.check.checkDefinitionId !== context.check.checkDefinitionId ||
    output.check.dc !== context.check.dc ||
    !settledCheckD20MatchesFrozen(output.d20, context.d20) ||
    (output.stateTransition.kind === 'NONE' && settlement.forcedMovements.length > 0)
  )
    throw new Error('Live Session check action scope mismatch.')
  const settled =
    output.stateTransition.kind === 'TARGET_OUTCOME'
      ? await settleTargetOutcome({
          state,
          target,
          occurrenceId: execution.occurrenceId,
          sourceCommandId: input.rootCommandId,
          occurredAt: input.occurredAt,
          applyMechanics: input.applyMechanics,
          planned: output.stateTransition,
          forcedMovements: settlement.forcedMovements
        })
      : null
  // The app already carded the die an app roll settled with; any other die gets the actor's card.
  if (settlement.appRollId === null) {
    const system = await ctx.ports.requireSystem(state.gameSystemId)
    const roll = basicActionCheckRollRecord({
      occurrenceId: execution.occurrenceId,
      d20: output.d20,
      actionLabel: context.actionLabel,
      checkLabel: context.check.label,
      rollerLabel: actor.label,
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      createdAt: input.occurredAt
    })
    await recordRuleRollCard(ctx, {
      campaign: input.campaign,
      encounterId: state.id,
      roller: actor,
      initiatorUserId: input.initiatorUserId,
      visibility: undefined,
      clientNonce: roll.id,
      roll
    })
  }
  return {
    actors: settled
      ? actors.map((entry) => (entry.id === settled.target.id ? settled.target : entry))
      : [...actors]
  }
}
