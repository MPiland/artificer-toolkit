import type {
  MomentAuthored,
  MomentEffectPayload,
  MomentRollTable,
  MomentRollTableEntry
} from '#authored'
import {
  DAMAGE_VALUE_OPTIONS,
  EFFECT_KIND_OPTIONS,
  MOMENT_GROUP_TYPE_OPTIONS,
  MOMENT_OPTIONS,
  MOMENT_RESOLUTION_KIND_OPTIONS,
  MOMENT_ROLL_TABLE_KIND_OPTIONS,
  SCALING_SOURCE_OPTIONS
} from '#core'
import {
  DAMAGE_BONUS_NODE_MAP,
  DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP,
  DURATION_NODE_MAP
} from '#maps'
import { buildNodeMap, type NodeMap } from '#utils'

const momentRollTableEntry = buildNodeMap<MomentRollTableEntry & MomentEffectPayload>()

export const MOMENT_ROLL_TABLE_ENTRY_NODE_MAP = momentRollTableEntry.define(
  'momentRollTableEntry',
  ({ map, nodes, cond, logic, data }) => {
    const { text, number, selectSingle, groupObject, groupArray } = nodes
    const { and, or, not } = logic
    const local = cond.local()
    const parent = cond.parent<Omit<MomentRollTable, 'table'>>()
    const { table } = data

    map
      .set('description', text(['description'], 'Description'))
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
      .set('bonuses', groupArray(['bonuses'], 'Bonuses', () => DAMAGE_BONUS_NODE_MAP, {
        showIf: local.field(['effectKind']).eq('DAMAGE')
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
        showIf: and([
          local.field(['effectKind']).eq('DAMAGE'),
          local.field(['scalingKind']).eq('PER_LEVEL'),
          local.field(['valueKind']).eq('POOL')
        ])
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
      .set('spellId', selectSingle(['spellId'], 'Spell', {
        kind: 'DATA',
        relationship: table('spells', {
          selectColumns: ['id', 'label']
        })
      }, {
        requiredIf: true,
        showIf: and([
          local.field(['effectKind']).eq('DAMAGE'),
          local.field(['scalingKind']).eq('PER_LEVEL'),
          not(local.field(['valueKind']).eq('POOL')),
          local.field(['scalingSource']).eq('SPELL_LEVEL')
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
  }
)

const moment = buildNodeMap<MomentAuthored>()

type MomentNodeMap = NodeMap<MomentAuthored>

export const MOMENT_NODE_MAP: MomentNodeMap = moment.define('moment', ({ map, nodes, cond }) => {
  const { selectSingle, text, groupObject, groupArray } = nodes
  const local = cond.local()

  map
    .set('moment', selectSingle(['moment'], 'Moment', {
      kind: 'INLINE',
      options: MOMENT_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('resolutionKind', selectSingle(['resolutionKind'], 'Resolution Kind', {
      kind: 'INLINE',
      options: MOMENT_RESOLUTION_KIND_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('dieConfig', text(['dieConfig'], 'Die Configuration', {
      requiredIf: true,
      showIf: local.field(['resolutionKind']).eq('ROLL_TABLE')
    }))
    .set('groupType', selectSingle(['groupType'], 'Group Type', {
      kind: 'INLINE',
      options: MOMENT_GROUP_TYPE_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('duration', groupObject(['duration'], 'Duration', () => DURATION_NODE_MAP))
    .set('rollTableKind', selectSingle(['rollTableKind'], 'Roll Table Kind', {
      kind: 'INLINE',
      options: MOMENT_ROLL_TABLE_KIND_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['resolutionKind']).eq('ROLL_TABLE')
    }))
    .set('table', groupArray(['table'], 'Table', () => MOMENT_ROLL_TABLE_ENTRY_NODE_MAP))
})
