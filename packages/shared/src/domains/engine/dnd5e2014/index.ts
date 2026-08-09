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
  attunementSlotLimit: 3,
  rest: {
    hitDiceRecoveredAfterLongRest(totalHitDice: number): number {
      if (!Number.isInteger(totalHitDice) || totalHitDice < 0) {
        throw new RangeError('Total hit dice must be a non-negative integer.')
      }
      return totalHitDice === 0 ? 0 : Math.max(1, Math.floor(totalHitDice / 2))
    }
  },
  exhaustion: {
    label: 'Exhaustion',
    description:
      '<p>Each exhaustion level includes the effects of every lower level.</p><ol><li><strong>Level 1:</strong> Disadvantage on ability checks.</li><li><strong>Level 2:</strong> Speed is halved.</li><li><strong>Level 3:</strong> Disadvantage on attack rolls and saving throws.</li><li><strong>Level 4:</strong> Hit point maximum is halved.</li><li><strong>Level 5:</strong> Speed is reduced to 0.</li><li><strong>Level 6:</strong> Death.</li></ol>',
    minimumLevel: 0,
    maximumLevel: 6,
    levelAfterLongRest(currentLevel: number): number {
      if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel > 6) {
        throw new RangeError('Exhaustion level must be an integer from 0 through 6.')
      }
      return Math.max(0, currentLevel - 1)
    }
  },

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
