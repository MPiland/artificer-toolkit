import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  equipId,
  magicArmorModifiers
} from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { signetRing } from '@artificer-toolkit/source-data/srd/equipment/signet-ring.js'

/**
 * A worn item whose authored modifier adds `bonus` to how many Concentrations its holder keeps,
 * for a cast of a spell of at most `maxSpellLevel` that keeps only such spells (any cast if omitted).
 * With `uses`, the bonus makes room only by spending one of that many daily uses of the item's charge.
 */
export function concentrationCapacityItem(input: {
  number: number
  label: string
  bonus: number
  maxSpellLevel?: number
  uses?: number
}): EquipmentAuthored {
  const id = (part: number) =>
    `c0c0a000-0000-4000-8${part.toString(16).padStart(3, '0')}-${input.number.toString(16).padStart(12, '0')}`
  return {
    ...signetRing,
    id: equipId(input.number),
    label: input.label,
    ...(input.uses !== undefined && {
      charges: {
        id: id(5),
        limitKind: 'FIXED_AMOUNT' as const,
        scalingKind: 'NONE' as const,
        amount: input.uses,
        resetKind: 'DAWN' as const
      }
    }),
    modifiers: magicArmorModifiers(equipId(input.number), input.bonus).map((modifier) => ({
      ...modifier,
      valueDomainCode: 'CONCENTRATION_CAPACITY' as const,
      domain: input.uses === undefined ? {} : { usesChargeId: id(5) },
      ...(input.maxSpellLevel !== undefined && {
        // The spell-level limit joins, not replaces, the modifier's while-equipped requirement.
        restrictions: {
          ...modifier.restrictions,
          groups: modifier.restrictions.groups.map((group) => ({
            ...group,
            contexts: [
              ...group.contexts,
              {
                id: id(3),
                order: 1,
                subject: 'SPELL' as const,
                authoringModeKind: 'ALL' as const,
                conditions: [
                  {
                    id: id(4),
                    order: 0,
                    kind: 'PREDICATE' as const,
                    constraint: 'INCLUDE' as const,
                    predicateCode: 'SPELL_LEVEL' as const,
                    min: 0,
                    max: input.maxSpellLevel
                  }
                ]
              }
            ]
          }))
        }
      })
    }))
  }
}
