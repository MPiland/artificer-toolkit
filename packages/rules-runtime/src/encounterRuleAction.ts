import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { activeOptionalCombatDefinitions } from '@artificer-toolkit/schema/shared/optionalCombat'
import { compileEffect } from '@artificer-toolkit/shared/compilers'

import { normalizeCharacterActionMechanicFacts } from './character/characterActionRuleFacts.js'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import { bindEncounterEffect } from './encounterFeatureActionCapabilityDiscovery.js'

/**
 * The server-only capability of an Effect an optional combat rule raises as its own action (a
 * rule-owned source): the rule, never a player, decides when it runs and on whom. It costs its
 * actor nothing, since the actor did not choose to act.
 */
export interface EncounterRuleActionCapabilityDescriptor extends EffectActionCapabilityDescriptor {
  kind: 'RULE'
  encounterActorId: string
  definitionId: string
  definitionVersion: number
  definitionChecksum: string
  label: string
}

const ACTION_ID_SEPARATOR = ':RULE:'

/** The identity of one rule-raised Effect for one actor (the `actionId` of RESOLVE_ACTION). */
export function encounterRuleActionId(
  actorId: string,
  definitionId: string,
  effectId: string
): string {
  return `${actorId}${ACTION_ID_SEPARATOR}${definitionId}:${effectId}`
}

/** The rule definition and raised Effect a rule action id names; null for any other id. */
export function parseEncounterRuleActionId(actorId: string, actionId: string) {
  if (!actionId.startsWith(`${actorId}${ACTION_ID_SEPARATOR}`)) return null
  const [definitionId, effectId, ...rest] = actionId
    .slice(actorId.length + ACTION_ID_SEPARATOR.length)
    .split(':')
  if (!definitionId || !effectId || rest.length > 0) return null
  return { definitionId, effectId }
}

/**
 * The rule-raised Effect a rule action id names, read from the Run's active optional combat
 * definitions: a rule that is off, a MANUAL Run or an Effect the definition no longer raises makes
 * the id stale. It compiles like any authored action and runs through the normal pipeline.
 */
export function discoverEncounterRuleAction(input: {
  actorId: string
  actionId: string
  gameSystemId: string
  state: Pick<EncounterRunState, 'automationMode' | 'optionalCombatSnapshot'>
  conditionDefinitionIds: readonly string[]
  abilityDefinitions: readonly { id: string; code: string }[]
}): EncounterRuleActionCapabilityDescriptor {
  const parsed = parseEncounterRuleActionId(input.actorId, input.actionId)
  const definition = activeOptionalCombatDefinitions({
    automationMode: input.state.automationMode,
    snapshot: input.state.optionalCombatSnapshot
  }).find((value) => value.definitionId === parsed?.definitionId)
  const effect = definition?.document.raisedEffects?.find((value) => value.id === parsed?.effectId)
  if (!definition || !effect) throw new Error('The selected rule action is stale.')
  const compiledEffect = compileEffect(effect)
  const normalized = bindEncounterEffect({
    gameSystemId: input.gameSystemId,
    compiledEffect,
    conditionDefinitionIds: input.conditionDefinitionIds,
    abilityDefinitions: input.abilityDefinitions
  })
  if (normalized === null) throw new Error('The selected rule action is stale.')
  const mechanicFacts = normalizeCharacterActionMechanicFacts(compiledEffect)
  const { invocation } = mechanicFacts
  return {
    kind: 'RULE',
    gameSystemId: input.gameSystemId,
    authoredRootKind: 'effect',
    entryPointDefinitionId: effect.id,
    effectId: effect.id,
    actionId: input.actionId,
    sourceId: definition.definitionId,
    label: definition.label,
    mechanicFacts: {
      ...mechanicFacts,
      invocation: {
        ...invocation,
        activation: { ...invocation.activation, code: 'FREE', amount: 1 }
      }
    },
    conditionDefinitionIds: normalized.conditionDefinitionIds ?? input.conditionDefinitionIds,
    savingThrowAbilityDefinitionId: normalized.savingThrowAbilityDefinitionId ?? null,
    compiledEffect,
    encounterActorId: input.actorId,
    definitionId: definition.definitionId,
    definitionVersion: definition.definitionVersion,
    definitionChecksum: definition.definitionChecksum
  }
}
