import type { ProficiencyGrantAuthored } from '#authored'
import {
  AUTHORING_MODE_KIND_OPTIONS,
  AUTHORING_SELECTION_DUPLICATE_POLICY_OPTIONS,
  AUTHORING_SELECTION_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_PROPERTY_OPTIONS,
  PROFICIENCY_KIND_OPTIONS,
  ROUNDING_OPTIONS,
  SCALING_AMOUNT_OPTIONS
} from '#core'
import { FACET_NODE_MAP } from '../../shared/maps/facet.js'
import { AUTHORING_ACTION_PRESENTATIONS, buildNodeMap, type NodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'

type ProficiencyGrantUnion = AllUnionFields<ProficiencyGrantAuthored>

const PROFICIENCY_RESTRICTIONS_NODE_MAP = FACET_NODE_MAP as NodeMap<
  NonNullable<ProficiencyGrantUnion['restrictions']>
>

const proficiencyNodeMap = buildNodeMap<ProficiencyGrantUnion>()

export const PROFICIENCY_NODE_MAP = proficiencyNodeMap.define(
  'proficiencyGrant',
  ({ map, nodes, cond, logic, data }) => {
    const { text, number, selectSingle, selectMulti, groupObject } = nodes
    const { and, or } = logic
    const local = cond.local()
    const { table } = data

    map
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
        'count',
        number(['count'], 'Count', {
          requiredIf: true,
          showIf: local.field(['selectionKind']).eq('CHOSEN')
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
            showIf: local.field(['selectionKind']).eq('CHOSEN')
          }
        )
      )
      .set(
        'proficiencyKind',
        selectSingle(
          ['proficiencyKind'],
          'Proficiency Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: PROFICIENCY_KIND_OPTIONS
          },
          {
            requiredIf: true
          }
        )
      )
      .set(
        'authoringModeKind',
        selectSingle(['authoringModeKind'], 'Authoring Mode', {
          kind: 'INLINE_OPTIONS',
          options: AUTHORING_MODE_KIND_OPTIONS
        })
      )
      .set(
        'level',
        selectSingle(
          ['level'],
          'Level',
          {
            kind: 'INLINE_OPTIONS',
            options: SCALING_AMOUNT_OPTIONS
          },
          {
            requiredIf: true
          }
        )
      )
      .set(
        'rounding',
        selectSingle(
          ['rounding'],
          'Rounding',
          {
            kind: 'INLINE_OPTIONS',
            options: ROUNDING_OPTIONS
          },
          {
            requiredIf: true,
            showIf: local.field(['level']).eq('HALF')
          }
        )
      )
      .set(
        'skillIds',
        selectMulti(
          ['skillIds'],
          'Skills',
          {
            kind: 'DATA',
            relationship: table('skills', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            requiredIf: true,
            showIf: and([
              local.field(['authoringModeKind']).eq('SELECTED'),
              local.field(['proficiencyKind']).eq('SKILL')
            ])
          }
        )
      )
      .set(
        'abilities',
        selectMulti(
          ['abilities'],
          'Abilities',
          {
            kind: 'DATA',
            relationship: data.table('abilities', { selectColumns: ['id', 'label', 'description'] })
          },
          {
            requiredIf: true,
            showIf: and([
              local.field(['authoringModeKind']).eq('SELECTED'),
              local.field(['proficiencyKind']).eq('SAVE_ABILITY')
            ])
          }
        )
      )
      .set(
        'languageIds',
        selectMulti(
          ['languageIds'],
          'Languages',
          {
            kind: 'DATA',
            relationship: table('languages', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            requiredIf: true,
            showIf: and([
              local.field(['authoringModeKind']).eq('SELECTED'),
              local.field(['proficiencyKind']).eq('LANGUAGE')
            ])
          }
        )
      )
      .set(
        'equipmentIds',
        selectMulti(
          ['equipmentIds'],
          'Equipment',
          {
            kind: 'DATA',
            relationship: table('equipment', {
              selectColumns: ['id', 'label']
            })
          },
          {
            requiredIf: true,
            showIf: and([
              local.field(['authoringModeKind']).eq('SELECTED'),
              local.field(['proficiencyKind']).eq('EQUIPMENT')
            ])
          }
        )
      )
      .set(
        'category',
        selectSingle(
          ['category'],
          'Category',
          {
            kind: 'INLINE_OPTIONS',
            options: EQUIPMENT_CATEGORY_OPTIONS
          },
          {
            requiredIf: local.field(['proficiencyKind']).eq('EQUIPMENT_PROPERTY'),
            showIf: or([
              local.field(['proficiencyKind']).eq('EQUIPMENT_PROPERTY'),
              local.field(['proficiencyKind']).eq('EQUIPMENT')
            ])
          }
        )
      )
      .set(
        'properties',
        selectMulti(
          ['properties'],
          'Properties',
          {
            kind: 'INLINE_OPTIONS',
            options: EQUIPMENT_PROPERTY_OPTIONS
          },
          {
            requiredIf: local.field(['proficiencyKind']).eq('EQUIPMENT_PROPERTY'),
            showIf: or([
              and([
                local.field(['authoringModeKind']).eq('SELECTED'),
                local.field(['proficiencyKind']).eq('EQUIPMENT_PROPERTY')
              ]),
              local.field(['proficiencyKind']).eq('EQUIPMENT')
            ])
          }
        )
      )
      .set(
        'restrictions',
        groupObject(['restrictions'], 'Restrictions', () => PROFICIENCY_RESTRICTIONS_NODE_MAP, {
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
  }
)
