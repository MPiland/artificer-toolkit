import type { ValueDomainCode } from '../../core/valueDomain.js'
import type { ModifierStackingConfig } from '../contracts/index.js'

/**
 * D&D 5e 2014 SRD modifier stacking rules per modifier kind.
 * See RULE_ORDER.md §3 for the full table and rationale.
 *
 * Note: ENHANCEMENT bonus scope-based capping (typed bonuses don't stack)
 * is a Phase 7 refinement. MVP treats BONUS as additive.
 */
const STACKING_BY_KIND: Record<string, ModifierStackingConfig> = {
  BONUS: { rule: 'additive' },
  PENALTY: { rule: 'additive' },
  SET_VALUE: { rule: 'last' },
  ADD_BONUS_DIE: { rule: 'additive' },
  REPLACE_DAMAGE_TYPE: { rule: 'last' },
  ADVANTAGE: { rule: 'boolean' },
  DISADVANTAGE: { rule: 'boolean' },
  ADD_OPTION: { rule: 'additive' },
  REMOVE_OPTION: { rule: 'additive' },
  REPLACE_RANGE_KIND: { rule: 'last' },
  REPLACE_DURATION_KIND: { rule: 'last' },
  REPLACE_SHAPE_KIND: { rule: 'last' },
  REPLACE_CHARGE_RESET_KIND: { rule: 'last' },
  MODIFY_CHARGE_LIMIT: { rule: 'additive' },
  ABILITY_MODIFIER_BONUS: { rule: 'additive' },
  OPTIONAL_ABILITY_MODIFIER_BONUS: { rule: 'additive' },
}

export function dnd5e2014StackingConfig(
  _domain: ValueDomainCode,
  modifierKind: string
): ModifierStackingConfig {
  return STACKING_BY_KIND[modifierKind] ?? { rule: 'additive' }
}

