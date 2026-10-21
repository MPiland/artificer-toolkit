import { heldConditionIds } from './encounterInnateConditions.js'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnActionEconomyRefreshDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import { ruleCapabilityReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { actionEconomyCapabilityRegistry } from './platformPolicyModules.js'
import { activeSetValueGrantMaximum } from './character/activeEffectGrantTotals.js'
import {
  encounterActiveGrantCapabilitySuppressions,
  encounterGrantsEnabledDomain
} from './encounterActiveGrants.js'
import { encounterRuleUsageUsed, withEncounterRuleUsageUsed } from './encounterActorState.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import {
  resolveRuleCapabilityState,
  type CurrentReusableDefinitionSource
} from './ruleCapabilityStateService.js'

import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'

type ActionEconomyTarget = Pick<
  MovementTarget,
  'actor' | 'state' | 'innateConditionIds' | 'activeEffects' | 'effectiveRulePolicyOutput'
>

/** The capabilities an actor's active relationship effects and grants (D99) suppress. */
export function activeEffectCapabilitySuppressions(
  gameSystemId: string,
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
) {
  return [
    ...effects.flatMap((effect) =>
      effect.definition.stateContributions.flatMap((contribution) =>
        contribution.kind === 'ACTOR_RELATIONSHIP'
          ? contribution.capabilitySuppressions.map((suppression) => ({
              activeEffectId: effect.id,
              contributionId: suppression.contributionId,
              capabilityDefinitionIds: suppression.capabilityDefinitionIds
            }))
          : []
      )
    ),
    ...encounterActiveGrantCapabilitySuppressions(gameSystemId, effects)
  ]
}
export async function stageEncounterActionEconomyRefreshes(input: {
  actor: EncounterRunActorState
  state: EncounterRunState
  definitions: CurrentReusableDefinitionSource
}): Promise<{
  refreshes: TurnActionEconomyRefreshDto[]
  refreshedActor: EncounterRunActorState | null
}> {
  if (
    input.actor.encounterId !== input.state.id ||
    input.actor.systemId !== input.state.gameSystemId
  )
    throw new Error('Encounter action-economy refresh actor is stale.')
  let actor = input.actor
  const refreshes: TurnActionEconomyRefreshDto[] = []
  for (const definitionId of actionEconomyCapabilityRegistry
    .require(input.state.gameSystemId)
    .refreshCapabilityDefinitionIds()) {
    const beforeUsed = encounterRuleUsageUsed(actor, definitionId)
    if (beforeUsed === 0) continue
    const definition = await input.definitions.requireCurrent(definitionId)
    const capability = ruleCapabilityReusableDefinitionDocumentDtoSchema.safeParse(
      definition.document
    )
    if (
      definition.id !== definitionId ||
      definition.gameSystemId !== input.state.gameSystemId ||
      definition.definitionFamilyKey !== 'rule-capability' ||
      !capability.success ||
      capability.data.id !== definitionId ||
      !capability.data.usage ||
      capability.data.usage.refreshBoundary !== 'START_OF_TURN'
    )
      throw new Error('Encounter action-economy refresh definition is unavailable or stale.')
    refreshes.push({
      ordinal: refreshes.length,
      actorId: actor.id,
      capabilityDefinitionId: definitionId,
      definitionVersion: definition.version,
      definitionChecksum: definition.checksum,
      beforeUsed,
      afterUsed: 0
    })
    actor = encounterRunActorStateSchema.parse({
      ...actor,
      resources: withEncounterRuleUsageUsed(actor, definitionId, 0)
    })
  }
  return { refreshes, refreshedActor: refreshes.length ? actor : null }
}

export type ActionEconomyInput = {
  actor: EncounterRunActorState
  state: EncounterRunState
  activation: { code: string; amount: number }
  target?: ActionEconomyTarget
  loadTarget(): Promise<ActionEconomyTarget | undefined>
  definitions: CurrentReusableDefinitionSource
}

/** The allowance capability an activation binds to, resolved against the actor's conditions and effects. */
async function resolveActionAllowance(input: ActionEconomyInput) {
  if (input.state.automationMode === 'MANUAL') return null
  const binding = actionEconomyCapabilityRegistry
    .require(input.state.gameSystemId)
    .resolveActionEconomyCapability({
      activationKind: input.activation.code,
      activationAmount: input.activation.amount
    })
  if (binding.kind === 'NONE') return null
  if (
    input.actor.encounterId !== input.state.id ||
    input.actor.systemId !== input.state.gameSystemId
  )
    throw new Error('Encounter action economy source is stale.')
  const target = input.target ?? (await input.loadTarget())
  if (!target) throw new Error('Encounter action economy source is stale.')
  if (
    (target.actor !== input.actor &&
      checksumCanonicalJson(target.actor) !== checksumCanonicalJson(input.actor)) ||
    target.actor.encounterId !== input.state.id ||
    target.actor.systemId !== input.state.gameSystemId
  )
    throw new Error('Encounter action economy source is stale.')
  const capabilityState = await resolveRuleCapabilityState({
    definitions: input.definitions,
    gameSystemId: input.state.gameSystemId,
    activeConditionDefinitionIds: heldConditionIds(target),
    capabilityDefinitionIds: [binding.capabilityDefinitionId],
    activeEffectSuppressions: activeEffectCapabilitySuppressions(
      input.state.gameSystemId,
      target.activeEffects
    )
  })
  const capability = capabilityState.capabilities[0]
  const usage = capability?.capability.document.usage
  if (!capability || !usage || usage.refreshBoundary !== 'START_OF_TURN')
    throw new Error('The selected action allowance is unavailable.')
  const granted = binding.grantedCountDomain
    ? activeSetValueGrantMaximum(target.activeEffects, binding.grantedCountDomain)
    : null
  return {
    definitionId: binding.capabilityDefinitionId,
    capability,
    maximum: Math.max(usage.maximum, granted ?? 0),
    beforeUsed: encounterRuleUsageUsed(input.actor, binding.capabilityDefinitionId),
    excludedBySibling:
      binding.exclusiveWithCapabilityDefinitionId !== undefined &&
      encounterGrantsEnabledDomain(target.activeEffects, 'ACTION_BONUS_ACTION_EXCLUSIVITY') &&
      encounterRuleUsageUsed(input.actor, binding.exclusiveWithCapabilityDefinitionId) > 0
  }
}

/**
 * The allowance an action uses. An exhausted or suppressed allowance is still returned, marked
 * unavailable; only Assisted actions may override it (`prepareEncounterActionEconomy` refuses).
 */
export async function evaluateEncounterActionEconomy(
  input: ActionEconomyInput
): Promise<{ consumption: EncounterActionEconomyConsumption; available: boolean } | null> {
  const allowance = await resolveActionAllowance(input)
  if (!allowance) return null
  const { capability, maximum, beforeUsed, excludedBySibling } = allowance
  return {
    consumption: {
      definitionId: allowance.definitionId,
      definitionVersion: capability.capability.definitionVersion,
      definitionChecksum: capability.capability.definitionChecksum,
      maximum,
      beforeUsed,
      afterUsed: beforeUsed + 1
    },
    available: capability.available && beforeUsed < maximum && !excludedBySibling
  }
}

/**
 * Whether a condition or effect suppresses the allowance this activation binds to, ignoring how much
 * of it is spent. An attack that fills an open Attack action spends nothing, but a suppressed actor
 * still cannot make it.
 */
export async function isActionEconomySuppressed(input: ActionEconomyInput): Promise<boolean> {
  const allowance = await resolveActionAllowance(input)
  return allowance ? !allowance.capability.available : false
}

/** The allowance for flows without overrides (movement, Disarm): an unavailable one is refused. */
export async function prepareEncounterActionEconomy(
  input: ActionEconomyInput
): Promise<EncounterActionEconomyConsumption | null> {
  const evaluated = await evaluateEncounterActionEconomy(input)
  if (evaluated && !evaluated.available)
    throw new Error('The selected action allowance is unavailable.')
  return evaluated?.consumption ?? null
}
