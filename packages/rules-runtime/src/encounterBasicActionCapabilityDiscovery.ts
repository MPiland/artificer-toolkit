import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { normalizeCharacterActionMechanicFacts } from './character/characterActionRuleFacts.js'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import { requireEncounterBasicActionDefinition } from './encounterBasicActions.js'
import { bindEncounterEffect } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'

/** A published basic-action catalogue entry that carries authored Effects. */
export type EncounterBasicActionEntry = ReturnType<typeof requireEncounterBasicActionDefinition>

/** The server-only capability of one authored basic action an actor can take. */
export interface EncounterBasicActionCapabilityDescriptor extends EffectActionCapabilityDescriptor {
  kind: 'BASIC_ACTION'
  encounterActorId: string
  definitionId: string
  definitionVersion: number
  definitionChecksum: string
  label: string
  authoredEffectChecksum: string
  compiledEffectChecksum: string
}

/** A basic action whose authored mechanics cannot run; it is listed unavailable, not thrown. */
interface EncounterBasicActionUnavailable {
  actionId: string
  label: string
  reason: string
}

export interface EncounterBasicActionDiscovery {
  available: readonly EncounterBasicActionCapabilityDescriptor[]
  unavailable: readonly EncounterBasicActionUnavailable[]
}

/** The identity of one authored basic action of one actor (the `actionId` of RESOLVE_ACTION). */
export function encounterBasicActionId(
  actorId: string,
  definitionId: string,
  effectId: string
): string {
  return `${actorId}${ACTION_ID_SEPARATOR}${definitionId}${EFFECT_ID_SEPARATOR}${effectId}`
}

const ACTION_ID_SEPARATOR = ':BASIC_ACTION:'
const EFFECT_ID_SEPARATOR = ':EFFECT:'

/** Whether an action id names an authored basic action of this actor. */
export function isEncounterBasicActionId(actorId: string, actionId: string): boolean {
  return actionId.startsWith(`${actorId}${ACTION_ID_SEPARATOR}`)
}

/** The authored Effect of a catalogue entry that a basic action id names. */
export function readEncounterBasicActionEffect(
  entry: EncounterBasicActionEntry,
  actionId: string
): EncounterBasicActionEntry['document']['effects'][number] | null {
  const effectId = actionId.slice(
    actionId.lastIndexOf(EFFECT_ID_SEPARATOR) + EFFECT_ID_SEPARATOR.length
  )
  return entry.document.effects.find((effect) => effect.id === effectId) ?? null
}

/**
 * The catalogue entry a basic action id names, read from the current definitions; empty for any
 * other action. The id carries the definition, so a caller reads only that entry.
 */
export async function readEncounterBasicActionEntries(input: {
  actorId: string
  actionId: string
  gameSystemId: string
  definitions: CurrentReusableDefinitionSource
}): Promise<readonly EncounterBasicActionEntry[]> {
  if (!isEncounterBasicActionId(input.actorId, input.actionId)) return []
  const [definitionId] = input.actionId
    .slice(input.actorId.length + ACTION_ID_SEPARATOR.length)
    .split(':')
  return [
    requireEncounterBasicActionDefinition(
      { gameSystemId: input.gameSystemId },
      await input.definitions.requireCurrent(definitionId ?? '')
    )
  ]
}

/**
 * The authored basic actions an actor can take: every ACTION-invoked Effect of the catalogue's
 * authored entries, compiled like a Feature's. Entries restricted to other actors are carried by
 * the document and read by the offering rules, not here.
 */
export function discoverEncounterBasicActions(input: {
  actorId: string
  gameSystemId: string
  entries: readonly EncounterBasicActionEntry[]
  conditionDefinitionIds: readonly string[]
  abilityDefinitions: readonly { id: string; code: string }[]
}): EncounterBasicActionDiscovery {
  const available: EncounterBasicActionCapabilityDescriptor[] = []
  const unavailable: EncounterBasicActionUnavailable[] = []
  for (const { definition, document } of input.entries) {
    for (const effect of document.effects) {
      if (effect.invocation.kind !== 'ACTION') continue
      const actionId = encounterBasicActionId(input.actorId, definition.id, effect.id)
      try {
        const compiledEffect = compileEffect(effect)
        const normalized = bindEncounterEffect({
          gameSystemId: input.gameSystemId,
          compiledEffect,
          conditionDefinitionIds: input.conditionDefinitionIds,
          abilityDefinitions: input.abilityDefinitions
        })
        if (normalized === null) continue
        available.push({
          kind: 'BASIC_ACTION',
          gameSystemId: input.gameSystemId,
          authoredRootKind: 'effect',
          entryPointDefinitionId: effect.id,
          effectId: effect.id,
          actionId,
          sourceId: definition.id,
          label: definition.label,
          mechanicFacts: normalizeCharacterActionMechanicFacts(compiledEffect),
          conditionDefinitionIds: normalized.conditionDefinitionIds ?? input.conditionDefinitionIds,
          savingThrowAbilityDefinitionId: normalized.savingThrowAbilityDefinitionId ?? null,
          compiledEffect,
          encounterActorId: input.actorId,
          definitionId: definition.id,
          definitionVersion: definition.version,
          definitionChecksum: definition.checksum,
          authoredEffectChecksum: checksumRuleDocument(effect),
          compiledEffectChecksum: checksumRuleDocument(compiledEffect)
        })
      } catch (error) {
        unavailable.push({
          actionId,
          label: definition.label,
          reason: error instanceof Error ? error.message : 'Its authored mechanics are invalid.'
        })
      }
    }
  }
  return { available, unavailable }
}
