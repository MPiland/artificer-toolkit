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
import { buildNodeMap, type NodeMap } from '#util'
import type { AllUnionFields } from 'type-fest'

const momentRollTableEntry = buildNodeMap<
  MomentRollTableEntry & AllUnionFields<MomentEffectPayload>,
  Omit<MomentRollTable, 'table'>
>()

export const MOMENT_ROLL_TABLE_ENTRY_NODE_MAP = momentRollTableEntry.define(
  (map, { field, and, or, not }) => map({
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
      required: true,
      type: 'NUMBER',
      showIf: field('rollTableKind').eq('RANGE')
    },
    ['rollRange.1']: {
      kind: 'INPUT',
      label: 'Roll Max',
      required: true,
      type: 'NUMBER',
      showIf: field('rollTableKind').eq('RANGE')
    },
    rollValue: {
      kind: 'INPUT',
      label: 'Roll Value',
      required: true,
      type: 'NUMBER',
      showIf: field('rollTableKind').eq('EXACT')
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
      showIf: field('effectKind').eq('DAMAGE')
    },
    damageTypeId: {
      kind: 'INPUT',
      label: 'Damage Type',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'damage_types'
        }
      },
      showIf: field('effectKind').eq('DAMAGE')
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
      showIf: field('effectKind').eq('DAMAGE')
    },
    amount: {
      kind: 'INPUT',
      label: 'Damage Amount',
      requiredIf: not(
        and([
          field('valueKind').eq('POOL'),
          field('scalingKind').eq('PER_LEVEL')
        ])
      ),
      type: 'NUMBER',
      showIf: and([
        field('effectKind').eq('DAMAGE'),
        or([
          and([
            field('scalingKind').eq('NONE'),
            or([
              field('valueKind').eq('FIXED'),
              field('valueKind').eq('POOL')
            ])
          ]),
          and([
            field('scalingKind').eq('PER_LEVEL'),
            field('valueKind').eq('POOL')
          ])
        ])
      ])
    },
    multiplier: {
      kind: 'INPUT',
      label: 'Damage Multiplier',
      type: 'NUMBER',
      showIf: and([
        field('effectKind').eq('DAMAGE'),
        and([
          field('scalingKind').eq('PER_LEVEL'),
          field('valueKind').eq('POOL')
        ])
      ])
    },
    min: {
      kind: 'INPUT',
      label: 'Damage Min',
      type: 'NUMBER',
      showIf: and([
        field('effectKind').eq('DAMAGE'),
        and([
          field('scalingKind').eq('PER_LEVEL'),
          field('valueKind').eq('POOL')
        ])
      ])
    },
    max: {
      kind: 'INPUT',
      label: 'Damage Max',
      type: 'NUMBER',
      showIf: and([
        field('effectKind').eq('DAMAGE'),
        and([
          field('scalingKind').eq('PER_LEVEL'),
          field('valueKind').eq('POOL')
        ])
      ])
    },
    diceConfig: {
      kind: 'INPUT',
      label: 'Damage Dice',
      requiredIf: true,
      type: 'NUMBER',
      showIf: and([
        field('effectKind').eq('DAMAGE'),
        and([
          field('scalingKind').eq('NONE'),
          field('valueKind').eq('DICE')
        ])
      ])
    },
    levels: {
      kind: 'GROUP',
      nodes: DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP,
      showIf: and([
        field('effectKind').eq('DAMAGE'),
        field('scalingKind').eq('PER_LEVEL'),
        not(field('valueKind').eq('POOL'))
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
        field('effectKind').eq('DAMAGE'),
        field('scalingKind').eq('PER_LEVEL'),
        not(field('valueKind').eq('POOL'))
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
          kind: 'ROOT',
          table: 'classes'
        }
      },
      showIf: and([
        field('effectKind').eq('DAMAGE'),
        field('scalingKind').eq('PER_LEVEL'),
        not(field('valueKind').eq('POOL')),
        field('scalingSource').eq('CLASS_LEVEL')
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
          kind: 'ROOT',
          table: 'spells'
        }
      },
      showIf: and([
        field('effectKind').eq('DAMAGE'),
        field('scalingKind').eq('PER_LEVEL'),
        not(field('valueKind').eq('POOL')),
        field('scalingSource').eq('SPELL_LEVEL')
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
          kind: 'ROOT',
          table: 'condition_types'
        }
      },
      showIf: field('effectKind').eq('CONDITION')
    }
  })
)

const moment = buildNodeMap<MomentAuthored>()

type MomentNodeMap = NodeMap<MomentAuthored>

export const MOMENT_NODE_MAP: MomentNodeMap = moment.define((map, { field }) => map({
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
    showIf: field('resolutionKind').eq('ROLL_TABLE')
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
    showIf: field('resolutionKind').eq('ROLL_TABLE')
  },
  table: {
    kind: 'GROUP',
    nodes: MOMENT_ROLL_TABLE_ENTRY_NODE_MAP
  }
}))
