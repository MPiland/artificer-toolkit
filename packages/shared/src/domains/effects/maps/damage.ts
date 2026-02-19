import { type DamageAuthored, type DamageBonusAuthored, type DamageDicePayload, type DamageFixedPayload } from '#authored'
import { ABILITY_OPTIONS, DAMAGE_BONUS_OPTIONS } from '#core'
import { buildNodeMap, type ArrayElementAt } from '#util'
import { type AllUnionFields } from 'type-fest'

const damageBonus = buildNodeMap<DamageBonusAuthored>()

export const DAMAGE_BONUS_NODE_MAP = damageBonus.define((map, { field }) => map({
  bonusKind: {
    kind: 'INPUT',
    label: 'Bonus Kind',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: DAMAGE_BONUS_OPTIONS
    }
  },
  ability: {
    kind: 'INPUT',
    label: 'Ability',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: ABILITY_OPTIONS
    },
    showIf: field('bonusKind').eq('ABILITY_BONUS')
  },
  skillId: {
    kind: 'INPUT',
    label: 'Skill',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'DATA',
      relationship: {
        kind: 'ROOT',
        table: 'skills'
      }
    },
    showIf: field('bonusKind').eq('SKILL_BONUS')
  },
  min: {
    kind: 'INPUT',
    label: 'Minimum Bonus',
    type: 'NUMBER'
  },
  max: {
    kind: 'INPUT',
    label: 'Maximum Bonus',
    type: 'NUMBER'
  },
  multiplier: {
    kind: 'INPUT',
    label: 'Multiplier',
    type: 'NUMBER'
  }
}))

type DamageArrayElement = ArrayElementAt<DamageDicePayload | DamageFixedPayload, 'levels'>

type DamageUnioned = AllUnionFields<DamageAuthored>

const damageLevelScalingEntry = buildNodeMap<DamageArrayElement, DamageUnioned>()

export const DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP = damageLevelScalingEntry.define((map, { field }) => map({
  level: {
    kind: 'INPUT',
    label: 'Level',
    required: true,
    type: 'NUMBER'
  },
  diceConfig: {
    kind: 'INPUT',
    label: 'Damage Dice',
    required: true,
    type: 'NUMBER',
    showIf: field('valueKind').eq('DICE')
  },
  amount: {
    kind: 'INPUT',
    label: 'Damage Amount',
    required: true,
    type: 'NUMBER',
    showIf: field('valueKind').eq('FIXED')
  }
}))
