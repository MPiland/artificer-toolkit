import {
  ABILITY_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared/core'
import type { ModifierGrantAuthored, OptionAuthored } from '@artificer-toolkit/shared/authored'

export { closedRuleEffect } from '../closed-rule-effect.js'

const ABILITY_SCORE_IMPROVEMENT_ABILITIES = [
  { ability: ABILITY_CODE.STRENGTH, label: 'Strength' },
  { ability: ABILITY_CODE.DEXTERITY, label: 'Dexterity' },
  { ability: ABILITY_CODE.CONSTITUTION, label: 'Constitution' },
  { ability: ABILITY_CODE.INTELLIGENCE, label: 'Intelligence' },
  { ability: ABILITY_CODE.WISDOM, label: 'Wisdom' },
  { ability: ABILITY_CODE.CHARISMA, label: 'Charisma' }
] as const

export function abilityScoreImprovementOptions(
  makeId: (entry: number) => string,
  description: string
): OptionAuthored[] {
  const modifier = (
    entry: number,
    ability: (typeof ABILITY_SCORE_IMPROVEMENT_ABILITIES)[number]['ability'],
    amount: number,
    order: number
  ): ModifierGrantAuthored => ({
    id: makeId(entry),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
    domain: { ability },
    modifierKind: MODIFIER_KIND.BONUS,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: { valueKind: 'FIXED' as const, amount },
    order
  })
  const options: OptionAuthored[] = ABILITY_SCORE_IMPROVEMENT_ABILITIES.map(
    ({ ability, label }, index) => ({
      id: makeId(index + 1),
      label: `${label} +2`,
      description,
      grants: { modifiers: [modifier(64 + index, ability, 2, 0)] },
      order: index
    })
  )

  let optionEntry = ABILITY_SCORE_IMPROVEMENT_ABILITIES.length + 1
  let modifierEntry = 96
  for (let leftIndex = 0; leftIndex < ABILITY_SCORE_IMPROVEMENT_ABILITIES.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < ABILITY_SCORE_IMPROVEMENT_ABILITIES.length;
      rightIndex += 1
    ) {
      const left = ABILITY_SCORE_IMPROVEMENT_ABILITIES[leftIndex]
      const right = ABILITY_SCORE_IMPROVEMENT_ABILITIES[rightIndex]
      options.push({
        id: makeId(optionEntry),
        label: `${left.label} +1, ${right.label} +1`,
        description,
        grants: {
          modifiers: [
            modifier(modifierEntry, left.ability, 1, 0),
            modifier(modifierEntry + 1, right.ability, 1, 1)
          ]
        },
        order: optionEntry - 1
      })
      optionEntry += 1
      modifierEntry += 2
    }
  }

  return options
}
