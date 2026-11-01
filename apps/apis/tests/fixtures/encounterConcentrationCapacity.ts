import {
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared'

export const concentrationCapacityLabel = 'Fixture Divided Focus'

/** A Class Feature that lets its holder keep one more Concentration (SPELLS-12). */
export function createConcentrationCapacityFeatures() {
  return [
    {
      id: crypto.randomUUID(),
      label: concentrationCapacityLabel,
      description: 'You can keep two Concentrations at once.',
      availableAtLevel: 1,
      order: 90,
      grants: {
        modifiers: [
          {
            id: crypto.randomUUID(),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.CONCENTRATION_CAPACITY,
            domain: {},
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 0
          }
        ]
      }
    }
  ]
}
