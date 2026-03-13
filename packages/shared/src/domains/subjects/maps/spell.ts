import {
  CASTING_TIME_UNIT_OPTIONS,
  SPELL_ATTRIBUTE_OPTIONS,
  type CastingTimeUnitCode,
  type SpellAttribute
} from '#core'
import { buildNodeMap } from '#utils'
import { EFFECT_NODE_MAP } from '#maps'
import type { SpellAuthored, CastingTimeAuthored } from '#authored'

// Casting Time Node Map - Fixed with proper DSL
const castingTimeNode = buildNodeMap<CastingTimeAuthored>()
export const CASTING_TIME_NODE_MAP = castingTimeNode.define('castingTime', ({ map, nodes }) => {
  const { selectSingle, number } = nodes
  map
    .set('unit', selectSingle(['unit'], 'Unit', {
      kind: 'INLINE',
      options: CASTING_TIME_UNIT_OPTIONS
    }))
    .set('amount', number(['amount'], 'Amount'))
})

// Spell Node Map - Complete map with ALL SpellAuthored properties
const spellNode = buildNodeMap<SpellAuthored>()
export const SPELL_NODE_MAP = spellNode.define('spell', ({ map, nodes, data }) => {
  const { text, number, selectMulti, selectSingle } = nodes
  const { table } = data
  map
    .set('kind', text(['kind'], 'Kind'))
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('level', number(['level'], 'Level'))
    .set('materialDescription', text(['materialDescription'], 'Material Description'))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set('attributes', selectMulti(['attributes'], 'Attributes', {
      kind: 'INLINE',
      options: SPELL_ATTRIBUTE_OPTIONS
    }))
    .set('classIds', selectMulti(['classIds'], 'Classes', {
      kind: 'DATA',
      relationship: table('classes', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('magicSchoolId', selectSingle(['magicSchoolId'], 'Magic School', {
      kind: 'DATA',
      relationship: table('magic_schools', {
        selectColumns: ['id', 'label']
      })
    }))
})
