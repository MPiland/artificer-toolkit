import { buildNodeMap } from '#utils'
import type { ScopedFacetAuthored } from '#authored'
import { AUTHORING_MODE_KIND_OPTIONS, NODE_SUBJECT_OPTIONS, PROFICIENCY_KIND_OPTIONS } from '#core'
import { FACET_BODY_GROUP_NODE_MAP } from './facet.js'
import { LOGIC_OPTION_AUTHORING } from './facetLogicAuthoring.js'

const facetScopedNode = buildNodeMap<ScopedFacetAuthored>()

export const FACET_SCOPED_NODE_MAP = facetScopedNode.define('facetScoped', (api) => {
  const { map, nodes, cond, data, logic } = api
  const { and, not } = logic
  const local = cond.local()

  const { selectSingle, selectMulti, groupArray } = nodes
  const { table } = data

  map
    .set(
      'subject',
      selectSingle(
        ['subject'],
        'Context',
        {
          kind: 'INLINE_OPTIONS',
          options: NODE_SUBJECT_OPTIONS
        },
        {
          order: 1,
          requiredIf: true
        }
      )
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
          order: 2,
          showIf: not(local.field(['subject']).eq('CHARACTER'))
        }
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
        {
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('CLASS'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
        }
      )
    )
    .set(
      'featureIds',
      selectMulti(
        ['featureIds'],
        'Features',
        {
          kind: 'DATA',
          relationship: table('features', {
            selectColumns: ['id', 'label']
          })
        },
        {
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('FEATURE'),
            local.field(['authoringModeKind']).eq('SELECTED')
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
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('SPELL'),
            local.field(['authoringModeKind']).eq('SELECTED')
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
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('EQUIPMENT'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
        }
      )
    )
    .set(
      'featIds',
      selectMulti(
        ['featIds'],
        'Feats',
        {
          kind: 'DATA',
          relationship: table('feats', {
            selectColumns: ['id', 'label']
          })
        },
        {
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('FEAT'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
        }
      )
    )
    .set(
      'raceIds',
      selectMulti(
        ['raceIds'],
        'Races',
        {
          kind: 'DATA',
          relationship: table('races', {
            selectColumns: ['id', 'label']
          })
        },
        {
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('RACE'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
        }
      )
    )
    .set(
      'backgroundIds',
      selectMulti(
        ['backgroundIds'],
        'Backgrounds',
        {
          kind: 'DATA',
          relationship: table('backgrounds', {
            selectColumns: ['id', 'label']
          })
        },
        {
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('BACKGROUND'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
        }
      )
    )
    .set(
      'optionIds',
      selectMulti(
        ['optionIds'],
        'Options',
        {
          kind: 'DATA',
          relationship: table('options', {
            selectColumns: ['id', 'label']
          })
        },
        {
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('OPTION'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
        }
      )
    )
    .set(
      'ancestryOptionIds',
      selectMulti(
        ['ancestryOptionIds'],
        'Ancestry Options',
        {
          kind: 'DATA',
          relationship: table('race_ancestry_options', {
            selectColumns: ['id', 'label']
          })
        },
        {
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('RACE_ANCESTRY_OPTION'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
        }
      )
    )
    .set(
      'resourceIds',
      selectMulti(
        ['resourceIds'],
        'Resources',
        {
          kind: 'DATA',
          relationship: {
            kind: 'TABLE',
            table: 'class_resources',
            selectColumns: ['id', 'label']
          }
        },
        {
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('RESOURCE'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
        }
      )
    )
    .set(
      'subclassIds',
      selectMulti(
        ['subclassIds'],
        'Subclasses',
        {
          kind: 'DATA',
          relationship: table('classes', {
            selectColumns: ['id', 'label'],
            where: (col) => col('category').eq('SUBCLASS')
          })
        },
        {
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('SUBCLASS'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
        }
      )
    )
    .set(
      'subraceIds',
      selectMulti(
        ['subraceIds'],
        'Subraces',
        {
          kind: 'DATA',
          relationship: table('races', {
            selectColumns: ['id', 'label'],
            where: (col) => col('category').eq('SUBRACE')
          })
        },
        {
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('SUBRACE'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
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
          order: 3,
          requiredIf: true,
          showIf: and([
            local.field(['subject']).eq('PROFICIENCY_GRANT'),
            local.field(['authoringModeKind']).eq('SELECTED')
          ])
        }
      )
    )
    .set(
      'groups',
      groupArray(['groups'], 'Groups', () => FACET_BODY_GROUP_NODE_MAP, {
        presentation: 'inline',
        ...LOGIC_OPTION_AUTHORING
      })
    )
})
