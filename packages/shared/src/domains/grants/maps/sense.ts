import type { SenseGrantAuthored } from '#authored'
import {
  AUTHORING_MODE_KIND_OPTIONS,
  AUTHORING_SELECTION_DUPLICATE_POLICY_OPTIONS,
  AUTHORING_SELECTION_OPTIONS,
  SCALING_OPTIONS,
  SCALING_SOURCE_OPTIONS
} from '#core'
import { CHARGE_NODE_MAP } from '../../shared/maps/charge.js'
import { FACET_NODE_MAP } from '../../shared/maps/facet.js'
import { RANGE_NODE_MAP } from '../../shared/maps/range.js'
import { AUTHORING_ACTION_PRESENTATIONS, buildNodeMap } from '#utils'

type SenseGrantProgression = Extract<SenseGrantAuthored, { scalingKind: 'PER_LEVEL' }>['progression']
type SenseGrantLevel = SenseGrantProgression['levels'][number]

const senseGrantLevel = buildNodeMap<SenseGrantLevel>()

const SENSE_GRANT_LEVEL_NODE_MAP = senseGrantLevel.define('senseGrantLevel', ({ map, nodes, cond, data }) => {
  const { text, number, selectSingle, selectMulti } = nodes
  const local = cond.local()
  const root = cond.ancestor<SenseGrantAuthored>(1)
  const { table } = data

  map
    .set('id', text(['id'], 'ID'))
    .set('level', number(['level'], 'Level'))
    .set('order', number(['order'], 'Order'))
    .set('authoringModeKind', selectSingle(['authoringModeKind'], 'Authoring Mode', {
      kind: 'INLINE_OPTIONS',
      options: AUTHORING_MODE_KIND_OPTIONS
    }))
    .set('count', number(['count'], 'Count', {
      requiredIf: true,
      showIf: root.field(['selectionKind']).eq('CHOSEN')
    }))
    .set('selectionDuplicatePolicy', selectSingle(['selectionDuplicatePolicy'], 'Duplicate Policy', {
      kind: 'INLINE_OPTIONS',
      options: AUTHORING_SELECTION_DUPLICATE_POLICY_OPTIONS
    }, {
      requiredIf: true,
      showIf: root.field(['selectionKind']).eq('CHOSEN')
    }))
    .set('senseIds', selectMulti(['senseIds'], 'Senses', {
      kind: 'DATA',
      relationship: table('senses', {
        selectColumns: ['id', 'label']
      })
    }, {
      showIf: local.field(['authoringModeKind']).eq('SELECTED')
    }))
})

const senseGrantProgression = buildNodeMap<SenseGrantProgression>()

const SENSE_GRANT_PROGRESSION_NODE_MAP = senseGrantProgression.define('senseGrantProgression', ({ map, nodes, cond, data }) => {
  const { selectSingle, groupArray } = nodes
  const local = cond.local()
  const { table } = data

  map
    .set('scalingSource', selectSingle(['scalingSource'], 'Scaling Source', {
      kind: 'INLINE_OPTIONS',
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
    .set('levels', groupArray(['levels'], 'Levels', () => SENSE_GRANT_LEVEL_NODE_MAP, { presentation: 'table' }))
})

const senseGrant = buildNodeMap<SenseGrantAuthored>()

export const SENSE_GRANT_NODE_MAP = senseGrant.define('senseGrant', ({ map, nodes, cond, data, logic }) => {
  const { text, number, selectSingle, selectMulti, groupObject } = nodes
  const local = cond.local()
  const { table } = data
  const { and } = logic

  map
    .set('grantKind', text(['grantKind'], 'Grant Kind', { authoring: { exposure: 'system' } }))
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order'))
    .set('selectionKind', selectSingle(['selectionKind'], 'Selection Kind', {
      kind: 'INLINE_OPTIONS',
      options: AUTHORING_SELECTION_OPTIONS
    }))
    .set('scalingKind', selectSingle(['scalingKind'], 'Scaling', {
      kind: 'INLINE_OPTIONS',
      options: SCALING_OPTIONS
    }))
    .set('authoringModeKind', selectSingle(['authoringModeKind'], 'Authoring Mode', {
      kind: 'INLINE_OPTIONS',
      options: AUTHORING_MODE_KIND_OPTIONS
    }, {
      showIf: local.field(['scalingKind']).eq('NONE')
    }))
    .set('count', number(['count'], 'Count', {
      requiredIf: true,
      showIf: and([
        local.field(['selectionKind']).eq('CHOSEN'),
        local.field(['scalingKind']).eq('NONE')
      ])
    }))
    .set('selectionDuplicatePolicy', selectSingle(['selectionDuplicatePolicy'], 'Duplicate Policy', {
      kind: 'INLINE_OPTIONS',
      options: AUTHORING_SELECTION_DUPLICATE_POLICY_OPTIONS
    }, {
      requiredIf: true,
      showIf: and([
        local.field(['selectionKind']).eq('CHOSEN'),
        local.field(['scalingKind']).eq('NONE')
      ])
    }))
    .set('senseIds', selectMulti(['senseIds'], 'Senses', {
      kind: 'DATA',
      relationship: table('senses', {
        selectColumns: ['id', 'label']
      })
    }, {
      showIf: local.field(['authoringModeKind']).eq('SELECTED')
    }))
    .set('charges', groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, { presentation: 'inline' }))
    .set('range', groupObject(['range'], 'Range', () => RANGE_NODE_MAP, { presentation: 'inline' }))
    .set('restrictions', groupObject(['restrictions'], 'Restrictions', () => FACET_NODE_MAP, { presentation: 'inline', authoring: { actions: [{ type: 'collection.add', label: 'Add', presentation: AUTHORING_ACTION_PRESENTATIONS.button }] } }))
    .set('progression', groupObject(['progression'], 'Progression', () => SENSE_GRANT_PROGRESSION_NODE_MAP, { presentation: 'inline',
      showIf: local.field(['scalingKind']).eq('PER_LEVEL')
    }))
})
