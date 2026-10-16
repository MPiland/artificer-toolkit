import type { StabilizeCheckSettlement } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { encounterBasicActionStabilizeApplication } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { basicActionCheckRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { recordRuleRollCard } from './ruleRollCards.js'
import type { EncounterWriteTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

export type BasicActionCheckOutput = Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'BASIC_ACTION_CHECK' }
>

/**
 * Settles a basic action's check (First Aid): re-applies the stabilize the room planned to the
 * dying Character, then posts the helper's roll card unless the app already carded that die. It
 * checks the planned result against the frozen check and the current actors, and returns the actors
 * with the target settled.
 */
export async function settleEncounterBasicActionCheck(
  ctx: EncounterWriteTransaction,
  input: {
    campaign: EncounterDocument<'campaigns'>
    state: { id: string; version: number; gameSystemId: string }
    actors: readonly EncounterRunActorState[]
    settlement: StabilizeCheckSettlement
    rootCommandId: string
    initiatorUserId: string
    occurredAt: string
    occurrenceVersion: number
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
  }
): Promise<{ actors: EncounterRunActorState[]; output: BasicActionCheckOutput }> {
  const { state, actors, settlement } = input
  const { context, execution } = settlement
  const output =
    execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'BASIC_ACTION_CHECK'
      ? execution.applicationOutputs
      : null
  const helper = actors.find((actor) => actor.id === context.helperActorId)
  const target = actors.find((actor) => actor.id === context.targetActorId)
  if (
    !output ||
    execution.status !== 'COMPLETE' ||
    !helper ||
    helper.kind === 'CUSTOM' ||
    !target ||
    target.kind !== 'CHARACTER' ||
    target.sourceId !== context.targetCharacterId ||
    execution.occurrenceVersion !== input.occurrenceVersion ||
    output.occurrenceId !== execution.occurrenceId ||
    output.commandId !== context.commandId ||
    context.commandId !== input.rootCommandId ||
    checksumCanonicalJson(output.definition) !== checksumCanonicalJson(context.definition) ||
    output.helperActorId !== context.helperActorId ||
    output.targetActorId !== context.targetActorId ||
    output.targetCharacterId !== context.targetCharacterId ||
    output.check.checkDefinitionId !== context.check.checkDefinitionId ||
    output.check.dc !== context.check.dc ||
    output.d20.modifier !== context.d20.modifier ||
    output.d20.derivedRollMode !== context.d20.rollMode ||
    output.d20.contributorChecksum !== context.d20.contributorChecksum ||
    output.d20.total !== output.d20.selectedNatural + context.d20.modifier ||
    (output.outcome === 'STABILIZED') !==
      (output.d20.total >= context.check.dc && output.outcome !== 'NOT_DYING')
  )
    throw new Error('Live Session basic action check scope mismatch.')
  let nextActors = [...actors]
  if (output.outcome === 'STABILIZED') {
    const transition = output.targetTransition
    if (!transition) throw new Error('Live Session basic action check transition is missing.')
    const mechanics = await input.applyMechanics({
      encounterId: state.id,
      targetActorId: target.id,
      expectedEncounterVersion: state.version,
      occurrenceId: execution.occurrenceId,
      sourceCommandId: input.rootCommandId,
      commandId: deriveEncounterCharacterMechanicsEventCommandId({
        occurrenceId: execution.occurrenceId,
        sourceCommandId: input.rootCommandId,
        phase: 'BASIC_ACTION_CHECK',
        ordinal: 0,
        targetCharacterId: target.sourceId
      }),
      occurredAt: input.occurredAt,
      applications: [encounterBasicActionStabilizeApplication(target.id)],
      effectiveMaximumHitPoints: transition.before.maximumHitPoints,
      effectiveScalarValues: transition.before.scalarValues,
      forceVersionAdvance: false
    })
    if (
      checksumCanonicalJson({
        before: mechanics.targetTransition.before,
        after: mechanics.targetTransition.after
      }) !== checksumCanonicalJson({ before: transition.before, after: transition.after }) ||
      mechanics.characterStreamVersion !== transition.afterStreamVersion
    )
      throw new Error('Live Session basic action stabilize differs from its plan.')
    nextActors = nextActors.map((actor) =>
      actor.id === mechanics.updatedActor.id ? mechanics.updatedActor : actor
    )
  }
  // The app already carded the die an app roll settled with; any other die gets the helper's card.
  if (settlement.appRollId === null) {
    const system = await ctx.ports.requireSystem(state.gameSystemId)
    const roll = basicActionCheckRollRecord({
      occurrenceId: execution.occurrenceId,
      d20: output.d20,
      actionLabel: context.actionLabel,
      checkLabel: context.check.label,
      rollerLabel: helper.label,
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      createdAt: input.occurredAt
    })
    await recordRuleRollCard(ctx, {
      campaign: input.campaign,
      encounterId: state.id,
      roller: helper,
      initiatorUserId: input.initiatorUserId,
      visibility: undefined,
      clientNonce: roll.id,
      roll
    })
  }
  return { actors: nextActors, output }
}
