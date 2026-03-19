import { type DamageAuthored, type DamageBonusAuthored, type DamageDicePayload, type DamageFixedPayload } from '#authored'
import {
  ABILITY_OPTIONS,
  DAMAGE_BONUS_OPTIONS,
  DAMAGE_VALUE_OPTIONS
} from '#core'
import { buildNodeMap } from '#utils'
import { type AllUnionFields } from 'type-fest'

// Helper type to extract element type from array property
type ArrayElementAt<T, K extends keyof T> = T[K] extends (infer U)[] ? U : never

type DamageArrayElement = ArrayElementAt<AllUnionFields<DamageDicePayload | DamageFixedPayload>, 'levels'>

type DamageUnioned = AllUnionFields<DamageAuthored>

const damageBonus = buildNodeMap<DamageBonusAuthored>()

export const DAMAGE_BONUS_NODE_MAP = damageBonus.define('damageBonus', ({ map, nodes, cond, data }) => {
  const { selectSingle, number, text } = nodes
  const { table } = data
  const local = cond.local()

  map
    .set('id', text(['id'], 'ID'))
    .set('bonusKind', selectSingle(['bonusKind'], 'Bonus Kind', {
      kind: 'INLINE',
      options: DAMAGE_BONUS_OPTIONS
    }, {
      order: 1,
      requiredIf: true
    }))
    .set('ability', selectSingle(['ability'], 'Ability', {
      kind: 'INLINE',
      options: ABILITY_OPTIONS
    }, {
      order: 2,
      requiredIf: true,
      showIf: local.field(['bonusKind']).eq('ABILITY_BONUS')
    }))
    .set('skillId', selectSingle(['skillId'], 'Skill', {
      kind: 'DATA',
      relationship: table('skills', {
        selectColumns: ['id', 'label']
      })
    }, {
      order: 2,
      requiredIf: true,
      showIf: local.field(['bonusKind']).eq('SKILL_BONUS')
    }))
    .set('min', number(['min'], 'Min Amount', {
      order: 3
    }))
    .set('max', number(['max'], 'Max Amount', {
      order: 3
    }))
    .set('multiplier', number(['multiplier'], 'Multiplier', {
      order: 4
    }))
    .set('order', number(['order'], 'Order', {
      order: 5,
      requiredIf: true
    }))
})

// Main Damage Node Map - handles all damage value kinds
const damage = buildNodeMap<DamageUnioned>()

export const DAMAGE_NODE_MAP = damage.define('damage', ({ map, nodes, cond, data }) => {
  const { text, number, selectSingle, groupArray } = nodes
  const { table } = data
  const local = cond.local()

  map
    .set('id', text(['id'], 'ID'))
    .set('effectKind', text(['effectKind'], 'Effect Kind'))
    .set('damageTypeId', selectSingle(['damageTypeId'], 'Damage Type', {
      kind: 'DATA',
      relationship: table('damage_types', {
        selectColumns: ['id', 'label']
      })
    }, {
      order: 1,
      requiredIf: true
    }))
    .set('valueKind', selectSingle(['valueKind'], 'Damage Value Kind', {
      kind: 'INLINE',
      options: DAMAGE_VALUE_OPTIONS
    }, {
      order: 2,
      requiredIf: true
    }))
    .set('amount', number(['amount'], 'Amount', {
      order: 3,
      requiredIf: true,
      showIf: local.field(['valueKind']).eq('FIXED')
    }))
    .set('diceConfig', text(['diceConfig'], 'Dice Config', {
      order: 3,
      requiredIf: true,
      showIf: local.field(['valueKind']).eq('DICE')
    }))
    .set('amount', number(['amount'], 'Pool Amount', {
      order: 3,
      requiredIf: true,
      showIf: local.field(['valueKind']).eq('POOL')
    }))
    .set('scalingKind', selectSingle(['scalingKind'], 'Scaling Kind', {
      kind: 'INLINE',
      options: [
        { code: 'NONE', label: 'None' },
        { code: 'PER_LEVEL', label: 'Per Level' }
      ]
    }, {
      order: 4,
      requiredIf: true
    }))
    .set('bonuses', groupArray(['bonuses'], 'Damage Bonuses', () => DAMAGE_BONUS_NODE_MAP, {
      order: 5
    }))
})

const damageLevelScalingEntry = buildNodeMap<DamageArrayElement>()

export const DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP = damageLevelScalingEntry.define('damageLevelScalingEntry', ({ map, nodes, cond }) => {
  const { number, text } = nodes
  const parent = cond.parent<DamageUnioned>()

  map
    .set('level', number(['level'], 'Level', {
      order: 1,
      requiredIf: true
    }))
    .set('diceConfig', text(['diceConfig'], 'Damage Dice', {
      order: 2,
      requiredIf: true,
      showIf: parent.field(['valueKind']).eq('DICE')
    }))
    .set('amount', number(['amount'], 'Damage Amount', {
      order: 2,
      requiredIf: true,
      showIf: parent.field(['valueKind']).eq('FIXED')
    }))
})
