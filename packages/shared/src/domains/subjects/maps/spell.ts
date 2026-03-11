import {
  CASTING_TIME_UNIT_OPTIONS,
  SPELL_ATTRIBUTE_OPTIONS,
  type CastingTimeUnitCode,
  type SpellAttribute
} from '#core'
import { type NodeMap } from '#utils'
import { EFFECT_NODE_MAP } from '../../../../dist/maps/maps.js'

export type SpellNodePayloads = {
  attributes: { attributes: SpellAttribute[] }
  castingTimes: { castingTimes: CastingTimeUnitCode[] }
  magicSchools: { magicSchoolIds: string[] }
  levels: { levels: number[] }
  classes: { classIds: string[] }
}

export const SPELL_NODE_MAP: NodeMap<SpellNodePayloads> = {
  attributes: {
    kind: 'LEAF',
    payload: 'attributes',
    meta: {
      label: 'Spell Attributes',
      code: 'SPELL_ATTRIBUTES',
      tooltip: 'Attributes of the selected spell(s).'
    },
    options: [
      {
        kind: 'INLINE',
        options: SPELL_ATTRIBUTE_OPTIONS,
        selection: 'MULTI_REQUIRED',
        order: 0
      }
    ]
  },
  effects: {
    kind: 'BRANCH',
    enables: {
      kind: 'PATH',
      map: EFFECT_NODE_MAP
    }
  },
  castingTimes: {
    kind: 'LEAF',
    meta: {
      label: 'Casting Times',
      code: 'CASTING_TIMES',
      tooltip: 'The time it takes to cast the spell.'
    },
    payload: 'castingTimes',
    options: [
      {
        kind: 'INLINE',
        selection: 'MULTI_REQUIRED',
        options: CASTING_TIME_UNIT_OPTIONS,
        order: 0
      }
    ]
  },
  magicSchools: {
    kind: 'LEAF',
    meta: {
      label: 'Magic Schools',
      code: 'MAGIC_SCHOOLS',
      tooltip: 'The magic schools associated with the spell.'
    },
    payload: 'magicSchools',
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'magic_schools'
        },
        selection: 'MULTI_REQUIRED',
        order: 0
      }
    ]
  },
  levels: {
    kind: 'LEAF',
    meta: {
      label: 'Level',
      code: 'LEVELS',
      tooltip: 'The level of the spell.'
    },
    payload: 'levels'
  },
  classes: {
    kind: 'BRANCH',
    meta: {
      label: 'Classes',
      code: 'CLASSES',
      tooltip: 'The classes associated with the spell.'
    },
    payload: 'classes',
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'BRIDGE',
          table: 'spell_classes',
          parentColumn: 'spell_id',
          childColumn: 'class_id'
        },
        order: 0
      }
    ]
  }
}
