import { deriveEncounterCharacterMechanicsEventCommandId } from './encounterCharacterMechanicsBatch.js'
import type { EncounterCharacterMechanicsEventPhase } from './encounterCharacterMechanicsBatch.js'
import { featureChargeUsed, withFeatureChargeUsed } from './encounterActorState.js'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import { planEncounterMechanicsBatch } from './encounterMechanicsBatchPlan.js'
import type {
  EncounterMechanicsBatchInput,
  EncounterMechanicsBatchPlan
} from './encounterMechanicsBatchPlan.js'
import type { CharacterMovementFacts } from './encounterMovementTargets.js'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'

type ActionCharacterFacts = CharacterMovementFacts & {
  character: CharacterAuthored
  sheetState: CharacterSheetState
}

type PreparedActionMechanics = Awaited<
  ReturnType<typeof prepareEncounterActionMechanics<ActionCharacterFacts>>
>

export type NativeEncounterActionMechanicsInput = {
  prepared: PreparedActionMechanics
  encounterId: string
  expectedEncounterVersion: number
  occurrenceId: string
  sourceCommandId: string
  commandId: string
  occurredAt: string
  applications: readonly CharacterRuleActionApplication[]
  forceTargetVersionAdvance?: boolean
  eventPhases?: {
    resource: EncounterCharacterMechanicsEventPhase
    outcome: EncounterCharacterMechanicsEventPhase
  }
  ordinal?: number
}

/** Uses the same event identities and batches for planning and publication. */
export function prepareNativeActionMechanicsBatches(input: NativeEncounterActionMechanicsInput) {
  const { prepared } = input
  const { state, actor, target, source, sourceFacts, targetFacts } = prepared
  if (input.encounterId !== state.id || input.expectedEncounterVersion !== state.version)
    throw new Error('Encounter action settlement is stale.')
  const resourceConsumption = prepared.characterActionState?.resourceConsumption
  const sourceResourceBatch: EncounterMechanicsBatchInput | null =
    source.kind === 'CHARACTER_ACTION' && resourceConsumption && actor.id !== target.id
      ? {
          encounterId: input.encounterId,
          targetActorId: actor.id,
          expectedEncounterVersion: input.expectedEncounterVersion,
          occurrenceId: input.occurrenceId,
          sourceCommandId: input.sourceCommandId,
          commandId: deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            phase: input.eventPhases?.resource ?? 'DIRECT_ACTION_RESOURCE',
            ordinal: input.ordinal ?? 0,
            targetCharacterId: source.characterId
          }),
          occurredAt: input.occurredAt,
          applications: [],
          effectiveMaximumHitPoints: sourceFacts.effectiveMaximumHitPoints,
          effectiveScalarValues: sourceFacts.effectiveScalarValues,
          forceVersionAdvance: false,
          characterResourceConsumption: resourceConsumption
        }
      : null
  const targetBatch: EncounterMechanicsBatchInput = {
    encounterId: input.encounterId,
    targetActorId: target.id,
    expectedEncounterVersion: input.expectedEncounterVersion,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.sourceCommandId,
    commandId:
      target.kind === 'CHARACTER' && input.eventPhases
        ? deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            phase: input.eventPhases.outcome,
            ordinal: input.ordinal ?? 0,
            targetCharacterId:
              target.sourceId ??
              (() => {
                throw new Error('Encounter Character action target is stale.')
              })()
          })
        : input.commandId,
    occurredAt: input.occurredAt,
    applications: input.applications,
    effectiveMaximumHitPoints: targetFacts.effectiveMaximumHitPoints,
    effectiveScalarValues: targetFacts.effectiveScalarValues,
    forceVersionAdvance: input.forceTargetVersionAdvance ?? false,
    ...(source.kind === 'CHARACTER_ACTION' && actor.id === target.id && resourceConsumption
      ? { characterResourceConsumption: resourceConsumption }
      : {})
  }
  return { sourceResourceBatch, targetBatch }
}

export function finishNativeActionMechanicsSettlement(
  prepared: NativeEncounterActionMechanicsInput['prepared'],
  mechanics: Pick<
    EncounterMechanicsBatchPlan,
    'updatedActor' | 'receiptApplications' | 'targetTransition' | 'characterStreamVersion'
  >,
  sourceResourceMechanics: Pick<
    EncounterMechanicsBatchPlan,
    'updatedActor' | 'receiptApplications' | 'targetTransition' | 'characterStreamVersion'
  > | null
) {
  const { actor, target, source, resourceUse, featureResource, featureUsed } = prepared
  let settledSource =
    sourceResourceMechanics?.updatedActor ??
    (mechanics.updatedActor.id === actor.id ? mechanics.updatedActor : actor)
  if (source.kind === 'CREATURE' && resourceUse) {
    if (featureChargeUsed(settledSource, source.capability.ownerFeatureId) !== featureUsed)
      throw new Error('The selected Encounter feature action resource changed before settlement.')
    const resourceActor = encounterRunActorStateSchema.parse({
      ...settledSource,
      resources: withFeatureChargeUsed(
        settledSource,
        source.capability.ownerFeatureId,
        featureUsed + resourceUse.cost
      )
    })
    settledSource = resourceActor
  }
  const resourceConsumption = prepared.characterActionState?.resourceConsumption
  const sourceCharacterStreamVersion =
    source.kind === 'CHARACTER_ACTION' && resourceConsumption && actor.id !== target.id
      ? (sourceResourceMechanics?.characterStreamVersion ??
        (() => {
          throw new Error('The selected Character action resource was not committed.')
        })())
      : null
  const resourceReceipt = resourceConsumption
    ? {
        poolId: resourceConsumption.poolId,
        chargeId: resourceConsumption.chargeId,
        cost: resourceConsumption.cost,
        beforeUsed: resourceConsumption.beforeUsed,
        afterUsed: resourceConsumption.afterUsed,
        beforeRemaining: resourceConsumption.beforeRemaining,
        afterRemaining: resourceConsumption.afterRemaining
      }
    : null
  const featureResourceReceipt =
    source.kind === 'CREATURE' &&
    resourceUse &&
    featureResource?.remaining !== null &&
    featureResource?.remaining !== undefined
      ? {
          ownerActorId: actor.id,
          ownerFeatureId: source.capability.ownerFeatureId,
          chargeId: resourceUse.chargeId,
          cost: resourceUse.cost,
          beforeUsed: featureUsed,
          afterUsed: featureUsed + resourceUse.cost,
          beforeRemaining: featureResource.remaining,
          afterRemaining: featureResource.remaining - resourceUse.cost
        }
      : null
  return {
    mechanics,
    settledSource,
    sourceResourceMechanics,
    sourceCharacterStreamVersion,
    resourceReceipt,
    featureResourceReceipt
  }
}

/** Computes resource and outcome changes without publishing either one. */
export function planNativeEncounterActionMechanics(
  input: NativeEncounterActionMechanicsInput,
  userId: string
) {
  const { sourceResourceBatch, targetBatch } = prepareNativeActionMechanicsBatches(input)
  const { prepared } = input
  const sourceResourcePlan = sourceResourceBatch
    ? planEncounterMechanicsBatch({
        batch: sourceResourceBatch,
        actor: prepared.actor,
        userId,
        ...(prepared.sourceFacts.characterFacts
          ? { characterFacts: prepared.sourceFacts.characterFacts }
          : {})
      })
    : null
  const targetPlan = planEncounterMechanicsBatch({
    batch: targetBatch,
    actor: prepared.target,
    userId,
    ...(prepared.targetFacts.characterFacts
      ? { characterFacts: prepared.targetFacts.characterFacts }
      : {})
  })
  return {
    ...finishNativeActionMechanicsSettlement(prepared, targetPlan, sourceResourcePlan),
    sourceResourcePlan,
    targetPlan
  }
}
