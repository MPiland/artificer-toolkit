import { human } from '@artificer-toolkit/source-data/srd/races/human.js'

/** A race whose feature adds half the proficiency bonus, rounded down, to every ability check. */
export const halfProficiencyRace = {
  ...human,
  features: [
    {
      id: crypto.randomUUID(),
      label: 'Jack of Trades',
      description: 'Half your proficiency bonus applies to every ability check.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: crypto.randomUUID(),
            grantKind: 'MODIFIER_GRANT' as const,
            valueDomainCode: 'ABILITY_CHECK' as const,
            domain: {},
            modifierKind: 'BONUS' as const,
            scope: 'GLOBAL' as const,
            selectionKind: 'GRANTED' as const,
            payload: {
              valueKind: 'PROFICIENCY_BONUS' as const,
              multiplier: 0.5,
              rounding: 'DOWN' as const
            },
            order: 0
          }
        ]
      }
    }
  ]
}
