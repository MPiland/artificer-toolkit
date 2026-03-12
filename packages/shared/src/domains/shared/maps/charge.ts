import { ChargeBonusAuthored, type ChargeAuthored, type ChargeLimitPayload } from '#authored'
import { ABILITY_OPTIONS, CHARGE_BONUS_OPTIONS, CHARGE_LIMIT_OPTIONS, CHARGE_RESET_OPTIONS, SCALING_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'
import { AllUnionFields } from 'type-fest'

const chargeBonus = buildNodeMap<ChargeBonusAuthored>()

const CHARGE_BONUS_NODE_MAP = chargeBonus.define('chargeBonus', ({ map, nodes, cond, data }) => {
  const { selectSingle, number } = nodes
  const { table } = data
  const local = cond.local()

  map
    .set('bonusKind', selectSingle(['bonusKind'], 'Bonus Kind', {
      kind: 'INLINE',
      options: CHARGE_BONUS_OPTIONS
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
      showIf: local.field(['bonusKind']).eq('ABILITY_MODIFIER')
    }))
    .set('skill', selectSingle(['skillId'], 'Skill', {
      kind: 'DATA',
      relationship: table('skills', {
        selectColumns: ['id', 'label', 'tooltip']
      })
    }, {
      order: 2,
      requiredIf: true,
      showIf: local.field(['bonusKind']).eq('SKILL_BONUS')
    }))
    .set('min', number(['min'], 'Min. Amount', {
      order: 3
    }))
    .set('max', number(['max'], 'Max. Amount', {
      order: 3
    }))
    .set('multiplier', number(['multiplier'], 'Multiplier', {
      order: 3
    }))
})

const chargeLevelScaling = buildNodeMap<NonNullable<AllUnionFields<ChargeLimitPayload>['levels']>[number]>()

const CHARGE_LEVEL_SCALING_NODE_MAP = chargeLevelScaling.define('levels', ({
  map, nodes }) => {
  const { number } = nodes

  map
    .set('level', number(['level'], 'Level', {
      order: 1,
      requiredIf: true
    }))
    .set('amount', number(['amount'], 'Amount', {
      order: 2,
      requiredIf: true
    }))
})

const charges = buildNodeMap<ChargeAuthored>()

export const CHARGE_NODE_MAP = charges.define('charges', ({ map, nodes, logic, cond }) => {
  const { selectSingle, groupArray, number } = nodes
  const { or, and } = logic
  const local = cond.local()

  map
    .set('resetKind', selectSingle(['resetKind'], 'Reset Kind', {
      kind: 'INLINE',
      options: CHARGE_RESET_OPTIONS
    }, {
      order: 1,
      requiredIf: true
    }))
    .set('limitKind', selectSingle(['limitKind'], 'Limit Kind', {
      kind: 'INLINE',
      options: CHARGE_LIMIT_OPTIONS
    }, {
      order: 1,
      requiredIf: true
    }))
    .set('bonuses', groupArray(['bonuses'], 'Bonuses', () => CHARGE_BONUS_NODE_MAP, {
      order: 2
    }))
    .set('multiplier', number(['multiplier'], 'Multiplier', {
      order: 4,
      showIf: or([
        local.field(['limitKind']).eq('CHARACTER_LEVEL'),
        local.field(['limitKind']).eq('SOURCE_LEVEL')
      ])
    }))
    .set('scalingKind', selectSingle(['scalingKind'], 'Scaling', {
      kind: 'INLINE',
      options: SCALING_OPTIONS
    }, {
      order: 3,
      requiredIf: true,
      showIf: local.field(['limitKind']).eq('FIXED_AMOUNT')
    }))
    .set('amount', number(['amount'], 'Amount', {
      order: 4,
      requiredIf: true,
      showIf: and([
        local.field(['limitKind']).eq('FIXED_AMOUNT'),
        local.field(['scalingKind']).eq('NONE')
      ])
    }))
    .set('levels', groupArray(['levels'], 'Levels', () => CHARGE_LEVEL_SCALING_NODE_MAP))
})
