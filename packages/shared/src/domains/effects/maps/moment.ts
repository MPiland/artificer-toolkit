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

const momentRollTableEntry = buildNodeMap<
  MomentRollTableEntry & MomentEffectPayload,
  Omit<MomentRollTable, 'table'>
>()

export const MOMENT_ROLL_TABLE_ENTRY_NODE_MAP = momentRollTableEntry.define(
  (map, { context, local, and, or, not }) => map({
    description: {
      kind: 'INPUT',
      label: 'Description',
      type: 'TEXT'
    },
    duration: {
      kind: 'GROUP',
      nodes: DURATION_NODE_MAP
    },
    ['rollRange.0']: {
      kind: 'INPUT',
      label: 'Roll Min',
      requiredIf: true,
      type: 'NUMBER',
      showIf: context('rollTableKind').eq('RANGE')
    },
    ['rollRange.1']: {
      kind: 'INPUT',
      label: 'Roll Max',
      requiredIf: true,
      type: 'NUMBER',
      showIf: context('rollTableKind').eq('RANGE')
    },
    rollValue: {
      kind: 'INPUT',
      label: 'Roll Value',
      requiredIf: true,
      type: 'NUMBER',
      showIf: context('rollTableKind').eq('EXACT')
    },
    effectKind: {
      kind: 'INPUT',
      label: 'Effect Kind',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: EFFECT_KIND_OPTIONS
      }
    },
    bonuses: {
      kind: 'GROUP',
      nodes: DAMAGE_BONUS_NODE_MAP,
      showIf: local('effectKind').eq('DAMAGE')
    },
    damageTypeId: {
      kind: 'INPUT',
      label: 'Damage Type',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'TABLE',
          table: 'damage_types'
        }
      },
      showIf: local('effectKind').eq('DAMAGE')
    },
    valueKind: {
      kind: 'INPUT',
      label: 'Damage Value Kind',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: DAMAGE_VALUE_OPTIONS
      },
      showIf: local('effectKind').eq('DAMAGE')
    },
    amount: {
      kind: 'INPUT',
      label: 'Damage Amount',
      requiredIf: not(
        and([
          local('valueKind').eq('POOL'),
          local('scalingKind').eq('PER_LEVEL')
        ])
      ),
      type: 'NUMBER',
      showIf: and([
        local('effectKind').eq('DAMAGE'),
        or([
          and([
            local('scalingKind').eq('NONE'),
            or([
              local('valueKind').eq('FIXED'),
              local('valueKind').eq('POOL')
            ])
          ]),
          and([
            local('scalingKind').eq('PER_LEVEL'),
            local('valueKind').eq('POOL')
          ])
        ])
      ])
    },
    multiplier: {
      kind: 'INPUT',
      label: 'Damage Multiplier',
      type: 'NUMBER',
      showIf: and([
        local('effectKind').eq('DAMAGE'),
        and([
          local('scalingKind').eq('PER_LEVEL'),
          local('valueKind').eq('POOL')
        ])
      ])
    },
    min: {
      kind: 'INPUT',
      label: 'Damage Min',
      type: 'NUMBER',
      showIf: and([
        local('effectKind').eq('DAMAGE'),
        and([
          local('scalingKind').eq('PER_LEVEL'),
          local('valueKind').eq('POOL')
        ])
      ])
    },
    max: {
      kind: 'INPUT',
      label: 'Damage Max',
      type: 'NUMBER',
      showIf: and([
        local('effectKind').eq('DAMAGE'),
        and([
          local('scalingKind').eq('PER_LEVEL'),
          local('valueKind').eq('POOL')
        ])
      ])
    },
    diceConfig: {
      kind: 'INPUT',
      label: 'Damage Dice',
      requiredIf: true,
      type: 'NUMBER',
      showIf: and([
        local('effectKind').eq('DAMAGE'),
        and([
          local('scalingKind').eq('NONE'),
          local('valueKind').eq('DICE')
        ])
      ])
    },
    levels: {
      kind: 'GROUP',
      nodes: DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP,
      showIf: and([
        local('effectKind').eq('DAMAGE'),
        local('scalingKind').eq('PER_LEVEL'),
        not(local('valueKind').eq('POOL'))
      ])
    },
    scalingSource: {
      kind: 'INPUT',
      label: 'Scaling Source',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: SCALING_SOURCE_OPTIONS
      },
      showIf: and([
        local('effectKind').eq('DAMAGE'),
        local('scalingKind').eq('PER_LEVEL'),
        not(local('valueKind').eq('POOL'))
      ])
    },
    classId: {
      kind: 'INPUT',
      label: 'Class',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'TABLE',
          table: 'classes'
        }
      },
      showIf: and([
        local('effectKind').eq('DAMAGE'),
        local('scalingKind').eq('PER_LEVEL'),
        not(local('valueKind').eq('POOL')),
        local('scalingSource').eq('CLASS_LEVEL')
      ])
    },
    spellId: {
      kind: 'INPUT',
      label: 'Spell',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'TABLE',
          table: 'spells'
        }
      },
      showIf: and([
        local('effectKind').eq('DAMAGE'),
        local('scalingKind').eq('PER_LEVEL'),
        not(local('valueKind').eq('POOL')),
        local('scalingSource').eq('SPELL_LEVEL')
      ])
    },
    conditionId: {
      kind: 'INPUT',
      label: 'Condition',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'TABLE',
          table: 'condition_types'
        }
      },
      showIf: local('effectKind').eq('CONDITION')
    }
  })
)

const moment = buildNodeMap<MomentAuthored>()

type MomentNodeMap = NodeMap<MomentAuthored>

export const MOMENT_NODE_MAP: MomentNodeMap = moment.define((map, { local }) => map({
  moment: {
    kind: 'INPUT',
    label: 'Moment',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: MOMENT_OPTIONS
    }
  },
  resolutionKind: {
    kind: 'INPUT',
    label: 'Resolution Kind',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: MOMENT_RESOLUTION_KIND_OPTIONS
    }
  },
  dieConfig: {
    kind: 'INPUT',
    label: 'Die Configuration',
    requiredIf: true,
    type: 'TEXT',
    showIf: local('resolutionKind').eq('ROLL_TABLE')
  },
  groupType: {
    kind: 'INPUT',
    label: 'Group Type',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: MOMENT_GROUP_TYPE_OPTIONS
    }
  },
  duration: {
    kind: 'GROUP',
    nodes: DURATION_NODE_MAP
  },
  rollTableKind: {
    kind: 'INPUT',
    label: 'Roll Table Kind',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: MOMENT_ROLL_TABLE_KIND_OPTIONS
    },
    showIf: local('resolutionKind').eq('ROLL_TABLE')
  },
  table: {
    kind: 'GROUP',
    nodes: MOMENT_ROLL_TABLE_ENTRY_NODE_MAP
  }
}))
