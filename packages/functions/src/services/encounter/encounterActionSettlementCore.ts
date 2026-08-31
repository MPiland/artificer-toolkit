import {
  createEncounterRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord
} from '@artificer-toolkit/db'
import {
  serverRuleExecutionApplicationOutputsDtoSchema,
  type ServerRuleExecutionApplicationOutputsDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import { characterRuleActionSystemAdapterRegistry } from '../rules/characterRuleActionSystemAdapterRegistry.js'
import { assertEncounterFeatureActionCapabilityCurrent } from '../rules/encounterFeatureActionCapabilityDiscovery.js'
import { requireEncounterActorRuleResult } from './encounterActorRuleEvaluation.js'
import type { LockedEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'
import {
  applyLockedEncounterActorMechanicsBatch,
  applyLockedEncounterCharacterMechanicsBatch,
  deriveEncounterCharacterMechanicsEventCommandId,
  readEncounterActorConditionState,
  type EncounterCharacterMechanicsEventPhase
} from './encounterCharacterMechanicsBatch.js'
import { featureChargeUsed, withFeatureChargeUsed } from './encounterActorState.js'
import {
  persistEncounterCharacterActionResourceConsumption,
  prepareEncounterCharacterActionState,
  type EncounterCharacterActionResourceConsumption
} from './encounterCharacterActionResource.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import type { EncounterMovementReactionActionSource } from './encounterMovementReactionSources.js'
import type {
  EncounterMovementReactionActionExecution,
  PreparedEncounterMovementReactionAction
} from './encounterMovementReactionActionExecution.js'
import { snapshotStatBlock } from './encounterProjection.js'

type CompleteActionExecution = Extract<
  EncounterMovementReactionActionExecution,
  { kind: 'COMPLETE' }
>
type LockedCharacter =
  LockedEncounterActiveEffectTargets['lockedCharacters'] extends ReadonlyMap<string, infer TValue>
    ? TValue
    : never

export interface PreparedEncounterActionSettlementCore {
  action: PreparedEncounterMovementReactionAction
  actionSource: EncounterMovementReactionActionSource
  sourceActor: EncounterActorRecord
  targetActor: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
  resourceConsumption: EncounterCharacterActionResourceConsumption | null
  featureResourceConsumption: {
    ownerFeatureId: string
    chargeId: string
    cost: number
    beforeUsed: number
    afterUsed: number
    beforeRemaining: number
    afterRemaining: number
  } | null
  targetFeatureResourceConsumption: {
    ownerFeatureId: string
    chargeId: string
    cost: number
    beforeUsed: number
    afterUsed: number
    beforeRemaining: number
    afterRemaining: number
  } | null
}

function effectiveCharacterPolicy(character: LockedCharacter) {
  return character.overlay.kind === 'MATERIALIZED'
    ? character.overlay.rulePolicyOutput
    : character.mechanics.rulePolicyOutput
}

function featureActionMechanic(
  action: Extract<EncounterMovementReactionActionSource, { kind: 'ENCOUNTER_FEATURE' }>
): Readonly<Record<string, unknown>> {
  const invocation = action.capability.mechanicFacts.invocation
  const savingThrow = invocation.savingThrow
  const save =
    savingThrow?.dcMethod === 'FIXED_DC' &&
    Number.isSafeInteger(savingThrow.baseDc) &&
    action.capability.savingThrowAbilityDefinitionId
      ? {
          abilityDefinitionId: action.capability.savingThrowAbilityDefinitionId,
          dc: savingThrow.baseDc
        }
      : null
  return {
    effectId: action.capability.effectId,
    trigger: invocation.triggerCode,
    activation: invocation.activation,
    attackBonus: null,
    attackRollMode: null,
    save,
    outcomes: action.capability.mechanicFacts.outcomes
  }
}

/** Prepares one current source/target pair without any reaction policy or usage state. */
export async function prepareEncounterActionSettlementCore(input: {
  db: DBLike
  actorUserId: string
  automationMode: 'AUTOMATIC' | 'ASSISTED'
  encounter: EncounterRecord
  actionSource: EncounterMovementReactionActionSource
  targetActorId: string
  targets: LockedEncounterActiveEffectTargets
}): Promise<PreparedEncounterActionSettlementCore> {
  const sourceActor = input.encounter.actors.find(
    (actor) => actor.id === input.actionSource.actorId
  )
  const targetActor = input.encounter.actors.find((actor) => actor.id === input.targetActorId)
  if (!sourceActor || !targetActor) {
    throw new EncounterConflictError('The selected Encounter action source or target is stale.')
  }
  const source =
    input.actionSource.kind === 'CHARACTER_ACTION'
      ? input.targets.lockedCharacters.get(input.actionSource.characterId)
      : null
  if (
    input.actionSource.kind === 'CHARACTER_ACTION' &&
    (!source ||
      sourceActor.kind !== 'CHARACTER' ||
      sourceActor.sourceId !== input.actionSource.characterId ||
      source.actor.id !== sourceActor.id ||
      source.streamVersion !== input.actionSource.characterStreamVersion)
  ) {
    throw new EncounterConflictError('The selected Encounter Character action source is stale.')
  }
  let featureActorRule: ReturnType<typeof requireEncounterActorRuleResult> | null = null
  let featureResourceConsumption: PreparedEncounterActionSettlementCore['featureResourceConsumption'] =
    null
  if (input.actionSource.kind === 'ENCOUNTER_FEATURE') {
    const capability = input.actionSource.capability
    const invocation = capability.compiledEffect.invocation
    if (
      sourceActor.kind !== 'CREATURE' ||
      sourceActor.id !== capability.encounterActorId ||
      sourceActor.systemId !== capability.gameSystemId ||
      invocation.kind !== 'ACTION'
    ) {
      throw new EncounterValidationError('The selected Encounter feature action is not normalized.')
    }
    try {
      assertEncounterFeatureActionCapabilityCurrent({
        actor: sourceActor,
        capability
      })
    } catch (error) {
      throw new EncounterConflictError(
        error instanceof Error
          ? `The selected Encounter feature action source is stale. ${error.message}`
          : 'The selected Encounter feature action source is stale.'
      )
    }
    if (!input.targets.encounterActorRules) {
      throw new EncounterValidationError(
        'The selected Encounter feature actor facts are unavailable.'
      )
    }
    featureActorRule = requireEncounterActorRuleResult(
      input.targets.encounterActorRules,
      sourceActor.id
    )
    const resourceUse = capability.featureResourceUse ?? null
    if (resourceUse !== null) {
      const resource = featureActorRule.featureResources.find(
        (candidate) => candidate.featureId === capability.ownerFeatureId
      )
      const actualUsed = featureChargeUsed(sourceActor, capability.ownerFeatureId)
      if (
        !resource ||
        resource.maximum === null ||
        resource.remaining === null ||
        resource.used !== actualUsed ||
        resource.rawUsed !== actualUsed ||
        resource.remaining !== resource.maximum - resource.used ||
        resource.remaining < resourceUse.cost
      ) {
        throw new EncounterConflictError(
          'The selected Encounter feature action resource is unavailable.'
        )
      }
      featureResourceConsumption = {
        ownerFeatureId: capability.ownerFeatureId,
        chargeId: resourceUse.chargeId,
        cost: resourceUse.cost,
        beforeUsed: resource.used,
        afterUsed: resource.used + resourceUse.cost,
        beforeRemaining: resource.remaining,
        afterRemaining: resource.remaining - resourceUse.cost
      }
    }
  }
  const systemId =
    input.actionSource.kind === 'CHARACTER_ACTION'
      ? source!.systemId
      : input.actionSource.capability.gameSystemId
  const adapter = characterRuleActionSystemAdapterRegistry.get(systemId)
  if (!adapter)
    throw new EncounterValidationError('The Encounter Game System cannot execute this action.')
  const preparedState =
    input.actionSource.kind === 'CHARACTER_ACTION'
      ? await prepareEncounterCharacterActionState({
          db: input.db,
          actionId: input.actionSource.candidate.actionId,
          actorUserId: input.actorUserId,
          automationMode: input.automationMode,
          characterId: source!.id,
          entry: input.actionSource.entry,
          mechanics: source!.mechanics,
          overlay: source!.overlay
        })
      : { actionMechanic: featureActionMechanic(input.actionSource), resourceConsumption: null }

  let target: PreparedEncounterMovementReactionAction['target']
  if (targetActor.kind === 'CHARACTER') {
    const character = targetActor.sourceId
      ? input.targets.lockedCharacters.get(targetActor.sourceId)
      : null
    if (!character || character.actor.id !== targetActor.id) {
      throw new EncounterConflictError('The Encounter action target Character is stale.')
    }
    const policy = effectiveCharacterPolicy(character)
    target = {
      actorId: targetActor.id,
      currentHitPoints: character.mechanics.commandState.state.hitpoints.current,
      temporaryHitPoints: character.mechanics.commandState.state.hitpoints.temp ?? 0,
      maximumHitPoints: character.maximumHitPoints,
      conditionIds: character.activeConditionDefinitionIds,
      derivedFacts: {
        ...policy,
        targetProtection: {
          status: 'NORMALIZED',
          defenses: policy.defenses,
          conditionImmunityIds: policy.conditionImmunityIds
        }
      },
      defenses: policy.defenses,
      conditionImmunityIds: policy.conditionImmunityIds
    }
  } else {
    const current = input.targets.encounterActors.get(targetActor.id)
    const actorRule = input.targets.encounterActorRules
      ? requireEncounterActorRuleResult(input.targets.encounterActorRules, targetActor.id)
      : null
    if (!current || !actorRule || actorRule.targetProtection.status !== 'NORMALIZED') {
      throw new EncounterValidationError(
        'The Encounter action target protections are not normalized.'
      )
    }
    const conditions = readEncounterActorConditionState(current.conditions ?? [])
    target = {
      actorId: current.id,
      currentHitPoints: current.currentHitPoints,
      temporaryHitPoints: current.tempHitPoints,
      maximumHitPoints: current.maxHitPoints,
      conditionIds: conditions.ids,
      derivedFacts: {
        targetProtection: actorRule.targetProtection,
        statBlock: snapshotStatBlock(current)
      },
      defenses: actorRule.targetProtection.defenses,
      conditionImmunityIds: actorRule.targetProtection.conditionImmunityIds
    }
  }
  return {
    action: {
      adapter,
      published:
        input.actionSource.kind === 'CHARACTER_ACTION'
          ? input.actionSource.entry.schemaVersion === 4
            ? input.actionSource.entry.compilation.executionPlan.kind === 'SINGLE_GRAPH'
              ? input.actionSource.entry.compilation.executionPlan.published
              : input.actionSource.entry.compilation.executionPlan.test.published
            : input.actionSource.entry.compilation.published
          : adapter.compile({ action: input.actionSource.capability }),
      actionMechanic: preparedState.actionMechanic,
      sourceDerivedFacts:
        input.actionSource.kind === 'CHARACTER_ACTION'
          ? effectiveCharacterPolicy(source!)
          : {
              actorId: featureActorRule!.actorId,
              initiativeModifier: featureActorRule!.initiativeModifier,
              targetProtection: featureActorRule!.targetProtection,
              featureResources: featureActorRule!.featureResources
            },
      target
    },
    actionSource: input.actionSource,
    sourceActor,
    targetActor: input.targets.encounterActors.get(targetActor.id) ?? targetActor,
    targets: input.targets,
    resourceConsumption: preparedState.resourceConsumption,
    featureResourceConsumption,
    targetFeatureResourceConsumption: null
  }
}

/** Adds one already-revalidated target-owned Feature charge transition. */
export function withTargetEncounterFeatureResourceConsumption(input: {
  prepared: PreparedEncounterActionSettlementCore
  consumption: NonNullable<
    PreparedEncounterActionSettlementCore['targetFeatureResourceConsumption']
  >
}): PreparedEncounterActionSettlementCore {
  if (
    !Number.isSafeInteger(input.consumption.cost) ||
    input.consumption.cost < 1 ||
    input.consumption.afterUsed !== input.consumption.beforeUsed + input.consumption.cost ||
    input.consumption.beforeRemaining < input.consumption.cost ||
    input.consumption.afterRemaining !== input.consumption.beforeRemaining - input.consumption.cost
  ) {
    throw new EncounterConflictError('The target Encounter feature resource transition is invalid.')
  }
  return { ...input.prepared, targetFeatureResourceConsumption: input.consumption }
}

function resourcePolicyOverride(consumption: EncounterCharacterActionResourceConsumption) {
  return {
    base: { input: consumption.nextBaseState.facts, output: consumption.nextBaseState.output },
    overlay: consumption.nextOverlayState
      ? { input: consumption.nextOverlayState.facts, output: consumption.nextOverlayState.output }
      : null
  }
}

function resourceReceipt(consumption: EncounterCharacterActionResourceConsumption | null) {
  return consumption
    ? {
        poolId: consumption.poolId,
        chargeId: consumption.chargeId,
        cost: consumption.cost,
        beforeUsed: consumption.beforeUsed,
        afterUsed: consumption.afterUsed,
        beforeRemaining: consumption.beforeRemaining,
        afterRemaining: consumption.afterRemaining
      }
    : null
}

function featureResourceReceipt(
  ownerActorId: string,
  consumption: PreparedEncounterActionSettlementCore['featureResourceConsumption']
) {
  return consumption
    ? {
        ownerActorId,
        ownerFeatureId: consumption.ownerFeatureId,
        chargeId: consumption.chargeId,
        cost: consumption.cost,
        beforeUsed: consumption.beforeUsed,
        afterUsed: consumption.afterUsed,
        beforeRemaining: consumption.beforeRemaining,
        afterRemaining: consumption.afterRemaining
      }
    : null
}

async function consumeTargetFeatureResource(input: {
  repository: ReturnType<typeof createEncounterRepository>
  targetActor: EncounterActorRecord
  consumption: NonNullable<
    PreparedEncounterActionSettlementCore['targetFeatureResourceConsumption']
  >
}): Promise<EncounterActorRecord> {
  const currentUsed = featureChargeUsed(input.targetActor, input.consumption.ownerFeatureId)
  if (currentUsed !== input.consumption.beforeUsed) {
    throw new EncounterConflictError(
      'The target Encounter feature resource changed before settlement.'
    )
  }
  const updated = {
    ...input.targetActor,
    resources: withFeatureChargeUsed(
      input.targetActor,
      input.consumption.ownerFeatureId,
      input.consumption.afterUsed
    )
  }
  await input.repository.updateActor(updated)
  return updated
}

/** Applies source resource and target outcomes; callers own any action-family usage marker. */
export async function settleEncounterActionSettlementCore(input: {
  db: DBLike
  actorUserId: string
  encounterId: string
  occurrenceId: string
  commandId: string
  ordinal: number
  eventPhases: {
    resource: EncounterCharacterMechanicsEventPhase
    outcome: EncounterCharacterMechanicsEventPhase
  }
  prepared: PreparedEncounterActionSettlementCore
  execution: CompleteActionExecution
  allowMovementInterruption?: boolean
}): Promise<{
  application: ServerRuleExecutionApplicationOutputsDto
  sourceActor: EncounterActorRecord
  targetActor: EncounterActorRecord
  characterTransitions: Array<{
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }>
}> {
  if (
    (input.execution.execution.movementInterruption ?? null) !== null &&
    !input.allowMovementInterruption
  ) {
    throw new EncounterValidationError(
      'Movement interruption is unavailable outside an authoritative movement contact.'
    )
  }
  const repository = createEncounterRepository(input.db)
  const sourceCharacter =
    input.prepared.actionSource.kind === 'CHARACTER_ACTION'
      ? (input.prepared.targets.lockedCharacters.get(input.prepared.actionSource.characterId) ??
        null)
      : null
  const resource = input.prepared.resourceConsumption
  const featureResource = input.prepared.featureResourceConsumption ?? null
  const targetFeatureResource = input.prepared.targetFeatureResourceConsumption ?? null
  let sourceActor = input.prepared.sourceActor
  let settledTargetActor = input.prepared.targetActor
  let sourceCharacterStreamVersion: number | null = null
  const characterTransitions: Array<{
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }> = []
  if (
    resource &&
    sourceCharacter &&
    input.prepared.targetActor.id !== input.prepared.sourceActor.id
  ) {
    const sourceBatch = await applyLockedEncounterCharacterMechanicsBatch({
      trx: input.db,
      actorUserId: input.actorUserId,
      encounterId: input.encounterId,
      occurrenceId: input.occurrenceId,
      commandId: deriveEncounterCharacterMechanicsEventCommandId({
        occurrenceId: input.occurrenceId,
        sourceCommandId: input.commandId,
        phase: input.eventPhases.resource,
        ordinal: input.ordinal,
        targetCharacterId: sourceCharacter.id
      }),
      sourceCommandId: input.commandId,
      targetActor: sourceActor,
      targetCharacterId: sourceCharacter.id,
      mechanics: sourceCharacter.mechanics,
      overlay: sourceCharacter.overlay,
      effectiveMaximumHitPoints: sourceCharacter.maximumHitPoints,
      conditionDefinitions: sourceCharacter.conditionDefinitions,
      applications: [],
      forceVersionAdvance: true,
      policyOverride: resourcePolicyOverride(resource),
      afterPersist: async ({ db }) =>
        persistEncounterCharacterActionResourceConsumption({
          db,
          actorUserId: input.actorUserId,
          characterId: sourceCharacter.id,
          consumption: resource
        })
    })
    if (sourceBatch.streamVersion === null) {
      throw new EncounterConflictError('The Encounter action resource was not committed.')
    }
    sourceCharacterStreamVersion = sourceBatch.streamVersion
    characterTransitions.push({
      characterId: sourceCharacter.id,
      beforeStreamVersion: sourceCharacter.mechanics.characterStreamVersion,
      afterStreamVersion: sourceBatch.streamVersion
    })
    sourceActor = sourceBatch.updatedActor
  }
  let application: ServerRuleExecutionApplicationOutputsDto
  if (input.prepared.targetActor.kind === 'CHARACTER') {
    const targetCharacter = input.prepared.targetActor.sourceId
      ? input.prepared.targets.lockedCharacters.get(input.prepared.targetActor.sourceId)
      : null
    if (!targetCharacter)
      throw new EncounterConflictError('The Encounter action target Character is stale.')
    const sameSource = sourceCharacter !== null && targetCharacter.id === sourceCharacter.id
    const targetBatch = await applyLockedEncounterCharacterMechanicsBatch({
      trx: input.db,
      actorUserId: input.actorUserId,
      encounterId: input.encounterId,
      occurrenceId: input.occurrenceId,
      commandId: deriveEncounterCharacterMechanicsEventCommandId({
        occurrenceId: input.occurrenceId,
        sourceCommandId: input.commandId,
        phase: input.eventPhases.outcome,
        ordinal: input.ordinal,
        targetCharacterId: targetCharacter.id
      }),
      sourceCommandId: input.commandId,
      targetActor: sameSource ? sourceActor : input.prepared.targetActor,
      targetCharacterId: targetCharacter.id,
      mechanics: targetCharacter.mechanics,
      overlay: targetCharacter.overlay,
      effectiveMaximumHitPoints: targetCharacter.maximumHitPoints,
      conditionDefinitions: targetCharacter.conditionDefinitions,
      applications: input.execution.applications,
      forceVersionAdvance: sameSource && resource !== null,
      ...(sameSource && resource
        ? {
            policyOverride: resourcePolicyOverride(resource),
            afterPersist: async ({ db }: { db: DBLike }) =>
              persistEncounterCharacterActionResourceConsumption({
                db,
                actorUserId: input.actorUserId,
                characterId: sourceCharacter!.id,
                consumption: resource
              })
          }
        : {})
    })
    if (sameSource) {
      sourceActor = targetBatch.updatedActor
      sourceCharacterStreamVersion = null
    } else if (targetBatch.streamVersion !== null) {
      await repository.updateActor(targetBatch.updatedActor)
    }
    settledTargetActor = targetBatch.updatedActor
    if (targetBatch.streamVersion !== null) {
      characterTransitions.push({
        characterId: targetCharacter.id,
        beforeStreamVersion: targetCharacter.mechanics.characterStreamVersion,
        afterStreamVersion: targetBatch.streamVersion
      })
    }
    if (featureResource !== null) {
      const currentUsed = featureChargeUsed(sourceActor, featureResource.ownerFeatureId)
      if (currentUsed !== featureResource.beforeUsed) {
        throw new EncounterConflictError(
          'The selected Encounter feature resource changed before settlement.'
        )
      }
      sourceActor = {
        ...sourceActor,
        resources: withFeatureChargeUsed(
          sourceActor,
          featureResource.ownerFeatureId,
          featureResource.afterUsed
        )
      }
      await repository.updateActor(sourceActor)
    }
    if (targetFeatureResource !== null) {
      await consumeTargetFeatureResource({
        repository,
        targetActor: targetBatch.updatedActor,
        consumption: targetFeatureResource
      })
    }
    application = serverRuleExecutionApplicationOutputsDtoSchema.parse({
      kind: 'CHARACTER_MECHANICS_BATCH',
      schemaVersion: 1,
      occurrenceId: input.occurrenceId,
      sourceActorId: input.prepared.sourceActor.id,
      sourceCharacterId: sourceCharacter?.id ?? null,
      targetActorId: input.prepared.targetActor.id,
      sourceCharacterStreamVersion,
      targetCharacterStreamVersion: targetBatch.streamVersion,
      resourceConsumption: resourceReceipt(resource),
      featureResourceConsumption: featureResourceReceipt(
        input.prepared.sourceActor.id,
        featureResource
      ),
      targetFeatureResourceConsumption: targetFeatureResource
        ? featureResourceReceipt(input.prepared.targetActor.id, targetFeatureResource)
        : null,
      activeEffectTransitions: [],
      maintenanceTransition: null,
      d20: input.execution.d20,
      targetTransition: targetBatch.targetTransition,
      applications: targetBatch.receiptApplications
    })
  } else {
    const conditionState = readEncounterActorConditionState(
      input.prepared.targetActor.conditions ?? []
    )
    const targetBatch = await applyLockedEncounterActorMechanicsBatch({
      trx: input.db,
      targetActor: input.prepared.targetActor,
      initialConditionRows: conditionState.values,
      applications: input.execution.applications
    })
    settledTargetActor = targetBatch.updatedActor
    if (targetFeatureResource !== null) {
      await consumeTargetFeatureResource({
        repository,
        targetActor: targetBatch.updatedActor,
        consumption: targetFeatureResource
      })
    }
    if (featureResource !== null) {
      const resourceSource =
        input.prepared.sourceActor.id === input.prepared.targetActor.id
          ? targetBatch.updatedActor
          : input.prepared.sourceActor
      const currentUsed = featureChargeUsed(resourceSource, featureResource.ownerFeatureId)
      if (currentUsed !== featureResource.beforeUsed) {
        throw new EncounterConflictError(
          'The selected Encounter feature resource changed before settlement.'
        )
      }
      sourceActor = {
        ...resourceSource,
        resources: withFeatureChargeUsed(
          resourceSource,
          featureResource.ownerFeatureId,
          featureResource.afterUsed
        )
      }
      await repository.updateActor(sourceActor)
    }
    application = serverRuleExecutionApplicationOutputsDtoSchema.parse({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      schemaVersion: 1,
      occurrenceId: input.occurrenceId,
      sourceActorId: input.prepared.sourceActor.id,
      targetActorId: input.prepared.targetActor.id,
      sourceCharacterStreamVersion,
      resourceConsumption: resourceReceipt(resource),
      featureResourceConsumption: featureResourceReceipt(
        input.prepared.sourceActor.id,
        featureResource
      ),
      targetFeatureResourceConsumption: targetFeatureResource
        ? featureResourceReceipt(input.prepared.targetActor.id, targetFeatureResource)
        : null,
      d20: input.execution.d20,
      targetTransition: targetBatch.targetTransition,
      applications: targetBatch.receiptApplications
    })
  }
  return { application, sourceActor, targetActor: settledTargetActor, characterTransitions }
}
