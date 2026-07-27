import { CASTING_TIME_UNIT_OPTIONS, SPELL_COMPONENT_OPTIONS, SPELL_ATTRIBUTE_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'
import { EFFECT_NODE_MAP } from '#maps'
import type { SpellAuthored, CastingTimeAuthored } from '#authored'

const SPELL_SECTIONS = {
  basics: { id: 'basics', label: 'Basics', order: 10 },
  casting: { id: 'casting', label: 'Casting', order: 20 },
  relationships: { id: 'relationships', label: 'Relationships', order: 30 },
  effects: { id: 'effects', label: 'Effects', order: 40 }
} as const

// Casting Time Node Map - Fixed with proper DSL
const castingTimeNode = buildNodeMap<CastingTimeAuthored>()
export const CASTING_TIME_NODE_MAP = castingTimeNode.define('castingTime', ({ map, nodes }) => {
  const { selectSingle, number } = nodes
  map
    .set(
      'unit',
      selectSingle(['unit'], 'Unit', {
        kind: 'INLINE_OPTIONS',
        options: CASTING_TIME_UNIT_OPTIONS
      })
    )
    .set('amount', number(['amount'], 'Amount'))
})

// Spell Node Map - Complete map with ALL SpellAuthored properties
const spellNode = buildNodeMap<SpellAuthored>()
export const SPELL_NODE_MAP = spellNode.define('spell', ({ map, nodes, data, cond }) => {
  const { text, richText, number, selectMulti, selectSingle, groupObject, groupArray } = nodes
  const { table } = data
  const local = cond.local()
  map
    .set('kind', text(['kind'], 'Kind', { authoring: { exposure: 'system' } }))
    .set('id', text(['id'], 'ID'))
    .set(
      'label',
      text(['label'], 'Name', {
        section: SPELL_SECTIONS.basics,
        order: 10,
        requiredIf: true
      })
    )
    .set(
      'description',
      richText(['description'], 'Description', { section: SPELL_SECTIONS.basics, order: 20 })
    )
    .set('level', number(['level'], 'Level', { section: SPELL_SECTIONS.basics, order: 30 }))
    .set(
      'materialDescription',
      richText(['materialDescription'], 'Material Description', {
        section: SPELL_SECTIONS.casting,
        order: 40,
        showIf: local.field(['components']).contains(['MATERIAL']),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set(
      'attributes',
      selectMulti(
        ['attributes'],
        'Attributes',
        {
          kind: 'INLINE_OPTIONS',
          options: SPELL_ATTRIBUTE_OPTIONS
        },
        { section: SPELL_SECTIONS.casting, order: 20 }
      )
    )
    .set(
      'components',
      selectMulti(
        ['components'],
        'Components',
        {
          kind: 'INLINE_OPTIONS',
          options: SPELL_COMPONENT_OPTIONS
        },
        { section: SPELL_SECTIONS.casting, order: 30 }
      )
    )
    .set(
      'classIds',
      selectMulti(
        ['classIds'],
        'Classes',
        {
          kind: 'DATA',
          relationship: table('classes', {
            selectColumns: ['id', 'label']
          })
        },
        { section: SPELL_SECTIONS.relationships, order: 10 }
      )
    )
    .set(
      'magicSchoolId',
      selectSingle(
        ['magicSchoolId'],
        'Magic School',
        {
          kind: 'DATA',
          relationship: table('magic_schools', {
            selectColumns: ['id', 'label']
          })
        },
        { section: SPELL_SECTIONS.casting, order: 10 }
      )
    )
    .set(
      'castingTime',
      groupObject(['castingTime'], 'Casting Time', () => CASTING_TIME_NODE_MAP, {
        presentation: 'inline',
        section: SPELL_SECTIONS.casting,
        order: 5
      })
    )
    .set(
      'effects',
      groupArray(['effects'], 'Effects', () => EFFECT_NODE_MAP, {
        section: SPELL_SECTIONS.effects,
        order: 10,
        presentation: 'branch'
      })
    )
})
