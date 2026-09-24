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
      capability.data.usage.refreshBoundary !== 'START_OF_TURN' ||
      beforeUsed > capability.data.usage.maximum
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

export async function prepareEncounterActionEconomy(input: {
  actor: EncounterRunActorState
  state: EncounterRunState
  activation: { code: string; amount: number }
  target?: ActionEconomyTarget
  loadTarget(): Promise<ActionEconomyTarget | undefined>
  definitions: CurrentReusableDefinitionSource
}): Promise<EncounterActionEconomyConsumption | null> {
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
    activeEffectSuppressions: target.activeEffects.flatMap((effect) =>
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
  })
  const capability = capabilityState.capabilities[0]
  const usage = capability?.capability.document.usage
  const beforeUsed = encounterRuleUsageUsed(input.actor, binding.capabilityDefinitionId)
  if (
    !capability ||
    !usage ||
    usage.refreshBoundary !== 'START_OF_TURN' ||
    !capability.available ||
    beforeUsed >= usage.maximum
  )
    throw new Error('The selected action allowance is unavailable.')
  return {
    definitionId: binding.capabilityDefinitionId,
    definitionVersion: capability.capability.definitionVersion,
    definitionChecksum: capability.capability.definitionChecksum,
    maximum: usage.maximum,
    beforeUsed,
    afterUsed: beforeUsed + 1
  }
}
