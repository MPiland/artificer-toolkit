import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'
import type { CharacterFormValues } from '../core/characterBuilder.types'

export function getCharacterBuilderResolutionFingerprint(character: CharacterFormValues): string {
  return JSON.stringify({
    immediate: getCharacterBuilderImmediateResolutionFingerprint(character),
    deferred: getCharacterBuilderDeferredResolutionFingerprint(character)
  })
}

export function getCharacterBuilderImmediateResolutionFingerprint(
  character: CharacterFormValues
): string {
  const { abilities, hitpoints, ...immediateIntent } = character.intent
  const immediateAbilities =
    abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
      ? {
          method: abilities.method,
          assignedAbilities: abilities.state.assignments.map((assignment) => assignment.ability)
        }
      : abilities

  return JSON.stringify({
    hasCurrency: character.state.currency.length > 0,
    hasInventory: character.state.equipment.inventory.length > 0,
    intent: {
      ...immediateIntent,
      abilities: immediateAbilities,
      hitpoints: { method: hitpoints.method }
    },
    systemId: character.systemId
  })
}

export function getCharacterBuilderDeferredResolutionFingerprint(
  character: CharacterFormValues
): string {
  const abilities = character.intent.abilities

  return JSON.stringify({
    manualAbilities:
      abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
        ? abilities.state.assignments
        : null,
    hitpointLevels: character.intent.hitpoints.levels
  })
}
