import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'

import { EncounterConflictError } from './encounterErrors.js'

export function applyCharacterScalarValuesToFacts(
  facts: CharacterRulePolicyInput,
  systemId: string,
  base: Readonly<Record<string, number>>,
  effective: Readonly<Record<string, number>>
): CharacterRulePolicyInput {
  return {
    ...facts,
    derivedBaseFacts: {
      ...facts.derivedBaseFacts,
      abilities: facts.derivedBaseFacts.abilities.map((ability) => {
        const definitions = facts.abilityDefinitions.filter(
          (definition) => definition.code === ability.abilityId
        )
        const definition = definitions[0]
        if (definitions.length !== 1 || !definition)
          throw new EncounterConflictError('The Character ability fact is stale.')
        const value = effective[definition.id]
        if (
          value === undefined ||
          base[definition.id] === undefined ||
          value === base[definition.id]
        )
          return ability
        if (!Number.isSafeInteger(value) || value < 0)
          throw new EncounterConflictError('The scalar reduction target fact is unavailable.')
        // The reduced value already includes every bonus and manual override in the base policy.
        return {
          ...ability,
          scoreOverride: {
            sourceId: `scalar-reduction:${definition.id}`,
            source: { kind: 'SYSTEM' as const, systemId },
            value
          }
        }
      })
    }
  }
}

export function scalarValuesDiffer(
  base: Readonly<Record<string, number>>,
  effective: Readonly<Record<string, number>>
): boolean {
  const keys = Object.keys(base)
  return (
    keys.length !== Object.keys(effective).length ||
    keys.some((key) => base[key] !== effective[key])
  )
}

export function foldActiveScalarReductions(input: {
  baseScalarValues: Readonly<Record<string, number>>
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'createdOrdinal' | 'definition'>[]
}): Record<string, number> {
  const effective = { ...input.baseScalarValues }
  for (const effect of [...input.effects].sort(
    (left, right) => left.createdOrdinal - right.createdOrdinal || left.id.localeCompare(right.id)
  )) {
    for (const contribution of effect.definition.stateContributions) {
      if (contribution.kind !== 'SCALAR_REDUCTION') continue
      const current = effective[contribution.valueDefinitionId]
      if (!Number.isSafeInteger(current) || current < 0)
        throw new EncounterConflictError('The scalar reduction target fact is unavailable.')
      effective[contribution.valueDefinitionId] = Math.max(
        contribution.floor,
        current - contribution.amount
      )
    }
  }
  return effective
}
