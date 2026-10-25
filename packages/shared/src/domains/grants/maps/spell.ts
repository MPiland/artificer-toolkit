import type { FacetAuthored, SpellGrantAuthored } from '#authored'
import {
  AUTHORING_MODE_KIND_OPTIONS,
  AUTHORING_SELECTION_DUPLICATE_POLICY_OPTIONS,
  AUTHORING_SELECTION_OPTIONS,
  SCALING_OPTIONS,
  SCALING_SOURCE_OPTIONS,
  SPELL_GRANT_ACCESS_OPTIONS,
  SPELL_GRANT_ATTRIBUTE_OPTIONS
} from '#core'
import { CHARGE_NODE_MAP } from '../../shared/maps/charge.js'
import { FACET_NODE_MAP } from '../../shared/maps/facet.js'
import { AUTHORING_ACTION_PRESENTATIONS, buildNodeMap, type NodeMap } from '#utils'

type SpellGrantProgression = Extract<
  SpellGrantAuthored,
  { scalingKind: 'PER_LEVEL' }
>['progression']
type SpellGrantLevel = SpellGrantProgression['levels'][number]

const SPELL_FILTER_NODE_MAP = FACET_NODE_MAP as NodeMap<FacetAuthored<'SPELL'>>

const perTargetLockout = buildNodeMap<NonNullable<SpellGrantAuthored['perTargetLockout']>>()

const PER_TARGET_LOCKOUT_NODE_MAP = perTargetLockout.define(
  'perTargetLockout',
  ({ map, nodes }) => {
    map.set(
      'until',
      nodes.selectSingle(
        ['until'],
        'Until',
        {
          kind: 'INLINE_OPTIONS',
          options: [{ code: 'SOURCE_LONG_REST', label: 'The Caster’s Long Rest' }]
        },
        { requiredIf: true }
      )
    )
  }
)

const slotCost = buildNodeMap<NonNullable<SpellGrantAuthored['slotCost']>>()

const SLOT_COST_NODE_MAP = slotCost.define('slotCost', ({ map, nodes, data }) => {
  map.set(
    'poolCode',
    nodes.selectSingle(
      ['poolCode'],
      'Spell Slot Pool',
      {
        kind: 'DATA',
        relationship: data.table('spell_slot_pools', {
          selectColumns: ['id', 'label', 'description']
        })
      },
      { requiredIf: true }
    )
  )
})

const spellGrantLevel = buildNodeMap<SpellGrantLevel>()

const SPELL_GRANT_LEVEL_NODE_MAP = spellGrantLevel.define(
  'spellGrantLevel',
  ({ map, nodes, cond, data }) => {
    const { text, number, selectSingle, selectMulti } = nodes
    const local = cond.local()
    const root = cond.ancestor<SpellGrantAuthored>(1)
    const { table } = data

    map
      .set('id', text(['id'], 'ID'))
      .set('level', number(['level'], 'Level'))
      .set('order', number(['order'], 'Order'))
      .set(
        'authoringModeKind',
        selectSingle(['authoringModeKind'], 'Authoring Mode', {
          kind: 'INLINE_OPTIONS',
          options: AUTHORING_MODE_KIND_OPTIONS
        })
      )
      .set(
        'count',
        number(['count'], 'Count', {
          requiredIf: true,
          showIf: root.field(['selectionKind']).eq('CHOSEN')
        })
      )
      .set(
        'selectionDuplicatePolicy',
        selectSingle(
          ['selectionDuplicatePolicy'],
          'Duplicate Policy',
          {
            kind: 'INLINE_OPTIONS',
            options: AUTHORING_SELECTION_DUPLICATE_POLICY_OPTIONS
          },
          {
            requiredIf: true,
            showIf: root.field(['selectionKind']).eq('CHOSEN')
          }
        )
      )
      .set(
        'spellIds',
        selectMulti(
          ['spellIds'],
          'Spells',
          {
            kind: 'DATA',
            relationship: table('spells', {
              selectColumns: ['id', 'label']
            })
          },
          {
            showIf: local.field(['authoringModeKind']).eq('SELECTED')
          }
        )
      )
  }
)

const spellGrantProgression = buildNodeMap<SpellGrantProgression>()

const SPELL_GRANT_PROGRESSION_NODE_MAP = spellGrantProgression.define(
  'spellGrantProgression',
  ({ map, nodes, cond, data }) => {
    const { selectSingle, groupArray } = nodes
    const local = cond.local()
    const { table } = data

    map
      .set(
        'scalingSource',
        selectSingle(['scalingSource'], 'Scaling Source', {
          kind: 'INLINE_OPTIONS',
          options: SCALING_SOURCE_OPTIONS
        })
      )
      .set(
        'classId',
        selectSingle(
          ['classId'],
          'Class',
          {
            kind: 'DATA',
            relationship: table('classes', {
              selectColumns: ['id', 'label']
            })
          },
          {
            showIf: local.field(['scalingSource']).eq('CLASS_LEVEL')
          }
        )
      )
      .set(
        'levels',
        groupArray(['levels'], 'Levels', () => SPELL_GRANT_LEVEL_NODE_MAP, {
          presentation: 'table'
        })
      )
  }
)

const spellGrant = buildNodeMap<SpellGrantAuthored>()

export const SPELL_GRANT_NODE_MAP = spellGrant.define(
  'spellGrant',
  ({ map, nodes, cond, data, logic }) => {
    const { text, selectMulti, number, groupObject, selectSingle } = nodes
    const local = cond.local()
    const { table } = data
    const { and } = logic

    map
      .set('grantKind', text(['grantKind'], 'Grant Kind', { authoring: { exposure: 'system' } }))
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order'))
      .set(
        'selectionKind',
        selectSingle(['selectionKind'], 'Selection Kind', {
          kind: 'INLINE_OPTIONS',
          options: AUTHORING_SELECTION_OPTIONS
        })
      )
      .set(
        'scalingKind',
        selectSingle(['scalingKind'], 'Scaling', {
          kind: 'INLINE_OPTIONS',
          options: SCALING_OPTIONS
        })
      )
      .set(
        'authoringModeKind',
        selectSingle(
          ['authoringModeKind'],
          'Authoring Mode',
          {
            kind: 'INLINE_OPTIONS',
            options: AUTHORING_MODE_KIND_OPTIONS
          },
          {
            showIf: local.field(['scalingKind']).eq('NONE')
          }
        )
      )
      .set(
        'count',
        number(['count'], 'Count', {
          requiredIf: true,
          showIf: and([
            local.field(['selectionKind']).eq('CHOSEN'),
            local.field(['scalingKind']).eq('NONE')
          ])
        })
      )
      .set(
        'selectionDuplicatePolicy',
        selectSingle(
          ['selectionDuplicatePolicy'],
          'Duplicate Policy',
          {
            kind: 'INLINE_OPTIONS',
            options: AUTHORING_SELECTION_DUPLICATE_POLICY_OPTIONS
          },
          {
            requiredIf: true,
            showIf: and([
              local.field(['selectionKind']).eq('CHOSEN'),
              local.field(['scalingKind']).eq('NONE')
            ])
          }
        )
      )
      .set(
        'spellIds',
        selectMulti(
          ['spellIds'],
          'Spells',
          {
            kind: 'DATA',
            relationship: table('spells', {
              selectColumns: ['id', 'label']
            })
          },
          {
            showIf: local.field(['authoringModeKind']).eq('SELECTED')
          }
        )
      )
      .set(
        'attributes',
        selectMulti(['attributes'], 'Attributes', {
          kind: 'INLINE_OPTIONS',
          options: SPELL_GRANT_ATTRIBUTE_OPTIONS
        })
      )
      .set(
        'castAtLevel',
        number(['castAtLevel'], 'Cast At Level', {
          showIf: local.field(['attributes']).contains(['CAST_AT_LEVEL'])
        })
      )
      .set(
        'castingAbility',
        selectSingle(['castingAbility'], 'Casting Ability', {
          kind: 'DATA',
          relationship: data.table('abilities', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set(
        'allowedCreatureTypeIds',
        selectMulti(['allowedCreatureTypeIds'], 'Allowed Creature Types', {
          kind: 'DATA',
          relationship: table('creature_types', {
            selectColumns: ['id', 'label', 'description']
          })
        })
      )
      .set(
        'perTargetLockout',
        groupObject(['perTargetLockout'], 'Once per Target', () => PER_TARGET_LOCKOUT_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['attributes']).contains(['CAST_AT_WILL'])
        })
      )
      .set(
        'slotCost',
        groupObject(['slotCost'], 'Slot Cost', () => SLOT_COST_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['attributes']).contains(['LIMITED_USE'])
        })
      )
      .set(
        'access',
        selectSingle(['access'], 'Access', {
          kind: 'INLINE_OPTIONS',
          options: SPELL_GRANT_ACCESS_OPTIONS
        })
      )
      .set(
        'classListIds',
        selectMulti(
          ['classListIds'],
          'Class Spell Lists',
          {
            kind: 'DATA',
            relationship: table('classes', {
              selectColumns: ['id', 'label']
            })
          },
          {
            requiredIf: true,
            showIf: local.field(['access']).eq('CLASS_LIST_ONLY')
          }
        )
      )
      .set(
        'charges',
        groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['attributes']).contains(['LIMITED_USE'])
        })
      )
      .set(
        'filters',
        groupObject(['filters'], 'Spell Filters', () => SPELL_FILTER_NODE_MAP, {
          presentation: 'inline',
          authoring: {
            actions: [
              {
                type: 'collection.add',
                label: 'Add',
                presentation: AUTHORING_ACTION_PRESENTATIONS.button
              }
            ]
          }
        })
      )
      .set(
        'restrictions',
        groupObject(['restrictions'], 'Restrictions', () => FACET_NODE_MAP, {
          presentation: 'inline',
          authoring: {
            actions: [
              {
                type: 'collection.add',
                label: 'Add',
                presentation: AUTHORING_ACTION_PRESENTATIONS.button
              }
            ]
          }
        })
      )
      .set(
        'progression',
        groupObject(['progression'], 'Progression', () => SPELL_GRANT_PROGRESSION_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['scalingKind']).eq('PER_LEVEL')
        })
      )
  }
)
