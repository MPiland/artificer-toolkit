import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  combineSpendMutations,
  settleActionSourceSpend,
  sourceSpendMutation,
  type SpendMutation
} from './actionSourceSpend.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterWriteContext } from './store.js'
import type { UsedReactionSpend } from './usedReactionSpend.js'

/**
 * Settles one target's outcome of an action, a single-target action's or one creature an area caught:
 * the one mechanics batch the room planned on the target, with every spend that rides it, checked
 * against the room's receipt, and then what the target spent of its own against the outcome (a
 * Legendary Resistance charge, the reaction it used). `label` names the committing action in the
 * charge error. Returns the batch result and the target as settled.
 *
 * The caller checks what only it plans on the batch: the receipts of `extra` and `sourceMutation`,
 * and the Character version `used` recorded.
 */
export async function settleActionTargetOutcome(
  ctx: EncounterWriteContext,
  input: {
    state: EncounterRunState
    target: EncounterRunActorState
    batch: Extract<
      ServerRuleExecutionApplicationOutputsDto,
      { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
    >
    label: 'action' | 'area'
    occurrenceId: string
    sourceCommandId: string
    commandId: string
    occurredAt: string
    forceVersionAdvance: boolean
    /** The slot the reaction the target used against the outcome spends. */
    reactionSpell: LiveSessionEncounterActionCommitInput['reactionSpellConsumption']
    /** The reaction the target rolled against the attack roll before the outcome. */
    used?: UsedReactionSpend
    /** The source's own spend, when the source is this target. */
    sourceMutation: SpendMutation
    /** What else the outcome does to the target in the same batch. */
    extra: Pick<
      EncounterMechanicsBatchInput,
      'releaseHeldItemInstanceId' | 'degradeItem' | 'enterForm'
    >
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
  }
) {
  const { state, target, batch, used } = input
  // A reaction the target used spends its own slot and allowance with the outcome it answered.
  const reaction = batch.reaction
  if (
    reaction &&
    (reaction.reaction.reactorActorId !== target.id ||
      reaction.reaction.characterId !== (target.kind === 'CHARACTER' ? target.sourceId : null))
  )
    throw new Error('Live Session reaction scope mismatch.')
  if (!reaction && input.reactionSpell)
    throw new Error('Live Session reaction spell slot has no reaction.')
  const reactionSpend = sourceSpendMutation({
    source: target,
    command: { acceptedWieldConflict: null },
    resource: null,
    item: null,
    spell: input.reactionSpell,
    receipts: {
      resourceConsumption: null,
      sourceItemConsumption: null,
      spellCastConsumption: reaction?.spellCastConsumption ?? null
    }
  })
  // The target pays the reaction it already spent in this one mechanics call; a Shield-like reaction
  // would be a second spend of the same reaction.
  if (used && reaction)
    throw new Error('Live Session used reaction and reaction spend the same reaction.')
  const mechanics = await input.applyMechanics({
    encounterId: state.id,
    expectedEncounterVersion: state.version,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.sourceCommandId,
    occurredAt: input.occurredAt,
    targetActorId: target.id,
    commandId: input.commandId,
    ...input.extra,
    applications: batch.applications.map((application) => ({
      ...application,
      targetActorId: target.id
    })),
    effectiveMaximumHitPoints: batch.targetTransition.before.maximumHitPoints,
    grantedMaximumHitPoints: batch.targetTransition.grantedMaximumHitPoints,
    effectiveScalarValues: batch.targetTransition.before.scalarValues,
    forceVersionAdvance: input.forceVersionAdvance,
    ...combineSpendMutations(input.sourceMutation, reactionSpend.mutation, used?.mutation ?? {})
  })
  if (
    checksumCanonicalJson(mechanics.receiptApplications) !==
      checksumCanonicalJson(batch.applications) ||
    checksumCanonicalJson(mechanics.targetTransition) !==
      checksumCanonicalJson(batch.targetTransition) ||
    (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
      batch.targetCharacterStreamVersion !== mechanics.characterStreamVersion)
  )
    throw new Error('Live Session mechanics receipt mismatch.')
  // A Legendary Resistance the target used spends one of its own charges with the outcome.
  const charge =
    batch.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ? batch.targetFeatureResourceConsumption : null
  if (charge && charge.ownerActorId !== target.id)
    throw new Error(`Live Session ${input.label} charge scope mismatch.`)
  const reactionEconomy =
    reaction?.actionEconomyTransition ?? used?.used.receipt.actionEconomyTransition ?? null
  return {
    mechanics,
    target:
      charge || reactionEconomy
        ? await settleActionSourceSpend(ctx, {
            encounterId: state.id,
            source: mechanics.updatedActor,
            spend: {
              featureResourceConsumption: charge,
              actionEconomyTransition: reactionEconomy,
              attackActionTransition: undefined
            },
            economyOverridden: false
          })
        : mechanics.updatedActor
  }
}
