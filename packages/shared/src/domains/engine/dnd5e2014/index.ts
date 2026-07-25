import type { RulesSystem } from '../contracts/index.js'
import { dnd5e2014ProficiencyBonus } from './proficiencyBonus.js'
import { dnd5e2014StackingConfig } from './modifierStacking.js'
import {
  DND5E2014_FEATURE_SOURCE_ORDER,
  DND5E2014_GRANT_APPLICATION_ORDER
} from './featureOrder.js'

export { dnd5e2014ProficiencyBonus } from './proficiencyBonus.js'
export { dnd5e2014StackingConfig } from './modifierStacking.js'
export {
  DND5E2014_FEATURE_SOURCE_ORDER,
  DND5E2014_GRANT_APPLICATION_ORDER
} from './featureOrder.js'

/**
 * Concrete RulesSystem implementation for D&D 5e 2014 SRD.
 *
 * Rule ordering and stacking decisions are defined in RULE_ORDER.md.
 * The engine is system-agnostic — this object is passed in by the caller.
 */
export const dnd5e2014RulesSystem: RulesSystem = {
  identity: {
    code: 'dnd5e',
    version: '2014'
  },
  label: 'D&D 5e 2014 SRD',

  proficiencyBonus: dnd5e2014ProficiencyBonus,

  abilityModifier(score: number): number {
    return Math.floor((score - 10) / 2)
  },

  proficiencyMultiplier(level) {
    switch (level) {
      case 'NONE':
        return 0
      case 'HALF':
        return 0.5
      case 'FULL':
        return 1
      case 'DOUBLE':
        return 2
    }
  },

  passiveScore(skillBonus: number): number {
    return 10 + skillBonus
  },

  selectPrimaryMovementSpeedId(speeds, preference) {
    if (
      preference.mode === 'EXPLICIT' &&
      speeds.some((speed) => speed.speedId === preference.speedId)
    ) {
      return preference.speedId
    }

    return (
      speeds.find((speed) => speed.code?.toUpperCase() === 'WALK')?.speedId ?? speeds[0]?.speedId
    )
  },

  stackingConfig: dnd5e2014StackingConfig,

  featureSourceOrder: DND5E2014_FEATURE_SOURCE_ORDER,
  grantApplicationOrder: DND5E2014_GRANT_APPLICATION_ORDER
}
