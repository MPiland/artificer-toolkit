import type { FacetAuthored, SpellGrantAuthored } from '#authored'
import {
  AUTHORING_MODE_KIND_OPTIONS,
  AUTHORING_SELECTION_OPTIONS,
  SCALING_OPTIONS,
  SCALING_SOURCE_OPTIONS,
  SPELL_GRANT_ATTRIBUTE_OPTIONS
} from '#core'
import { CHARGE_NODE_MAP, FACET_NODE_MAP } from '#maps'
import { buildNodeMap, type NodeMap } from '#utils'

type SpellGrantProgression = Extract<SpellGrantAuthored, { scalingKind: 'PER_LEVEL' }>['progression']
type SpellGrantLevel = SpellGrantProgression['levels'][number]

const SPELL_FILTER_NODE_MAP = FACET_NODE_MAP as NodeMap<FacetAuthored<'SPELL'>>

const spellGrantLevel = buildNodeMap<SpellGrantLevel>()

const SPELL_GRANT_LEVEL_NODE_MAP = spellGrantLevel.define('spellGrantLevel', ({ map, nodes, cond, data }) => {
  const { text, number, selectSingle, selectMulti } = nodes
  const local = cond.local()
  const root = cond.ancestor<SpellGrantAuthored>(1)
  const { table } = data

  map
    .set('id', text(['id'], 'ID'))
    .set('level', number(['level'], 'Level'))
    .set('order', number(['order'], 'Order'))
    .set('authoringModeKind', selectSingle(['authoringModeKind'], 'Authoring Mode', {
      kind: 'INLINE',
      options: AUTHORING_MODE_KIND_OPTIONS
    }))
    .set('count', number(['count'], 'Count', {
      showIf: root.field(['selectionKind']).eq('CHOSEN')
    }))
    .set('spellIds', selectMulti(['spellIds'], 'Spells', {
      kind: 'DATA',
      relationship: table('spells', {
        selectColumns: ['id', 'label']
      })
    }, {
      showIf: local.field(['authoringModeKind']).eq('SELECTED')
    }))
})

const spellGrantProgression = buildNodeMap<SpellGrantProgression>()

const SPELL_GRANT_PROGRESSION_NODE_MAP = spellGrantProgression.define('spellGrantProgression', ({ map, nodes, cond, data }) => {
  const { selectSingle, groupArray } = nodes
  const local = cond.local()
  const { table } = data

  map
    .set('scalingSource', selectSingle(['scalingSource'], 'Scaling Source', {
      kind: 'INLINE',
      options: SCALING_SOURCE_OPTIONS
    }))
    .set('classId', selectSingle(['classId'], 'Class', {
      kind: 'DATA',
      relationship: table('classes', {
        selectColumns: ['id', 'label']
      })
    }, {
      showIf: local.field(['scalingSource']).eq('CLASS_LEVEL')
    }))
    .set('levels', groupArray(['levels'], 'Levels', () => SPELL_GRANT_LEVEL_NODE_MAP))
})

const spellGrant = buildNodeMap<SpellGrantAuthored>()

export const SPELL_GRANT_NODE_MAP = spellGrant.define('spellGrant', ({ map, nodes, cond, data }) => {
  const { text, selectMulti, number, groupObject, selectSingle } = nodes
  const local = cond.local()
  const { table } = data

  map
    .set('grantKind', text(['grantKind'], 'Grant Kind'))
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order'))
    .set('selectionKind', selectSingle(['selectionKind'], 'Selection Kind', {
      kind: 'INLINE',
      options: AUTHORING_SELECTION_OPTIONS
    }))
    .set('scalingKind', selectSingle(['scalingKind'], 'Scaling', {
      kind: 'INLINE',
      options: SCALING_OPTIONS
    }))
    .set('authoringModeKind', selectSingle(['authoringModeKind'], 'Authoring Mode', {
      kind: 'INLINE',
      options: AUTHORING_MODE_KIND_OPTIONS
    }, {
      showIf: local.field(['scalingKind']).eq('NONE')
    }))
    .set('count', number(['count'], 'Count', {
      showIf: local.field(['selectionKind']).eq('CHOSEN')
    }))
    .set('spellIds', selectMulti(['spellIds'], 'Spells', {
      kind: 'DATA',
      relationship: table('spells', {
        selectColumns: ['id', 'label']
      })
    }, {
      showIf: local.field(['authoringModeKind']).eq('SELECTED')
    }))
    .set('attributes', selectMulti(['attributes'], 'Attributes', {
      kind: 'INLINE',
      options: SPELL_GRANT_ATTRIBUTE_OPTIONS
    }))
    .set('castAtLevel', number(['castAtLevel'], 'Cast At Level', {
      showIf: local.field(['attributes']).contains(['CAST_AT_LEVEL'])
    }))
    .set('charges', groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, {
      showIf: local.field(['attributes']).contains(['LIMITED_USE'])
    }))
    .set('filters', groupObject(['filters'], 'Spell Filters', () => SPELL_FILTER_NODE_MAP))
    .set('restrictions', groupObject(['restrictions'], 'Restrictions', () => FACET_NODE_MAP))
    .set('progression', groupObject(['progression'], 'Progression', () => SPELL_GRANT_PROGRESSION_NODE_MAP, {
      showIf: local.field(['scalingKind']).eq('PER_LEVEL')
    }))
})
