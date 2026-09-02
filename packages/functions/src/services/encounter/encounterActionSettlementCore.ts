import { randomUUID } from 'node:crypto'

import {
  createActiveRuleEffectRepository,
  createCharacterSheetPlayStateRepository,
  createEncounterRepository,
  createReusableDefinitionRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord
} from '@artificer-toolkit/db'
import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema,
  serverRuleExecutionApplicationOutputsDtoSchema,
  type ServerRuleExecutionApplicationOutputsDto,
  type ServerRuleExecutionNestedD20EvidenceDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { CharacterResolvedActionMechanic } from '@artificer-toolkit/schema/api/characterActionRules'
import type {
  CharacterMechanicsProjection,
  CompiledActionEntryPoint
} from '@artificer-toolkit/schema/projections/characterMechanics'

import { characterRuleActionSystemAdapterRegistry } from '../rules/characterRuleActionSystemAdapterRegistry.js'
import { evaluateCharacterActionStateChange } from '../character/characterActionEvaluation.js'
import { nextApprovedSpellCastSlotUsage } from '../character/sheetCommandReducer.js'
import type {
  CharacterRuleActionActiveEffectPlan,
  CharacterRuleActionExecutionPlan
} from '../rules/characterRuleActionSystemAdapter.js'
import { buildCompiledActionCompilerSource } from '../rules/characterActionEntryPointCompiler.js'
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
import {
  encounterRuleUsageUsed,
  featureChargeUsed,
  withEncounterRuleUsageUsed,
  withFeatureChargeUsed
} from './encounterActorState.js'
import {
  persistEncounterCharacterActionResourceConsumption,
  prepareEncounterCharacterActionState,
  type EncounterCharacterActionResourceConsumption
} from './encounterCharacterActionResource.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import {
  lockedRelationshipActionFacts,
  mergeCanonicalD20Contributors
} from './encounterRelationshipActionFacts.js'
import { actionEconomyCapabilityRegistry } from '../rules/actionEconomyCapabilityRegistry.default.js'
import { resolveEncounterRuleCapabilityStates } from './encounterRuleCapabilityState.js'
import type { EncounterMovementReactionActionSource } from './encounterMovementReactionSources.js'
import type {
  EncounterMovementReactionActionExecution,
  PreparedEncounterMovementReactionAction
} from './encounterMovementReactionActionExecution.js'
import { snapshotStatBlock } from './encounterProjection.js'

type CompleteActionExecution = Extract<
  EncounterMovementReactionActionExecution,
  { kind: 'COMPLETE' }
> & { nestedD20?: ServerRuleExecutionNestedD20EvidenceDto | null }
type LockedCharacter =
  LockedEncounterActiveEffectTargets['lockedCharacters'] extends ReadonlyMap<string, infer TValue>
    ? TValue
    : never

type DirectCharacterSpellCastSource = {
  kind: 'CHARACTER_SPELL_CAST'
  actorId: string
  characterId: string
  characterStreamVersion: number
  entry: Extract<
    CompiledActionEntryPoint,
    { kind: 'CHARACTER_SPELL_CAST'; compilation: { kind: 'COMPILED' } }
  >
  mechanic: CharacterResolvedActionMechanic
}

export type EncounterDirectActionSource =
  | EncounterMovementReactionActionSource
  | DirectCharacterSpellCastSource

function isCharacterDirectSource(
  source: EncounterDirectActionSource
): source is Extract<
  EncounterDirectActionSource,
  { kind: 'CHARACTER_ACTION' | 'CHARACTER_SPELL_CAST' }
> {
  return source.kind === 'CHARACTER_ACTION' || source.kind === 'CHARACTER_SPELL_CAST'
}

export interface PreparedEncounterActionSettlementCore {
  action: PreparedEncounterMovementReactionAction
  actionSource: EncounterDirectActionSource
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
  activeEffectPlan?: CharacterRuleActionActiveEffectPlan | null
  /** Exact plan selected under the Encounter lock for an immutable Feature action. */
  executionPlan?: CharacterRuleActionExecutionPlan | null
  /** Exact System-selected action allowance; absent for FREE/REACTION actions. */
  actionEconomyConsumption?: {
    definitionId: string
    definitionVersion: number
    definitionChecksum: string
    maximum: number
    beforeUsed: number
    afterUsed: number
  } | null
}

function authoredActivation(input: { actionSource: EncounterDirectActionSource }): {
  code: string
  amount: number
} {
  const activation =
    input.actionSource.kind === 'CHARACTER_ACTION'
      ? input.actionSource.candidate.mechanicFacts.invocation.activation
      : input.actionSource.kind === 'CHARACTER_SPELL_CAST'
        ? input.actionSource.mechanic.activation === null
          ? null
          : {
              code: input.actionSource.mechanic.activation.kind,
              amount: input.actionSource.mechanic.activation.amount
            }
        : input.actionSource.capability.mechanicFacts.invocation.activation
  if (
    activation === null ||
    typeof activation.code !== 'string' ||
    activation.amount === null ||
    !Number.isSafeInteger(activation.amount) ||
    activation.amount < 1
  ) {
    throw new EncounterValidationError('The selected action activation is not normalized.')
  }
  return { code: activation.code, amount: activation.amount }
}

export async function prepareActionEconomyConsumption(input: {
  encounter: EncounterRecord
  activation: { code: string; amount: number } | null
  gameSystemId: string
  sourceActor: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
  db: DBLike
}): Promise<PreparedEncounterActionSettlementCore['actionEconomyConsumption']> {
  if (!input.activation || input.encounter.automationMode === 'MANUAL') return null
  const binding = actionEconomyCapabilityRegistry.resolveActionEconomyCapability({
    gameSystemId: input.gameSystemId,
    activationKind: input.activation.code,
    activationAmount: input.activation.amount
  })
  if (binding.kind === 'NONE') return null
  const states = await resolveEncounterRuleCapabilityStates({
    encounter: input.encounter,
    lockedCharacters: input.targets.lockedCharacters,
    activeEffectsByActorId: input.targets.activeEffectsByActorId,
    definitions: createReusableDefinitionRepository(input.db),
    capabilityDefinitionIds: [binding.capabilityDefinitionId]
  })
  const sourceState = states.get(input.sourceActor.id)
  const capability = sourceState?.capabilityState.capabilities.find(
    (candidate) => candidate.capability.capabilityDefinitionId === binding.capabilityDefinitionId
  )
  const usage = capability?.capability.document.usage
  if (
    !capability ||
    capability.capability.document.gameSystemId !== input.gameSystemId ||
    !usage ||
    usage.refreshBoundary !== 'START_OF_TURN'
  ) {
    throw new EncounterConflictError('The selected action allowance is unavailable.')
  }
  const beforeUsed = encounterRuleUsageUsed(input.sourceActor, binding.capabilityDefinitionId)
  if (!capability.available || beforeUsed >= usage.maximum) {
    throw new EncounterConflictError('The selected action allowance is unavailable.')
  }
  return {
    definitionId: binding.capabilityDefinitionId,
    definitionVersion: capability.capability.definitionVersion,
    definitionChecksum: capability.capability.definitionChecksum,
    maximum: usage.maximum,
    beforeUsed,
    afterUsed: beforeUsed + 1
  }
}

/** Applies one already-prepared action allowance under the caller's Encounter lock. */
export async function consumePreparedActionEconomy(input: {
  db: DBLike
  sourceActor: EncounterActorRecord
  consumption: NonNullable<PreparedEncounterActionSettlementCore['actionEconomyConsumption']>
}): Promise<EncounterActorRecord> {
  const currentUsed = encounterRuleUsageUsed(input.sourceActor, input.consumption.definitionId)
  if (
    currentUsed !== input.consumption.beforeUsed ||
    input.consumption.afterUsed !== input.consumption.beforeUsed + 1 ||
    input.consumption.afterUsed > input.consumption.maximum
  ) {
    throw new EncounterConflictError('The selected action allowance changed before settlement.')
  }
  const updatedActor = {
    ...input.sourceActor,
    resources: withEncounterRuleUsageUsed(
      input.sourceActor,
      input.consumption.definitionId,
      input.consumption.afterUsed
    )
  }
  await createEncounterRepository(input.db).updateActor(updatedActor)
  return updatedActor
}

function effectiveCharacterPolicy(character: LockedCharacter) {
  if (character.effectiveRulePolicyOutput) return character.effectiveRulePolicyOutput
  return character.overlay.kind === 'MATERIALIZED'
    ? character.overlay.rulePolicyOutput
    : character.mechanics.rulePolicyOutput
}

function featureActionMechanic(
  action: Extract<EncounterMovementReactionActionSource, { kind: 'ENCOUNTER_FEATURE' }>
): Readonly<Record<string, unknown>> {
  const invocation = action.capability.mechanicFacts.invocation
  const savingThrow = invocation.savingThrow
  const attackKind =
    invocation.triggerCode === 'RANGED_WEAPON_ATTACK'
      ? 'RANGED'
      : invocation.triggerCode === 'MELEE_WEAPON_ATTACK' ||
          invocation.triggerCode === 'UNARMED_ATTACK'
        ? 'MELEE'
        : null
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
    attackBonus: action.capability.attackMechanic?.attackBonus ?? null,
    attackRollMode: action.capability.attackMechanic?.rollMode ?? null,
    attackKind,
    save,
    outcomes: action.capability.mechanicFacts.outcomes
  }
}

/** Prepares one current source/target pair without any reaction policy or usage state. */
export async function prepareEncounterActionSettlementCore<
  TSource extends EncounterDirectActionSource
>(input: {
  db: DBLike
  actorUserId: string
  automationMode: 'AUTOMATIC' | 'ASSISTED'
  encounter: EncounterRecord
  actionSource: TSource
  targetActorId: string
  targets: LockedEncounterActiveEffectTargets
  enforceActionEconomy?: boolean
}): Promise<PreparedEncounterActionSettlementCore & { actionSource: TSource }> {
  const sourceActor = input.encounter.actors.find(
    (actor) => actor.id === input.actionSource.actorId
  )
  const targetActor = input.encounter.actors.find((actor) => actor.id === input.targetActorId)
  if (!sourceActor || !targetActor) {
    throw new EncounterConflictError('The selected Encounter action source or target is stale.')
  }
  const source = isCharacterDirectSource(input.actionSource)
    ? input.targets.lockedCharacters.get(input.actionSource.characterId)
    : null
  if (
    isCharacterDirectSource(input.actionSource) &&
    (!source ||
      sourceActor.kind !== 'CHARACTER' ||
      sourceActor.sourceId !== input.actionSource.characterId ||
      source.actor.id !== sourceActor.id ||
      source.streamVersion !== input.actionSource.characterStreamVersion)
  ) {
    throw new EncounterConflictError('The selected Encounter Character action source is stale.')
  }
  const relationshipActionFacts = lockedRelationshipActionFacts({
    actionEffectId:
      input.actionSource.kind === 'CHARACTER_ACTION'
        ? input.actionSource.candidate.effectId
        : input.actionSource.kind === 'CHARACTER_SPELL_CAST'
          ? input.actionSource.entry.effectId
          : input.actionSource.capability.effectId,
    sourceActorId: sourceActor.id,
    targetActorId: targetActor.id,
    targets: input.targets
  })
  const sourceAttackContributors = (kind: 'MELEE' | 'RANGED') => {
    if (!isCharacterDirectSource(input.actionSource)) return relationshipActionFacts
    return mergeCanonicalD20Contributors(
      effectiveCharacterPolicy(source!).rollContributorEvidence.attacks[kind],
      relationshipActionFacts
    )
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
  const systemId = isCharacterDirectSource(input.actionSource)
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
          overlay: source!.overlay,
          effectivePolicyOutput: source!.effectiveRulePolicyOutput
        })
      : input.actionSource.kind === 'CHARACTER_SPELL_CAST'
        ? { actionMechanic: input.actionSource.mechanic, resourceConsumption: null }
        : {
            actionMechanic: featureActionMechanic(input.actionSource),
            resourceConsumption: null
          }

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
      scalarValues: character.effectiveScalarValues ?? {},
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
      scalarValues: input.targets.effectiveScalarValuesByActorId?.get(current.id) ?? {},
      conditionIds: conditions.ids,
      derivedFacts: {
        targetProtection: actorRule.targetProtection,
        savingThrowDefinitions: actorRule.savingThrowDefinitions ?? [],
        statBlock: snapshotStatBlock(current)
      },
      defenses: actorRule.targetProtection.defenses,
      conditionImmunityIds: actorRule.targetProtection.conditionImmunityIds
    }
  }
  const executionPlan = isCharacterDirectSource(input.actionSource)
    ? input.actionSource.entry.schemaVersion === 4
      ? input.actionSource.entry.compilation.executionPlan.kind === 'SINGLE_GRAPH'
        ? input.actionSource.entry.compilation.executionPlan
        : input.actionSource.entry.compilation.executionPlan
      : {
          kind: 'SINGLE_GRAPH' as const,
          published: input.actionSource.entry.compilation.published
        }
    : (adapter.compileExecutionPlan?.({
        action: input.actionSource.capability,
        compilerSource: buildCompiledActionCompilerSource(input.actionSource.capability)
      }) ?? {
        kind: 'SINGLE_GRAPH' as const,
        published: adapter.compile({ action: input.actionSource.capability })
      })
  const published =
    executionPlan.kind === 'SINGLE_GRAPH' ? executionPlan.published : executionPlan.test.published
  const activeEffectPlans =
    input.actionSource.kind === 'ENCOUNTER_FEATURE'
      ? (adapter.activeEffectPlans?.({
          action: input.actionSource.capability,
          published
        }) ?? [])
      : []
  if (activeEffectPlans.length > 1) {
    throw new EncounterValidationError(
      'Encounter Feature actions support at most one recurring effect.'
    )
  }
  const actionEconomyConsumption = input.enforceActionEconomy
    ? await prepareActionEconomyConsumption({
        db: input.db,
        encounter: input.encounter,
        activation: authoredActivation({ actionSource: input.actionSource }),
        gameSystemId: isCharacterDirectSource(input.actionSource)
          ? (sourceActor.systemId ??
            (() => {
              throw new EncounterValidationError(
                'The selected action System identity is unavailable.'
              )
            })())
          : input.actionSource.capability.gameSystemId,
        sourceActor,
        targets: input.targets
      })
    : null
  return {
    action: {
      adapter,
      published,
      actionMechanic: preparedState.actionMechanic,
      sourceDerivedFacts: isCharacterDirectSource(input.actionSource)
        ? {
            ...effectiveCharacterPolicy(source!),
            rollContributorEvidence: {
              ...(effectiveCharacterPolicy(source!).rollContributorEvidence ?? {}),
              attacks: {
                ...(
                  effectiveCharacterPolicy(source!).rollContributorEvidence as
                    | { attacks?: Record<string, unknown> }
                    | undefined
                )?.attacks,
                MELEE: sourceAttackContributors('MELEE'),
                RANGED: sourceAttackContributors('RANGED')
              }
            }
          }
        : {
            actorId: featureActorRule!.actorId,
            initiativeModifier: featureActorRule!.initiativeModifier,
            savingThrowDefinitions: featureActorRule!.savingThrowDefinitions ?? [],
            targetProtection: featureActorRule!.targetProtection,
            featureResources: featureActorRule!.featureResources,
            statBlock: snapshotStatBlock(sourceActor),
            rollContributorEvidence: {
              attacks: {
                MELEE: sourceAttackContributors('MELEE'),
                RANGED: sourceAttackContributors('RANGED')
              }
            }
          },
      target
    },
    actionSource: input.actionSource,
    sourceActor,
    targetActor: input.targets.encounterActors.get(targetActor.id) ?? targetActor,
    targets: input.targets,
    resourceConsumption: preparedState.resourceConsumption,
    featureResourceConsumption,
    targetFeatureResourceConsumption: null,
    activeEffectPlan: activeEffectPlans[0] ?? null,
    executionPlan,
    actionEconomyConsumption
  }
}

function prepareRecurringActiveEffect(input: {
  encounterId: string
  occurrenceId: string
  commandId: string
  prepared: PreparedEncounterActionSettlementCore
  execution: CompleteActionExecution
}) {
  const plan = input.prepared.activeEffectPlan
  if (!plan) return null
  const published = input.prepared.action.published
  const frozenGraph = plan.frozenGraph
  if (
    plan.authoredEffectId !== published.id ||
    frozenGraph.id !== plan.authoredEffectId ||
    frozenGraph.definition.sourceEntryBindings?.filter(
      (binding) =>
        binding.sourceEntryId === plan.compiledEntryId && binding.nodeId === plan.frozenGraphNodeId
    ).length !== 1
  ) {
    throw new EncounterValidationError('Encounter Feature recurring-effect plan is stale.')
  }
  const conditionContribution = plan.conditionContribution ?? null
  const relationshipContribution = plan.actorRelationshipContribution ?? null
  if (
    relationshipContribution &&
    input.execution.d20?.resultPath !== 'ON_HIT' &&
    input.execution.d20?.resultPath !== 'ON_CRIT'
  )
    return null
  const targetSize = (() => {
    if (input.prepared.targetActor.kind === 'CHARACTER') {
      const characterId = input.prepared.targetActor.sourceId
      return characterId
        ? (input.prepared.targets.lockedCharacters.get(characterId)?.mechanics.initiativeActorFacts
            ?.effectiveSize ?? null)
        : null
    }
    const snapshot = input.prepared.targetActor.snapshot
    const payload =
      snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot.payload : null
    return payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      typeof payload.size === 'string'
      ? payload.size
      : null
  })()
  const sizeRank: Record<string, number> = {
    FINE: 0,
    DIMUNITIVE: 1,
    TINY: 2,
    SMALL: 3,
    MEDIUM: 4,
    LARGE: 5,
    HUGE: 6,
    GARGANTUAN: 7,
    GIANT: 8,
    COLOSSAL: 9
  }
  if (relationshipContribution) {
    const maximum = relationshipContribution.modules.find(
      (module) => module.kind === 'TARGET_SIZE_MAXIMUM'
    )
    if (
      maximum &&
      (targetSize === null ||
        sizeRank[targetSize] === undefined ||
        sizeRank[maximum.sizeCode] === undefined ||
        sizeRank[targetSize] > sizeRank[maximum.sizeCode])
    )
      return null
    const effectsByActor = input.prepared.targets.activeEffectsByActorId
    if (effectsByActor) {
      const sameSourceRelationships = [...effectsByActor.entries()].flatMap(([actorId, effects]) =>
        effects.flatMap((effect) =>
          effect.definition.schemaVersion === 2 &&
          effect.definition.origin.kind === 'ENCOUNTER' &&
          effect.definition.origin.sourceActorId === input.prepared.sourceActor.id
            ? effect.definition.stateContributions.flatMap((contribution) =>
                contribution.kind === 'ACTOR_RELATIONSHIP' ? [{ actorId, contribution }] : []
              )
            : []
        )
      )
      if (
        relationshipContribution.modules.some(
          (module) => module.kind === 'SOURCE_EXCLUSIVE_TARGET'
        ) &&
        sameSourceRelationships.some(({ actorId }) => actorId !== input.prepared.targetActor.id)
      )
        return null
      if (
        relationshipContribution.modules.some(
          (module) =>
            module.kind === 'SOURCE_ACTION_TARGET_RESTRICTION' &&
            module.actionEffectIds.includes(plan.authoredEffectId)
        ) &&
        sameSourceRelationships.some(
          ({ actorId, contribution }) =>
            actorId === input.prepared.targetActor.id &&
            contribution.modules.some(
              (module) =>
                module.kind === 'SOURCE_ACTION_TARGET_RESTRICTION' &&
                module.actionEffectIds.includes(plan.authoredEffectId)
            )
        )
      )
        return null
    }
  }
  const existingEffects = input.prepared.targets.activeEffectsByActorId.get(
    input.prepared.targetActor.id
  )
  if ((conditionContribution || relationshipContribution) && !existingEffects)
    throw new EncounterConflictError('The target active-effect lock is unavailable.')
  const existingConditionContributions: Array<{ baselinePresent: boolean }> = []
  if (conditionContribution) {
    for (const effect of existingEffects ?? []) {
      if (effect.definition.schemaVersion !== 2) continue
      for (const contribution of effect.definition.stateContributions) {
        if (
          contribution.kind === 'CONDITION_OWNERSHIP' &&
          contribution.conditionId === conditionContribution.conditionId
        ) {
          existingConditionContributions.push({
            baselinePresent: contribution.baselinePresent
          })
        }
      }
    }
  }
  const baselinePresent = conditionContribution
    ? existingConditionContributions.length > 0
      ? existingConditionContributions[0]!.baselinePresent
      : input.prepared.action.target.conditionIds.includes(conditionContribution.conditionId)
    : null
  const relationshipConditionIds = relationshipContribution
    ? [
        ...relationshipContribution.conditionIds,
        ...(input.execution.d20?.rollMode === 'ADVANTAGE'
          ? relationshipContribution.modules.flatMap((module) =>
              module.kind === 'CONDITIONAL_TARGET_STATE' ? module.conditionIds : []
            )
          : [])
      ].filter((conditionId, index, values) => values.indexOf(conditionId) === index)
    : []
  if (
    existingConditionContributions.some(
      (contribution) => contribution.baselinePresent !== baselinePresent
    )
  ) {
    throw new EncounterConflictError('The target condition contribution baseline is inconsistent.')
  }
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: conditionContribution || relationshipContribution ? 2 : 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: input.occurrenceId,
      rootCommandId: input.commandId,
      sourceActorId: input.prepared.sourceActor.id
    },
    authoredEffectId: plan.authoredEffectId,
    compiledEntryId: plan.compiledEntryId,
    frozenGraphNodeId: plan.frozenGraphNodeId,
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId: frozenGraph.id,
        gameSystemId: frozenGraph.gameSystemId,
        definitionFamilyKey: frozenGraph.definitionFamilyKey,
        checksum: frozenGraph.checksum
      },
      capabilityContractVersion: plan.capabilityContractVersion,
      factContracts: [],
      nodes: frozenGraph.definition.nodes,
      outputs: frozenGraph.definition.outputs,
      sourceEntryBindings: frozenGraph.definition.sourceEntryBindings
    },
    adapterFacts: plan.adapterFacts,
    perceptionContributions: plan.perceptionContributions,
    recurrence: {
      recurrenceStage: plan.recurrenceStage,
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: 'ENCOUNTER',
      expiration:
        plan.initialRemaining === null
          ? { kind: 'INDEFINITE' }
          : {
              kind: 'TICKS',
              initialRemaining: plan.initialRemaining,
              decrementStage: plan.recurrenceStage
            }
    },
    ...(conditionContribution || relationshipContribution
      ? {
          stateContributions: [
            ...(conditionContribution
              ? [
                  {
                    kind: 'CONDITION_OWNERSHIP' as const,
                    conditionId: conditionContribution.conditionId,
                    baselinePresent
                  }
                ]
              : []),
            ...relationshipConditionIds.map((conditionId) => ({
              kind: 'CONDITION_OWNERSHIP' as const,
              conditionId,
              baselinePresent: input.prepared.action.target.conditionIds.includes(conditionId)
            })),
            ...(relationshipContribution
              ? [
                  {
                    kind: 'ACTOR_RELATIONSHIP' as const,
                    relationshipOutcomeId: relationshipContribution.relationshipOutcomeId,
                    modules: relationshipContribution.modules,
                    conditionIds: [
                      ...relationshipContribution.conditionIds,
                      ...(input.execution.d20?.rollMode === 'ADVANTAGE'
                        ? relationshipContribution.modules.flatMap((module) =>
                            module.kind === 'CONDITIONAL_TARGET_STATE' ? module.conditionIds : []
                          )
                        : [])
                    ],
                    capabilitySuppressions: [
                      ...relationshipContribution.capabilitySuppressions,
                      ...(input.execution.d20?.rollMode === 'ADVANTAGE'
                        ? relationshipContribution.modules.flatMap((module) =>
                            module.kind === 'CONDITIONAL_TARGET_STATE'
                              ? [
                                  {
                                    contributionId: module.id,
                                    capabilityDefinitionIds: module.capabilityDefinitionIds
                                  }
                                ]
                              : []
                          )
                        : [])
                    ]
                  }
                ]
              : [])
          ]
        }
      : {})
  })
  return {
    definition,
    lifecycle: activeRuleEffectLifecycleDtoSchema.parse({
      schemaVersion: 1,
      remainingTicks: plan.initialRemaining
    })
  }
}

/** Adds one already-revalidated target-owned Feature charge transition. */
export function withTargetEncounterFeatureResourceConsumption<
  TSource extends EncounterDirectActionSource
>(input: {
  prepared: PreparedEncounterActionSettlementCore & { actionSource: TSource }
  consumption: NonNullable<
    PreparedEncounterActionSettlementCore['targetFeatureResourceConsumption']
  >
}): PreparedEncounterActionSettlementCore & { actionSource: TSource } {
  if (
    !Number.isSafeInteger(input.consumption.cost) ||
    input.consumption.cost < 1 ||
    input.consumption.afterUsed !== input.consumption.beforeUsed + input.consumption.cost ||
    input.consumption.beforeRemaining < input.consumption.cost ||
    input.consumption.afterRemaining !== input.consumption.beforeRemaining - input.consumption.cost
  ) {
    throw new EncounterConflictError('The target Encounter feature resource transition is invalid.')
  }
  return {
    ...input.prepared,
    targetFeatureResourceConsumption: input.consumption
  }
}

function resourcePolicyOverride(consumption: EncounterCharacterActionResourceConsumption) {
  return {
    base: {
      input: consumption.nextBaseState.facts,
      output: consumption.nextBaseState.output
    },
    overlay: consumption.nextOverlayState
      ? {
          input: consumption.nextOverlayState.facts,
          output: consumption.nextOverlayState.output
        }
      : null
  }
}

async function spellCastPolicyOverride(input: {
  db: DBLike
  character: LockedCharacter
  nextSpellSlots: NonNullable<CharacterMechanicsProjection['commandState']['state']['spellSlots']>
}) {
  const resourceUsage = await createCharacterSheetPlayStateRepository(input.db).listResourceUsage(
    input.character.id
  )
  const base = await evaluateCharacterActionStateChange({
    db: input.db,
    committed: {
      binding: { revisionId: input.character.mechanics.ruleRevisionId },
      facts: input.character.mechanics.rulePolicyInput,
      output: input.character.mechanics.rulePolicyOutput
    },
    resourceUsage,
    spellSlotUsage: input.nextSpellSlots
  })
  const overlay =
    input.character.overlay.kind === 'MATERIALIZED'
      ? await evaluateCharacterActionStateChange({
          db: input.db,
          committed: {
            binding: { revisionId: input.character.mechanics.ruleRevisionId },
            facts: input.character.overlay.rulePolicyInput,
            output: input.character.overlay.rulePolicyOutput
          },
          resourceUsage,
          spellSlotUsage: input.nextSpellSlots
        })
      : null
  return {
    base: { input: base.ruleEvaluation.facts, output: base.ruleEvaluation.output },
    overlay: overlay
      ? { input: overlay.ruleEvaluation.facts, output: overlay.ruleEvaluation.output }
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

function spellCastReceipt(input: {
  source: DirectCharacterSpellCastSource | null
  beforeSpellSlots: CharacterMechanicsProjection['commandState']['state']['spellSlots']
}) {
  if (!input.source) return null
  const slotKey = input.source.entry.spell.slotKey
  const beforeUsed = slotKey
    ? ((input.beforeSpellSlots ?? []).find((slot) => slot.slotKey === slotKey)?.used ?? 0)
    : null
  return {
    spellId: input.source.entry.spell.spellId,
    spellVersionId: input.source.entry.spell.versionId,
    spellVersion: input.source.entry.spell.version,
    spellChecksum: input.source.entry.spell.checksum,
    candidateId: input.source.entry.actionId,
    slotKey,
    beforeUsed,
    afterUsed: beforeUsed === null ? null : beforeUsed + 1
  }
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

function prepareTargetStateEffect(input: {
  encounterId: string
  occurrenceId: string
  commandId: string
  prepared: PreparedEncounterActionSettlementCore
  execution: CompleteActionExecution
}) {
  const contributions = input.execution.applications.filter(
    (
      application
    ): application is Extract<
      (typeof input.execution.applications)[number],
      { kind: 'HIT_POINT_MAXIMUM_REDUCTION' | 'SCALAR_REDUCTION' }
    > =>
      application.kind === 'HIT_POINT_MAXIMUM_REDUCTION' || application.kind === 'SCALAR_REDUCTION'
  )
  if (contributions.length === 0) return null
  if (contributions.length !== 1)
    throw new EncounterValidationError(
      'An action may create at most one target state contribution.'
    )
  const contribution = contributions[0]!
  const evidence = input.execution.execution.evidence
  const published = input.prepared.action.published
  if (
    evidence.source.definitionId !== published.id ||
    evidence.source.gameSystemId !== published.gameSystemId ||
    evidence.source.definitionFamilyKey !== published.definitionFamilyKey ||
    evidence.source.checksum !== published.checksum
  )
    throw new EncounterConflictError('The active-effect source graph changed before settlement.')
  const bindings = (evidence.sourceEntryBindings ?? []).filter(
    (binding) => binding.nodeId === contribution.sourceNodeId
  )
  if (bindings.length !== 1)
    throw new EncounterValidationError(
      'The target state contribution must retain one exact compiled source binding.'
    )
  const binding = bindings[0]!
  const graphNode = published.definition.nodes.find((node) => node.id === binding.nodeId)
  if (!graphNode || graphNode.operation.key !== contribution.sourceOperationKey)
    throw new EncounterValidationError('The target state contribution source binding is stale.')
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 2,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: input.occurrenceId,
      rootCommandId: input.commandId,
      sourceActorId: input.prepared.sourceActor.id
    },
    authoredEffectId: published.id,
    compiledEntryId: binding.sourceEntryId,
    frozenGraphNodeId: binding.nodeId,
    frozenGraph: {
      schemaVersion: 1,
      source: evidence.source,
      capabilityContractVersion: evidence.capabilityContractVersion,
      factContracts: [],
      nodes: published.definition.nodes,
      outputs: published.definition.outputs,
      sourceEntryBindings: evidence.sourceEntryBindings,
      ...(evidence.vocabularyBindings ? { vocabularyBindings: evidence.vocabularyBindings } : {})
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: input.prepared.targetActor.kind === 'CHARACTER' ? 'OWNER' : 'ENCOUNTER',
      expiration: { kind: 'INDEFINITE' }
    },
    stateContributions: [
      contribution.kind === 'HIT_POINT_MAXIMUM_REDUCTION'
        ? {
            kind: 'HIT_POINT_MAXIMUM_REDUCTION' as const,
            amount: contribution.reductionAmount,
            sourceDamageOutcomeId: contribution.sourceDamageOutcomeId,
            sourceDamageNodeId: contribution.sourceDamageNodeId,
            sourceDamageOperationKey: contribution.sourceDamageOperationKey,
            recoveryTags: contribution.recoveryTags
          }
        : {
            kind: 'SCALAR_REDUCTION' as const,
            valueDefinitionId: contribution.valueDefinitionId,
            amount: contribution.reductionAmount,
            stacking: contribution.stacking,
            floor: contribution.floor,
            recoveryTriggers: contribution.recoveryTriggers,
            terminalConsequence: contribution.terminalConsequence,
            sourceOutcomeId: contribution.sourceOutcomeId,
            sourceNodeId: contribution.sourceNodeId,
            sourceOperationKey: contribution.sourceOperationKey
          }
    ]
  })
  return {
    definition,
    lifecycle: activeRuleEffectLifecycleDtoSchema.parse({
      schemaVersion: 1,
      remainingTicks: null
    })
  }
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
  const sourceCharacter = isCharacterDirectSource(input.prepared.actionSource)
    ? (input.prepared.targets.lockedCharacters.get(input.prepared.actionSource.characterId) ?? null)
    : null
  const resource = input.prepared.resourceConsumption
  const featureResource = input.prepared.featureResourceConsumption ?? null
  const targetFeatureResource = input.prepared.targetFeatureResourceConsumption ?? null
  const actionEconomy = input.prepared.actionEconomyConsumption ?? null
  const spellCast =
    input.prepared.actionSource.kind === 'CHARACTER_SPELL_CAST' ? input.prepared.actionSource : null
  const stateEffectPlan = prepareTargetStateEffect({
    encounterId: input.encounterId,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    prepared: input.prepared,
    execution: input.execution
  })
  const recurringEffectPlan = prepareRecurringActiveEffect({
    encounterId: input.encounterId,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    prepared: input.prepared,
    execution: input.execution
  })
  const relationshipConditionApplications =
    recurringEffectPlan?.definition.schemaVersion === 2
      ? recurringEffectPlan.definition.stateContributions.flatMap((contribution) =>
          contribution.kind === 'CONDITION_OWNERSHIP' &&
          !contribution.baselinePresent &&
          !input.prepared.action.target.conditionIds.includes(contribution.conditionId)
            ? [
                {
                  kind: 'CONDITION_APPLY' as const,
                  targetActorId: input.prepared.targetActor.id,
                  conditionId: contribution.conditionId,
                  sourceNodeId:
                    recurringEffectPlan.definition.frozenGraph.sourceEntryBindings?.find(
                      (binding) =>
                        binding.sourceEntryId === recurringEffectPlan.definition.compiledEntryId
                    )?.nodeId ?? recurringEffectPlan.definition.frozenGraphNodeId,
                  sourceOperationKey: 'dnd5e.actor-relationship-state',
                  authoredPath: 'ON_HIT',
                  resolvedPath: 'ON_HIT'
                }
              ]
            : []
        )
      : []
  const settlementApplications = [
    ...input.execution.applications,
    ...relationshipConditionApplications
  ]
  let createdStateEffect: Awaited<
    ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['create']>
  > | null = null
  let createdRecurringEffect: Awaited<
    ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['create']>
  > | null = null
  const createStateEffect = async (db: DBLike) => {
    if (!stateEffectPlan) return
    if (createdStateEffect !== null)
      throw new EncounterConflictError('The target state effect was created twice.')
    createdStateEffect = await createActiveRuleEffectRepository(db).create({
      id: randomUUID(),
      owner:
        input.prepared.targetActor.kind === 'CHARACTER'
          ? {
              kind: 'CHARACTER',
              characterId:
                input.prepared.targetActor.sourceId ??
                (() => {
                  throw new EncounterConflictError(
                    'The Encounter Character effect owner is incomplete.'
                  )
                })()
            }
          : {
              kind: 'ENCOUNTER_ACTOR',
              encounterId: input.encounterId,
              targetActorId: input.prepared.targetActor.id
            },
      definition: stateEffectPlan.definition,
      lifecycle: stateEffectPlan.lifecycle
    })
  }
  const stateEffectReceipt = () => {
    if (!createdStateEffect) return []
    const contribution =
      createdStateEffect.definition.schemaVersion === 2
        ? createdStateEffect.definition.stateContributions[0]
        : null
    if (
      !contribution ||
      (contribution.kind !== 'HIT_POINT_MAXIMUM_REDUCTION' &&
        contribution.kind !== 'SCALAR_REDUCTION')
    )
      throw new EncounterConflictError('The created state effect has an invalid contribution.')
    return [
      {
        kind: 'CREATE' as const,
        owner:
          createdStateEffect.owner.kind === 'CHARACTER'
            ? {
                kind: 'CHARACTER' as const,
                characterId: createdStateEffect.owner.characterId
              }
            : {
                kind: 'ENCOUNTER_ACTOR' as const,
                encounterId: createdStateEffect.owner.encounterId,
                targetActorId: createdStateEffect.owner.targetActorId
              },
        activeEffectId: createdStateEffect.id,
        createdOrdinal: createdStateEffect.createdOrdinal,
        afterVersion: createdStateEffect.version,
        authoredEffectId: createdStateEffect.definition.authoredEffectId,
        compiledEntryId: createdStateEffect.definition.compiledEntryId,
        frozenGraphNodeId: createdStateEffect.definition.frozenGraphNodeId,
        definitionChecksum: createdStateEffect.definitionChecksum,
        lifecycleChecksum: createdStateEffect.lifecycleChecksum,
        frozenSourceChecksum: createdStateEffect.definition.frozenGraph.source.checksum,
        capabilityContractVersion:
          createdStateEffect.definition.frozenGraph.capabilityContractVersion,
        contribution
      }
    ]
  }
  const createRecurringEffect = async (db: DBLike) => {
    if (!recurringEffectPlan) return
    if (
      !(
        recurringEffectPlan.definition.schemaVersion === 2 &&
        recurringEffectPlan.definition.stateContributions.some(
          (contribution) => contribution.kind === 'ACTOR_RELATIONSHIP'
        )
      ) &&
      !input.execution.applications.some((application) => application.kind === 'CONDITION_APPLY')
    ) {
      return
    }
    if (createdRecurringEffect !== null)
      throw new EncounterConflictError('The recurring active effect was created twice.')
    createdRecurringEffect = await createActiveRuleEffectRepository(db).create({
      id: randomUUID(),
      owner:
        input.prepared.targetActor.kind === 'CHARACTER'
          ? {
              kind: 'CHARACTER',
              characterId:
                input.prepared.targetActor.sourceId ??
                (() => {
                  throw new EncounterConflictError(
                    'The recurring effect Character owner is incomplete.'
                  )
                })()
            }
          : {
              kind: 'ENCOUNTER_ACTOR',
              encounterId: input.encounterId,
              targetActorId: input.prepared.targetActor.id
            },
      definition: recurringEffectPlan.definition,
      lifecycle: recurringEffectPlan.lifecycle
    })
  }
  const recurringEffectReceipt = () => {
    if (!createdRecurringEffect) return []
    return [
      {
        kind: 'CREATE' as const,
        activeEffectId: createdRecurringEffect.id,
        targetActorId: input.prepared.targetActor.id,
        createdOrdinal: createdRecurringEffect.createdOrdinal,
        afterVersion: createdRecurringEffect.version,
        authoredEffectId: createdRecurringEffect.definition.authoredEffectId,
        compiledEntryId: createdRecurringEffect.definition.compiledEntryId,
        frozenGraphNodeId: createdRecurringEffect.definition.frozenGraphNodeId,
        definitionChecksum: createdRecurringEffect.definitionChecksum,
        lifecycleChecksum: createdRecurringEffect.lifecycleChecksum,
        frozenSourceChecksum: createdRecurringEffect.definition.frozenGraph.source.checksum,
        capabilityContractVersion:
          createdRecurringEffect.definition.frozenGraph.capabilityContractVersion,
        recurrenceStage: createdRecurringEffect.definition.recurrence.recurrenceStage,
        remainingTicks: createdRecurringEffect.lifecycle.remainingTicks
      }
    ]
  }
  let sourceActor = input.prepared.sourceActor
  let settledTargetActor = input.prepared.targetActor
  let sourceCharacterStreamVersion: number | null = null
  const spellCastNextSlots =
    spellCast && sourceCharacter
      ? nextApprovedSpellCastSlotUsage(
          sourceCharacter.mechanics.commandState.state.spellSlots,
          spellCast.entry.spell.slotKey
        )
      : undefined
  const spellCastOverride =
    spellCast && sourceCharacter && spellCastNextSlots
      ? await spellCastPolicyOverride({
          db: input.db,
          character: sourceCharacter,
          nextSpellSlots: spellCastNextSlots
        })
      : undefined
  const characterTransitions: Array<{
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }> = []
  if (
    (resource || spellCast) &&
    sourceCharacter &&
    input.prepared.targetActor.id !== input.prepared.sourceActor.id
  ) {
    const policyOverride = resource ? resourcePolicyOverride(resource) : spellCastOverride
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
      effectiveScalarValues: sourceCharacter.effectiveScalarValues,
      conditionDefinitions: sourceCharacter.conditionDefinitions,
      applications: [],
      forceVersionAdvance: true,
      ...(spellCastNextSlots ? { spellSlotUsage: spellCastNextSlots } : {}),
      ...(policyOverride ? { policyOverride } : {}),
      afterPersist: async ({ db }) => {
        if (resource) {
          await persistEncounterCharacterActionResourceConsumption({
            db,
            actorUserId: input.actorUserId,
            characterId: sourceCharacter.id,
            consumption: resource
          })
        }
      }
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
      effectiveScalarValues: targetCharacter.effectiveScalarValues,
      conditionDefinitions: targetCharacter.conditionDefinitions,
      applications: settlementApplications,
      forceVersionAdvance: sameSource && (resource !== null || spellCast !== null),
      ...(sameSource && (resource || spellCast)
        ? {
            ...(resource
              ? { policyOverride: resourcePolicyOverride(resource) }
              : spellCastOverride
                ? { policyOverride: spellCastOverride }
                : {}),
            ...(spellCastNextSlots ? { spellSlotUsage: spellCastNextSlots } : {}),
            afterPersist: async ({ db }: { db: DBLike }) => {
              if (resource) {
                await persistEncounterCharacterActionResourceConsumption({
                  db,
                  actorUserId: input.actorUserId,
                  characterId: sourceCharacter!.id,
                  consumption: resource
                })
              }
              await createStateEffect(db)
            }
          }
        : stateEffectPlan
          ? {
              afterPersist: async ({ db }: { db: DBLike }) => createStateEffect(db)
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
    await createRecurringEffect(input.db)
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
      spellCastConsumption: spellCastReceipt({
        source: spellCast,
        beforeSpellSlots: sourceCharacter?.mechanics.commandState.state.spellSlots
      }),
      featureResourceConsumption: featureResourceReceipt(
        input.prepared.sourceActor.id,
        featureResource
      ),
      targetFeatureResourceConsumption: targetFeatureResource
        ? featureResourceReceipt(input.prepared.targetActor.id, targetFeatureResource)
        : null,
      activeEffectTransitions: recurringEffectReceipt().map((transition) => {
        if (createdRecurringEffect?.owner.kind !== 'CHARACTER') {
          throw new EncounterConflictError('The Character recurring effect owner is invalid.')
        }
        const { targetActorId: _targetActorId, ...receipt } = transition
        return {
          ...receipt,
          characterId: createdRecurringEffect.owner.characterId,
          sourceEncounterId: input.encounterId,
          maintainedEffectStateId: null
        }
      }),
      stateEffectTransitions: stateEffectReceipt(),
      maintenanceTransition: null,
      d20: input.execution.d20,
      nestedD20: input.execution.nestedD20 ?? null,
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
      effectiveScalarValues:
        input.prepared.targets.effectiveScalarValuesByActorId?.get(input.prepared.targetActor.id) ??
        {},
      applications: settlementApplications
    })
    await createStateEffect(input.db)
    await createRecurringEffect(input.db)
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
      spellCastConsumption: spellCastReceipt({
        source: spellCast,
        beforeSpellSlots: sourceCharacter?.mechanics.commandState.state.spellSlots
      }),
      featureResourceConsumption: featureResourceReceipt(
        input.prepared.sourceActor.id,
        featureResource
      ),
      targetFeatureResourceConsumption: targetFeatureResource
        ? featureResourceReceipt(input.prepared.targetActor.id, targetFeatureResource)
        : null,
      d20: input.execution.d20,
      nestedD20: input.execution.nestedD20 ?? null,
      activeEffectTransitions: recurringEffectReceipt(),
      stateEffectTransitions: stateEffectReceipt(),
      targetTransition: targetBatch.targetTransition,
      applications: targetBatch.receiptApplications
    })
  }
  if (actionEconomy !== null) {
    const actionEconomySource =
      settledTargetActor.id === sourceActor.id ? settledTargetActor : sourceActor
    sourceActor = await consumePreparedActionEconomy({
      db: input.db,
      sourceActor: actionEconomySource,
      consumption: actionEconomy
    })
    if (settledTargetActor.id === sourceActor.id) settledTargetActor = sourceActor
  }
  return {
    application,
    sourceActor,
    targetActor: settledTargetActor,
    characterTransitions
  }
}
