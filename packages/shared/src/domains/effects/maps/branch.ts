import type {
  BranchAuthored,
  BranchEffectPayload,
  BranchRollTable,
  BranchRollTableEntry,
  DamageBonusAuthored,
  HealBonusAuthored
} from '#authored'
import {
  BRANCH_GROUP_TYPE_OPTIONS,
  BRANCH_OPTIONS,
  BRANCH_RESOLUTION_KIND_OPTIONS,
  BRANCH_ROLL_TABLE_KIND_OPTIONS,
  DAMAGE_VALUE_OPTIONS,
  EFFECT_KIND_OPTIONS,
  FORCED_MOVEMENT_ACTION_ECONOMY_OPTIONS,
  FORCED_MOVEMENT_DIRECTION_OPTIONS,
  FORCED_MOVEMENT_DISTANCE_MODE_OPTIONS,
  MEASUREMENT_UNIT_OPTIONS,
  SCALING_SOURCE_OPTIONS
} from '#core'
import {
  DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP,
  DURATION_NODE_MAP
} from '#maps'
import { buildNodeMap, type NodeMap } from '#utils'

type OutcomeBonusAuthored = DamageBonusAuthored | HealBonusAuthored

const outcomeBonus = buildNodeMap<OutcomeBonusAuthored>()

export const OUTCOME_BONUS_NODE_MAP = outcomeBonus.define('outcomeBonus', ({ map, nodes, cond, data }) => {
  const { selectSingle, number, text } = nodes
  const { table } = data
  const local = cond.local()

  map
    .set('id', text(['id'], 'ID'))
    .set('bonusKind', selectSingle(['bonusKind'], 'Bonus Kind', {
      kind: 'INLINE',
      options: [
        { code: 'ABILITY_BONUS', label: 'Ability Bonus' },
        { code: 'PROFICIENCY_BONUS', label: 'Proficiency Bonus' },
        { code: 'SKILL_BONUS', label: 'Skill Bonus' },
        { code: 'CLASS_LEVEL', label: 'Class Level' }
      ]
    }, {
      requiredIf: true
    }))
    .set('ability', selectSingle(['ability'], 'Ability', {
      kind: 'INLINE',
      options: [
        { code: 'CHARISMA', label: 'Charisma' },
        { code: 'CONSTITUTION', label: 'Constitution' },
        { code: 'DEXTERITY', label: 'Dexterity' },
        { code: 'INTELLIGENCE', label: 'Intelligence' },
        { code: 'STRENGTH', label: 'Strength' },
        { code: 'WISDOM', label: 'Wisdom' },
        { code: 'SPELLCASTING', label: 'Spellcasting' }
      ]
    }, {
      requiredIf: true,
      showIf: local.field(['bonusKind']).eq('ABILITY_BONUS')
    }))
    .set('skillId', selectSingle(['skillId'], 'Skill', {
      kind: 'DATA',
      relationship: table('skills', {
        selectColumns: ['id', 'label']
      })
    }, {
      requiredIf: true,
      showIf: local.field(['bonusKind']).eq('SKILL_BONUS')
    }))
    .set('classId', selectSingle(['classId'], 'Class', {
      kind: 'DATA',
      relationship: table('classes', {
        selectColumns: ['id', 'label']
      })
    }, {
      requiredIf: true,
      showIf: local.field(['bonusKind']).eq('CLASS_LEVEL')
    }))
    .set('min', number(['min'], 'Min Amount'))
    .set('max', number(['max'], 'Max Amount'))
    .set('multiplier', number(['multiplier'], 'Multiplier'))
    .set('order', number(['order'], 'Order', {
      requiredIf: true
    }))
})

const branchRollTableEntry = buildNodeMap<BranchRollTableEntry & BranchEffectPayload>()

export const BRANCH_ROLL_TABLE_ENTRY_NODE_MAP = branchRollTableEntry.define('branchRollTableEntry', ({ map, nodes, cond, logic, data }) => {
  const { text, number, selectSingle, groupObject, groupArray } = nodes
  const { and, or, not } = logic
  const local = cond.local()
  const parent = cond.parent<Omit<BranchRollTable, 'table'>>()
  const { table } = data

  map
    .set('duration', groupObject(['duration'], 'Duration', () => DURATION_NODE_MAP))
    .set('rollRangeMin', number(['rollRange', 0], 'Roll Min', {
      requiredIf: true,
      showIf: parent.field(['rollTableKind']).eq('RANGE')
    }))
    .set('rollRangeMax', number(['rollRange', 1], 'Roll Max', {
      requiredIf: true,
      showIf: parent.field(['rollTableKind']).eq('RANGE')
    }))
    .set('rollValue', number(['rollValue'], 'Roll Value', {
      requiredIf: true,
      showIf: parent.field(['rollTableKind']).eq('EXACT')
    }))
    .set('effectKind', selectSingle(['effectKind'], 'Effect Kind', {
      kind: 'INLINE',
      options: EFFECT_KIND_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('bonuses', groupArray(['bonuses'], 'Bonuses', () => OUTCOME_BONUS_NODE_MAP, {
      showIf: or([
        local.field(['effectKind']).eq('DAMAGE'),
        local.field(['effectKind']).eq('HEAL')
      ])
    }))
    .set('damageTypeId', selectSingle(['damageTypeId'], 'Damage Type', {
      kind: 'DATA',
      relationship: table('damage_types', {
        selectColumns: ['id', 'label', 'tooltip']
      })
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq('DAMAGE')
    }))
    .set('valueKind', selectSingle(['valueKind'], 'Damage Value Kind', {
      kind: 'INLINE',
      options: DAMAGE_VALUE_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq('DAMAGE')
    }))
    .set('amount', number(['amount'], 'Damage Amount', {
      requiredIf: not(and([
        local.field(['valueKind']).eq('POOL'),
        local.field(['scalingKind']).eq('PER_LEVEL')
      ])),
      showIf: and([
        local.field(['effectKind']).eq('DAMAGE'),
        or([
          and([
            local.field(['scalingKind']).eq('NONE'),
            or([
              local.field(['valueKind']).eq('FIXED'),
              local.field(['valueKind']).eq('POOL')
            ])
          ]),
          and([
            local.field(['scalingKind']).eq('PER_LEVEL'),
            local.field(['valueKind']).eq('POOL')
          ])
        ])
      ])
    }))
    .set('multiplier', number(['multiplier'], 'Damage Multiplier', {
      showIf: local.field(['effectKind']).eq('DAMAGE')
    }))
    .set('min', number(['min'], 'Damage Min', {
      showIf: and([
        local.field(['effectKind']).eq('DAMAGE'),
        local.field(['scalingKind']).eq('PER_LEVEL'),
        local.field(['valueKind']).eq('POOL')
      ])
    }))
    .set('max', number(['max'], 'Damage Max', {
      showIf: and([
        local.field(['effectKind']).eq('DAMAGE'),
        local.field(['scalingKind']).eq('PER_LEVEL'),
        local.field(['valueKind']).eq('POOL')
      ])
    }))
    .set('diceConfig', number(['diceConfig'], 'Damage Dice', {
      requiredIf: true,
      showIf: and([
        local.field(['effectKind']).eq('DAMAGE'),
        local.field(['scalingKind']).eq('NONE'),
        local.field(['valueKind']).eq('DICE')
      ])
    }))
    .set('levels', groupArray(['levels'], 'Levels', () => DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP, {
      showIf: and([
        local.field(['effectKind']).eq('DAMAGE'),
        local.field(['scalingKind']).eq('PER_LEVEL'),
        not(local.field(['valueKind']).eq('POOL'))
      ])
    }))
    .set('scalingSource', selectSingle(['scalingSource'], 'Scaling Source', {
      kind: 'INLINE',
      options: SCALING_SOURCE_OPTIONS
    }, {
      requiredIf: true,
      showIf: and([
        local.field(['effectKind']).eq('DAMAGE'),
        local.field(['scalingKind']).eq('PER_LEVEL'),
        not(local.field(['valueKind']).eq('POOL'))
      ])
    }))
    .set('classId', selectSingle(['classId'], 'Class', {
      kind: 'DATA',
      relationship: table('classes', {
        selectColumns: ['id', 'label']
      })
    }, {
      requiredIf: true,
      showIf: and([
        local.field(['effectKind']).eq('DAMAGE'),
        local.field(['scalingKind']).eq('PER_LEVEL'),
        not(local.field(['valueKind']).eq('POOL')),
        local.field(['scalingSource']).eq('CLASS_LEVEL')
      ])
    }))
    .set('conditionId', selectSingle(['conditionId'], 'Condition', {
      kind: 'DATA',
      relationship: table('condition_types', {
        selectColumns: ['id', 'label', 'tooltip']
      })
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq('CONDITION')
    }))
    .set('direction', selectSingle(['direction'], 'Direction', {
      kind: 'INLINE',
      options: FORCED_MOVEMENT_DIRECTION_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq('FORCED_MOVEMENT')
    }))
    .set('distanceMode', selectSingle(['distanceMode'], 'Distance Mode', {
      kind: 'INLINE',
      options: FORCED_MOVEMENT_DISTANCE_MODE_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq('FORCED_MOVEMENT')
    }))
    .set('movementAmount', number(['amount'], 'Distance Amount', {
      requiredIf: true,
      showIf: and([
        local.field(['effectKind']).eq('FORCED_MOVEMENT'),
        local.field(['distanceMode']).eq('FIXED_DISTANCE')
      ])
    }))
    .set('movementUnit', selectSingle(['unit'], 'Distance Unit', {
      kind: 'INLINE',
      options: MEASUREMENT_UNIT_OPTIONS
    }, {
      requiredIf: true,
      showIf: and([
        local.field(['effectKind']).eq('FORCED_MOVEMENT'),
        local.field(['distanceMode']).eq('FIXED_DISTANCE')
      ])
    }))
    .set('actionEconomy', selectSingle(['actionEconomy'], 'Action Economy', {
      kind: 'INLINE',
      options: FORCED_MOVEMENT_ACTION_ECONOMY_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq('FORCED_MOVEMENT')
    }))
})

const branch = buildNodeMap<BranchAuthored>()

type BranchNodeMap = NodeMap<BranchAuthored>

export const BRANCH_NODE_MAP: BranchNodeMap = branch.define('branch', ({ map, nodes, cond }) => {
  const { selectSingle, text, groupObject, groupArray } = nodes
  const local = cond.local()

  map
    .set('branch', selectSingle(['branch'], 'Branch', {
      kind: 'INLINE',
      options: BRANCH_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('resolutionKind', selectSingle(['resolutionKind'], 'Resolution Kind', {
      kind: 'INLINE',
      options: BRANCH_RESOLUTION_KIND_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('dieConfig', text(['dieConfig'], 'Die Configuration', {
      requiredIf: true,
      showIf: local.field(['resolutionKind']).eq('ROLL_TABLE')
    }))
    .set('groupType', selectSingle(['groupType'], 'Group Type', {
      kind: 'INLINE',
      options: BRANCH_GROUP_TYPE_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('duration', groupObject(['duration'], 'Duration', () => DURATION_NODE_MAP))
    .set('rollTableKind', selectSingle(['rollTableKind'], 'Roll Table Kind', {
      kind: 'INLINE',
      options: BRANCH_ROLL_TABLE_KIND_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['resolutionKind']).eq('ROLL_TABLE')
    }))
    .set('table', groupArray(['table'], 'Table', () => BRANCH_ROLL_TABLE_ENTRY_NODE_MAP))
})
