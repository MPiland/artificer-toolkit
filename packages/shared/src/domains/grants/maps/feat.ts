import type { FeatGrantAuthored } from '#authored'
import {
  AUTHORING_MODE_KIND_OPTIONS,
  AUTHORING_SELECTION_OPTIONS,
  SCALING_OPTIONS,
  SCALING_SOURCE_OPTIONS
} from '#core'
import { FACET_NODE_MAP, CHARGE_NODE_MAP } from '#maps'
import { buildNodeMap } from '#utils'

type FeatGrantProgression = Extract<FeatGrantAuthored, { scalingKind: 'PER_LEVEL' }>['progression']
type FeatGrantLevel = FeatGrantProgression['levels'][number]

const featGrantLevel = buildNodeMap<FeatGrantLevel>()

const FEAT_GRANT_LEVEL_NODE_MAP = featGrantLevel.define('featGrantLevel', ({ map, nodes, cond, data }) => {
  const { text, number, selectSingle, selectMulti } = nodes
  const local = cond.local()
  const root = cond.ancestor<FeatGrantAuthored>(1)
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
    .set('featIds', selectMulti(['featIds'], 'Feats', {
      kind: 'DATA',
      relationship: table('feats', {
        selectColumns: ['id', 'label']
      })
    }, {
      showIf: local.field(['authoringModeKind']).eq('SELECTED')
    }))
})

const featGrantProgression = buildNodeMap<FeatGrantProgression>()

const FEAT_GRANT_PROGRESSION_NODE_MAP = featGrantProgression.define('featGrantProgression', ({ map, nodes, cond, data }) => {
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
    .set('levels', groupArray(['levels'], 'Levels', () => FEAT_GRANT_LEVEL_NODE_MAP))
})

const featGrant = buildNodeMap<FeatGrantAuthored>()

export const FEAT_GRANT_NODE_MAP = featGrant.define('featGrant', ({ map, nodes, cond }) => {
  const { text, number, selectSingle, selectMulti, groupObject } = nodes
  const local = cond.local()

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
    .set('featIds', selectMulti(['featIds'], 'Feats', {
      kind: 'DATA',
      relationship: {
        kind: 'TABLE',
        table: 'feats',
        selectColumns: ['id', 'label']
      }
    }, {
      showIf: local.field(['authoringModeKind']).eq('SELECTED')
    }))
    .set('charges', groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP))
    .set('restrictions', groupObject(['restrictions'], 'Restrictions', () => FACET_NODE_MAP))
    .set('progression', groupObject(['progression'], 'Progression', () => FEAT_GRANT_PROGRESSION_NODE_MAP, {
      showIf: local.field(['scalingKind']).eq('PER_LEVEL')
    }))
})
