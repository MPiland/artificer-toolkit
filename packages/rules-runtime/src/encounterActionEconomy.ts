import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnActionEconomyRefreshDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import { ruleCapabilityReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { actionEconomyCapabilityRegistry } from './actionEconomyCapabilityRegistry.default.js'
import { encounterRuleUsageUsed, withEncounterRuleUsageUsed } from './encounterActorState.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import {
  resolveRuleCapabilityState,
  type CurrentReusableDefinitionSource
} from './ruleCapabilityStateService.js'

import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'

type ActionEconomyTarget = Pick<MovementTarget, 'actor' | 'state' | 'activeEffects'>

/** The capabilities an actor's active relationship effects suppress. */
export function activeEffectCapabilitySuppressions(effects: ActionEconomyTarget['activeEffects']) {
  return effects.flatMap((effect) =>
    effect.definition.schemaVersion === 2
      ? effect.definition.stateContributions.flatMap((contribution) =>
          contribution.kind === 'ACTOR_RELATIONSHIP'
            ? contribution.capabilitySuppressions.map((suppression) => ({
                activeEffectId: effect.id,
                contributionId: suppression.contributionId,
                capabilityDefinitionIds: suppression.capabilityDefinitionIds
              }))
            : []
        )
      : []
  )
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
  for (const definitionId of actionEconomyCapabilityRegistry.requireRefreshCapabilityDefinitionIds(
    input.state.gameSystemId
  )) {
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

type ActionEconomyInput = {
  actor: EncounterRunActorState
  state: EncounterRunState
  activation: { code: string; amount: number }
  target?: ActionEconomyTarget
  loadTarget(): Promise<ActionEconomyTarget | undefined>
  definitions: CurrentReusableDefinitionSource
}

/**
 * The allowance an action uses. An exhausted or suppressed allowance is still returned, marked
 * unavailable; only Assisted actions may override it (`prepareEncounterActionEconomy` refuses).
 */
export async function evaluateEncounterActionEconomy(
  input: ActionEconomyInput
): Promise<{ consumption: EncounterActionEconomyConsumption; available: boolean } | null> {
  if (input.state.automationMode === 'MANUAL') return null
  const binding = actionEconomyCapabilityRegistry.resolveActionEconomyCapability({
    gameSystemId: input.state.gameSystemId,
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
    activeConditionDefinitionIds: target.state.conditions,
    capabilityDefinitionIds: [binding.capabilityDefinitionId],
    activeEffectSuppressions: activeEffectCapabilitySuppressions(target.activeEffects)
  })
  const capability = capabilityState.capabilities[0]
  const usage = capability?.capability.document.usage
  const beforeUsed = encounterRuleUsageUsed(input.actor, binding.capabilityDefinitionId)
  if (!capability || !usage || usage.refreshBoundary !== 'START_OF_TURN')
    throw new Error('The selected action allowance is unavailable.')
  return {
    consumption: {
      definitionId: binding.capabilityDefinitionId,
      definitionVersion: capability.capability.definitionVersion,
      definitionChecksum: capability.capability.definitionChecksum,
      maximum: usage.maximum,
      beforeUsed,
      afterUsed: beforeUsed + 1
    },
    available: capability.available && beforeUsed < usage.maximum
  }
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
