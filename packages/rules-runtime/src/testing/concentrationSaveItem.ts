import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  equipId,
  magicArmorModifiers
} from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { signetRing } from '@artificer-toolkit/source-data/srd/equipment/signet-ring.js'

import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '../systems/dnd5e/concentrationIdentity.js'

/** What a Concentration save must meet, authored as the item's predicates. */
export type ConcentrationSaveCondition =
  | { predicateCode: 'HELD_CONCENTRATION_COUNT'; min: number; max?: number }
  | { predicateCode: 'CONCENTRATION_DAMAGE_OVER'; over: number; perSpellLevel: number }

/**
 * A worn item whose authored modifier gives the Constitution saves of Concentration `influence`
 * while every condition holds for the save being rolled.
 */
export function concentrationSaveItem(input: {
  number: number
  label: string
  influence: 'ADVANTAGE' | 'DISADVANTAGE'
  conditions: readonly ConcentrationSaveCondition[]
}): EquipmentAuthored {
  const id = (part: number) =>
    `c0c0a000-0000-4000-8${part.toString(16).padStart(3, '0')}-${input.number.toString(16).padStart(12, '0')}`
  return {
    ...signetRing,
    id: equipId(input.number),
    label: input.label,
    modifiers: magicArmorModifiers(equipId(input.number), 1).map((modifier) => ({
      ...modifier,
      valueDomainCode: 'SAVING_THROW_MODIFIER' as const,
      domain: {
        ability: 'CONSTITUTION' as const,
        ruleDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      },
      modifierKind: 'ROLL_INFLUENCE' as const,
      payload: { influence: input.influence },
      // The save conditions join, not replace, the modifier's while-equipped requirement.
      restrictions: {
        ...modifier.restrictions,
        groups: modifier.restrictions.groups.map((group) => ({
          ...group,
          contexts: [
            ...group.contexts,
            {
              id: id(3),
              order: 1,
              subject: 'EQUIPMENT' as const,
              authoringModeKind: 'ALL' as const,
              conditions: input.conditions.map((condition, order) => ({
                id: id(4 + order),
                order,
                kind: 'PREDICATE' as const,
                constraint: 'INCLUDE' as const,
                ...condition
              }))
            }
          ]
        }))
      }
    }))
  }
}
