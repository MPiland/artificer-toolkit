import type { RulesSystem } from '../contracts/index.js'
import { dnd5e2014ProficiencyBonus } from './proficiencyBonus.js'
import { dnd5e2014StackingConfig } from './modifierStacking.js'
import { DND5E2014_FEATURE_SOURCE_ORDER, DND5E2014_GRANT_APPLICATION_ORDER } from './featureOrder.js'

export { dnd5e2014ProficiencyBonus } from './proficiencyBonus.js'
export { dnd5e2014StackingConfig } from './modifierStacking.js'
export { DND5E2014_FEATURE_SOURCE_ORDER, DND5E2014_GRANT_APPLICATION_ORDER } from './featureOrder.js'

/**
 * Concrete RulesSystem implementation for D&D 5e 2014 SRD.
 *
 * Rule ordering and stacking decisions are defined in RULE_ORDER.md.
 * The engine is system-agnostic — this object is passed in by the caller.
 */
export const dnd5e2014RulesSystem: RulesSystem = {
  id: 'dnd5e2014',
  label: 'D&D 5e 2014 SRD',

  proficiencyBonus: dnd5e2014ProficiencyBonus,

  abilityModifier(score: number): number {
    return Math.floor((score - 10) / 2)
  },

  stackingConfig: dnd5e2014StackingConfig,

  featureSourceOrder: DND5E2014_FEATURE_SOURCE_ORDER,
  grantApplicationOrder: DND5E2014_GRANT_APPLICATION_ORDER,
}
