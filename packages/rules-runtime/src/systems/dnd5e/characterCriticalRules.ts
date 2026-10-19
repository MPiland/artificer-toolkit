import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import {
  attackCriticalRules,
  type AttackCriticalRulesDto
} from '@artificer-toolkit/schema/shared/attackCriticalRules'
import type { AttackDomainCode } from '@artificer-toolkit/shared/core'

import {
  dnd5eAcceptedModifierApplicability,
  dnd5eModifierApplies,
  type Dnd5eModifierTarget
} from './modifierApplicability.js'

/**
 * The critical-hit rules a Character's accepted grants give one attack (Improved Critical, Brutal
 * Critical, a held effect's own): the lowest threshold of the grants whose restrictions the attack
 * meets, and the sum of their extra damage dice. The Encounter attack reads this in canonical order.
 */
export function dnd5eAttackCriticalRules(
  policy: { readonly grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'> },
  attackKind: AttackDomainCode,
  target: Dnd5eModifierTarget
): AttackCriticalRulesDto {
  const applying = policy.grantFold.modifiers.filter(
    (modifier) =>
      modifier.domain.attackDomain === attackKind &&
      dnd5eModifierApplies(dnd5eAcceptedModifierApplicability(modifier), target)
  )
  const thresholds = applying.flatMap(({ valueDomainCode, payload }) =>
    valueDomainCode === 'CRITICAL_HIT_THRESHOLD' && payload !== undefined && 'amount' in payload
      ? [payload.amount]
      : []
  )
  const extraDice = applying.flatMap(({ valueDomainCode, payload }) =>
    valueDomainCode === 'CRITICAL_EXTRA_DICE' &&
    payload !== undefined &&
    'valueKind' in payload &&
    payload.valueKind === 'FIXED'
      ? [payload.amount]
      : []
  )
  return attackCriticalRules(thresholds, extraDice)
}
