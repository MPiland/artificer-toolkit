import { buildNodeMap, type ConditionIfExpr, type NodeEntry, type NodeMap } from '#utils'
import {
  FacetBodyAuthored,
  FacetBodyGroupAuthored,
  PredicateConditionAuthored,
  SubjectSelectionAuthored,
  type ExistsConditionAuthored,
  type FacetConditionAuthored,
  type FacetAuthored,
  type FacetContextAuthored,
  type FacetGroupAuthored,
  type ScopedFacetAuthored
} from '#authored'
import {
  ABILITY_OPTIONS,
  ACTIVATION_OPTIONS,
  AUTHORING_CONSTRAINT_OPTIONS,
  AUTHORING_MODE_KIND_OPTIONS,
  CHARGE_LIMIT_OPTIONS,
  CHARGE_RESET_OPTIONS,
  DURATION_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_PROPERTY_OPTIONS,
  getPredicateOptionsForSubject,
  getRelatedSubjectOptions,
  NODE_SUBJECT_OPTIONS,
  PROFICIENCY_KIND_OPTIONS,
  RANGE_OPTIONS,
  RELATION_CODES,
  RELATION_SUBJECTS,
  SCALING_AMOUNT_OPTIONS,
  SELECTABLE_PREDICATE_CODES,
  SIZE_OPTIONS
} from '#core'
import type { AllUnionFields } from 'type-fest'
import {
  actionAppearancePresets,
  actionPresentationPresets
} from '@artificer-toolkit/design-system'

const LOGIC_OPTION_AUTHORING = {
  authoring: {
    collection: {
      actions: [
        {
          type: 'collection.add',
          label: 'Add option',
          presentation: {
            default: actionAppearancePresets.text,
            compact: {
              ...actionAppearancePresets.button,
              width: 'full',
              density: 'comfortable'
            }
          }
        },
        {
          type: 'collection.remove',
          label: 'Remove option',
          presentation: actionPresentationPresets.icon
        }
      ],
      ordering: { mode: 'derived' },
      itemLabel: 'option',
      emptyLabel: 'No restriction options added yet.',
      showHeading: false,
      join: 'OR',
      rowLayout: 'card',
      rowExpansion: 'expanded'
    }
  }
} as const

const LOGIC_CONTEXT_AUTHORING = {
  authoring: {
    collection: {
      actions: [
        {
          type: 'collection.add',
          label: 'Add condition',
          presentation: {
            default: actionAppearancePresets.text,
            compact: {
              ...actionAppearancePresets.button,
              width: 'full',
              density: 'comfortable'
            }
          }
        },
        {
          type: 'collection.remove',
          label: 'Remove condition',
          presentation: actionPresentationPresets.text
        }
      ],
      ordering: { mode: 'derived' },
      itemLabel: 'condition',
      emptyLabel: 'No conditions added yet.',
      showHeading: false,
      join: 'AND',
      rowLayout: 'flat',
      rowExpansion: 'expanded',
      rowSummary: 'facet-context'
    }
  }
} as const

const LOGIC_CONDITION_AUTHORING = {
  authoring: {
    collection: {
      actions: [],
      ordering: { mode: 'derived' },
      itemLabel: 'condition',
      emptyLabel: 'This condition has not been configured yet.',
      showHeading: false,
      join: 'AND',
      rowLayout: 'compact',
      rowExpansion: 'expanded',
      rowSummary: 'facet-condition'
    }
  }
} as const

const facetBodyGroupNode = buildNodeMap<FacetBodyGroupAuthored>()

const FACET_BODY_GROUP_NODE_MAP = facetBodyGroupNode.define('facetBodyGroup', ({ map, nodes }) => {
  const { groupArray } = nodes
  map.set(
    'conditions',
    groupArray(['conditions'], 'Conditions', () => FACET_BODY_CONDITION_NODE_MAP, {
      presentation: 'inline',
      ...LOGIC_CONDITION_AUTHORING
    })
  )
})

const facetBodyNode = buildNodeMap<FacetBodyAuthored>()

const FACET_BODY_NODE_MAP = facetBodyNode.define(
  'facetBody',
  ({ map, logic, cond, nodes, data }) => {
    const { and } = logic
    const local = cond.local()
    const p = cond.parent<ExistsConditionAuthored>()

    const { selectSingle, selectMulti, groupArray } = nodes
    const { table } = data

    map
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
            order: 2
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
              p.field(['relationCode']).eq('FEATURE'),
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
              p.field(['relationCode']).eq('OPTION'),
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
              p.field(['relationCode']).eq('RACE_ANCESTRY_OPTION'),
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
              p.field(['relationCode']).eq('RESOURCE'),
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
              p.field(['relationCode']).eq('SUBCLASS'),
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
              p.field(['relationCode']).eq('SUBRACE'),
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
              p.field(['relationCode']).eq('PROFICIENCY_GRANT'),
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
  }
)

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

const facetExistsNode = buildNodeMap<ExistsConditionAuthored>()

type FacetExistMin = AllUnionFields<
  (Pick<ExistsConditionAuthored, 'relationCode'> | Pick<FacetContextAuthored, 'subject'>) &
    SubjectSelectionAuthored
>

function createFacetExistsNodeMap(
  mapId: string,
  ownerScope: 'PARENT' | 'BODY'
): NodeMap<ExistsConditionAuthored> {
  return facetExistsNode.define(mapId, ({ map, logic, cond, data, nodes }) => {
    const { or } = logic
    const local = cond.local()
    const owner =
      ownerScope === 'PARENT' ? cond.parent<FacetExistMin>() : cond.ancestor<FacetExistMin>(3)
    const selection =
      ownerScope === 'PARENT' ? cond.parent<FacetExistMin>() : cond.ancestor<FacetExistMin>(2)
    const p = { field: owner.field, id: selection.id, scope: selection.scope }

    const { selectSingle, selectMulti, groupObject } = nodes
    const { chain, condition } = data

    const relatedOptions = [
      ...RELATION_SUBJECTS.map((s) => ({
        showIf: p.field(['subject']).eq(s),
        options: getRelatedSubjectOptions(s)
      })),

      ...RELATION_CODES.map((r) => ({
        showIf: p.field(['relationCode']).eq(r),
        options: getRelatedSubjectOptions(r)
      }))
    ]

    map
      .set(
        'constraint',
        selectSingle(
          ['constraint'],
          'Constraint',
          {
            kind: 'INLINE_OPTIONS',
            options: AUTHORING_CONSTRAINT_OPTIONS
          },
          { order: 1, requiredIf: true }
        )
      )
      .set(
        'relationCode',
        selectSingle(
          ['relationCode'],
          'Relation',
          {
            kind: 'INLINE_GROUPS',
            optionGroups: relatedOptions
          },
          { order: 2, requiredIf: true }
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
          { order: 3 }
        )
      )
      .set(
        'featureIds',
        selectMulti(
          ['featureIds'],
          'Features',
          {
            kind: 'DATA',
            relationship: chain((s) =>
              s
                .condition((c) =>
                  c
                    .if(p.field(['subject']).eq('CLASS'))
                    .then((o) =>
                      o.mapValues('class_features', {
                        whereColumn: 'class_id',
                        valueColumn: 'feature_id',
                        input: p.id(['classIds'])
                      })
                    )
                    .elseIf(
                      or([
                        p.field(['relationCode']).eq('SUBCLASS'),
                        p.field(['subject']).eq('SUBCLASS')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('class_features', {
                        whereColumn: 'class_id',
                        valueColumn: 'feature_id',
                        input: p.id(['subclassIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('EQUIPMENT'))
                    .then((o) =>
                      o.mapValues('equipment_features', {
                        whereColumn: 'equipment_id',
                        valueColumn: 'feature_id',
                        input: p.id(['equipmentIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('RACE'))
                    .then((o) =>
                      o.mapValues('race_features', {
                        whereColumn: 'race_id',
                        valueColumn: 'feature_id',
                        input: p.id(['raceIds'])
                      })
                    )
                    .elseIf(
                      or([
                        p.field(['relationCode']).eq('SUBRACE'),
                        p.field(['subject']).eq('SUBRACE')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('race_features', {
                        whereColumn: 'race_id',
                        valueColumn: 'feature_id',
                        input: p.id(['subraceIds'])
                      })
                    )
                    .elseIf(
                      or([
                        p.field(['relationCode']).eq('RACE_ANCESTRY_OPTION'),
                        p.field(['subject']).eq('RACE_ANCESTRY_OPTION')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('race_ancestry_option_features', {
                        whereColumn: 'ancestry_option_id',
                        valueColumn: 'feature_id',
                        input: p.id(['ancestryOptionIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('BACKGROUND'))
                    .then((o) =>
                      o.mapValues('background_features', {
                        whereColumn: 'background_id',
                        valueColumn: 'feature_id',
                        input: p.id(['backgroundIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('FEAT'))
                    .then((o) =>
                      o.mapValues('feat_features', {
                        whereColumn: 'feat_id',
                        valueColumn: 'feature_id',
                        input: p.id(['featIds'])
                      })
                    )
                    .end()
                )
                .mapValues('features', {
                  whereColumn: 'id',
                  valueColumn: 'id',
                  selectColumns: ['id', 'label']
                })
                .end()
            )
          },
          { order: 4, showIf: local.field(['relationCode']).eq('FEATURE') }
        )
      )
      .set(
        'optionIds',
        selectMulti(
          ['optionIds'],
          'Options',
          {
            kind: 'DATA',
            relationship: chain((s) =>
              s
                .condition((c) =>
                  c
                    .if(
                      or([
                        p.field(['subject']).eq('FEATURE'),
                        p.field(['relationCode']).eq('FEATURE')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('feature_options', {
                        whereColumn: 'feature_id',
                        valueColumn: 'option_id',
                        input: p.id(['featureIds'])
                      })
                    )
                    .end()
                )
                .mapValues('options', {
                  whereColumn: 'id',
                  valueColumn: 'id',
                  selectColumns: ['id', 'label']
                })
                .end()
            )
          },
          { order: 4, showIf: local.field(['relationCode']).eq('OPTION') }
        )
      )
      .set(
        'ancestryOptionIds',
        selectMulti(
          ['ancestryOptionIds'],
          'Ancestry Options',
          {
            kind: 'DATA',
            relationship: chain((s) =>
              s
                .input('race_ancestries', {
                  whereColumn: 'race_id',
                  valueColumn: 'id',
                  input: p.id(['raceIds'])
                })
                .mapValues('race_ancestry_options', {
                  whereColumn: 'ancestry_id',
                  valueColumn: 'id',
                  selectColumns: ['id', 'label']
                })
                .end()
            )
          },
          { order: 4, showIf: local.field(['relationCode']).eq('RACE_ANCESTRY_OPTION') }
        )
      )
      .set(
        'resourceIds',
        selectMulti(
          ['resourceIds'],
          'Class Resource',
          {
            kind: 'DATA',
            relationship: condition((c) =>
              c
                .if(p.field(['subject']).eq('CLASS'))
                .then((o) =>
                  o.mapValues('class_resources', {
                    whereColumn: 'class_id',
                    valueColumn: 'id',
                    input: p.id(['classIds'])
                  })
                )
                .elseIf(
                  or([
                    p.field(['subject']).eq('SUBCLASS'),
                    p.field(['relationCode']).eq('SUBCLASS')
                  ])
                )
                .then((o) =>
                  o.mapValues('class_resources', {
                    whereColumn: 'class_id',
                    valueColumn: 'id',
                    input: p.id(['subclassIds'])
                  })
                )
                .end()
            )
          },
          {
            order: 4,
            showIf: local.field(['relationCode']).eq('RESOURCE')
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
            relationship: condition((c) =>
              c
                .if(p.scope(['classIds']).selected)
                .then((o) =>
                  o.mapValues('classes', {
                    whereColumn: 'parent_class_id',
                    valueColumn: 'id',
                    selectColumns: ['id', 'label'],
                    where: (col) => col('category').eq('SUBCLASS')
                  })
                )
                .elseIf(p.scope(['classIds']).all)
                .then((o) =>
                  o.table('classes', {
                    selectColumns: ['id', 'label'],
                    where: (col) => col('category').eq('SUBCLASS')
                  })
                )
                .end()
            )
          },
          { order: 4, showIf: local.field(['relationCode']).eq('SUBCLASS') }
        )
      )
      .set(
        'subraceIds',
        selectMulti(
          ['subraceIds'],
          'Subraces',
          {
            kind: 'DATA',
            relationship: condition((c) =>
              c
                .if(p.scope(['raceIds']).selected)
                .then((o) =>
                  o.mapValues('races', {
                    whereColumn: 'parent_race_id',
                    valueColumn: 'id',
                    selectColumns: ['id', 'label'],
                    where: (col) => col('category').eq('SUBRACE')
                  })
                )
                .elseIf(p.scope(['raceIds']).all)
                .then((o) =>
                  o.table('races', {
                    selectColumns: ['id', 'label'],
                    where: (col) => col('category').eq('SUBRACE')
                  })
                )
                .end()
            )
          },
          { order: 4, showIf: local.field(['relationCode']).eq('SUBRACE') }
        )
      )
      .set(
        'proficiencyKind',
        selectSingle(
          ['proficiencyKind'],
          'Proficiency Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: PROFICIENCY_KIND_OPTIONS,
            filter: {
              kind: 'ALLOW',
              by: chain((s) =>
                s
                  .condition((c) =>
                    c
                      .if(p.field(['subject']).eq('CLASS'))
                      .then((o) =>
                        o.mapValues('class_proficiency_grants', {
                          whereColumn: 'class_id',
                          valueColumn: 'proficiency_grant_id',
                          input: p.id(['classIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('SUBCLASS'),
                          p.field(['relationCode']).eq('SUBCLASS')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('class_proficiency_grants', {
                          whereColumn: 'class_id',
                          valueColumn: 'proficiency_grant_id',
                          input: p.id(['subclassIds'])
                        })
                      )
                      .elseIf(p.field(['subject']).eq('BACKGROUND'))
                      .then((o) =>
                        o.mapValues('background_proficiency_grants', {
                          valueColumn: 'proficiency_grant_id',
                          whereColumn: 'background_id',
                          input: p.id(['backgroundIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('FEATURE'),
                          p.field(['relationCode']).eq('FEATURE')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('feature_proficiency_grants', {
                          whereColumn: 'feature_id',
                          valueColumn: 'proficiency_grant_id',
                          input: p.id(['featureIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('OPTION'),
                          p.field(['relationCode']).eq('OPTION')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('option_proficiency_grants', {
                          whereColumn: 'option_id',
                          valueColumn: 'proficiency_grant_id',
                          input: p.id(['optionIds'])
                        })
                      )
                      .elseIf(p.field(['subject']).eq('FEAT'))
                      .then((o) =>
                        o.mapValues('feat_proficiency_grants', {
                          whereColumn: 'feat_id',
                          valueColumn: 'proficiency_grant_id',
                          input: p.id(['featIds'])
                        })
                      )
                      .end()
                  )
                  .end()
              )
            }
          },
          {
            order: 4,
            showIf: local.field(['relationCode']).eq('PROFICIENCY_GRANT')
          }
        )
      )
      .set(
        'where',
        groupObject(['where'], 'Where', () => FACET_BODY_NODE_MAP, { presentation: 'inline' })
      )
  })
}

const FACET_EXISTS_NODE_MAP = createFacetExistsNodeMap('facetExists', 'PARENT')
const FACET_BODY_EXISTS_NODE_MAP = createFacetExistsNodeMap('facetBodyExists', 'BODY')

const facetPredicateNode = buildNodeMap<PredicateConditionAuthored>()

function createFacetPredicateNodeMap(
  mapId: string,
  ownerScope: 'PARENT' | 'BODY'
): NodeMap<PredicateConditionAuthored> {
  return facetPredicateNode.define(mapId, ({ map, logic, cond, data, nodes }) => {
    const { and, or, not } = logic
    const local = cond.local()
    const owner =
      ownerScope === 'PARENT' ? cond.parent<FacetExistMin>() : cond.ancestor<FacetExistMin>(3)
    const selection =
      ownerScope === 'PARENT' ? cond.parent<FacetExistMin>() : cond.ancestor<FacetExistMin>(2)
    const p = { field: owner.field, id: selection.id, scope: selection.scope }

    const { selectSingle, selectMulti, number, toggle } = nodes
    const { chain, mapValues, table, condition } = data
    const attackRollMode = local.field(['predicateCode']).eq('ATTACK_ROLL_MODE')

    const predicateOptions = NODE_SUBJECT_OPTIONS.map((s) => ({
      showIf: p.field(['subject']).eq(s.code),
      options: getPredicateOptionsForSubject(s.code)
    })).concat(
      RELATION_CODES.map((relationCode) => ({
        showIf: p.field(['relationCode']).eq(relationCode),
        options: getPredicateOptionsForSubject(relationCode)
      }))
    )

    const showAuthoringMode = or(
      SELECTABLE_PREDICATE_CODES.map((c) => local.field(['predicateCode']).eq(c))
    )

    map
      .set(
        'constraint',
        selectSingle(
          ['constraint'],
          'Constraint',
          {
            kind: 'INLINE_OPTIONS',
            options: AUTHORING_CONSTRAINT_OPTIONS
          },
          { order: 1, requiredIf: true }
        )
      )
      .set(
        'predicateCode',
        selectSingle(
          ['predicateCode'],
          'Property',
          {
            kind: 'INLINE_GROUPS',
            optionGroups: predicateOptions
          },
          { order: 1, requiredIf: true }
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
          { order: 2, showIf: showAuthoringMode }
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
            requiredIf: local.field(['predicateCode']).eq('CLASS_LEVEL'),
            showIf: local.field(['predicateCode']).eq('CLASS_LEVEL')
          }
        )
      )
      .set(
        'specializationIds',
        selectMulti(
          ['specializationIds'],
          'Subclass Specializations',
          {
            kind: 'DATA',
            relationship: mapValues('class_specializations', {
              whereColumn: 'class_id',
              valueColumn: 'id',
              selectColumns: ['id', 'label'],
              input: p.id(['subclassIds'])
            })
          },
          {
            order: 3,
            showIf: and([
              local.field(['predicateCode']).eq('SUBCLASS_SPECIALIZATION'),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'sizes',
        selectMulti(
          ['sizes'],
          'Sizes',
          {
            kind: 'INLINE_OPTIONS',
            options: SIZE_OPTIONS
          },
          {
            order: 3,
            requiredIf: true,
            showIf: and([
              or([
                local.field(['predicateCode']).eq('SIZE'),
                local.field(['predicateCode']).eq('CREATURE_SIZE'),
                local.field(['predicateCode']).eq('VEHICLE_SIZE')
              ]),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'creatureTypeIds',
        selectMulti(
          ['creatureTypeIds'],
          'Creature Types',
          {
            kind: 'DATA',
            relationship: table('creature_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            order: 3,
            requiredIf: true,
            showIf: and([
              local.field(['predicateCode']).eq('CREATURE_TYPE'),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'rangeKind',
        selectMulti(
          ['rangeKind'],
          'Range Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: RANGE_OPTIONS,
            filter: {
              kind: 'ALLOW',
              by: chain((s) =>
                s
                  .condition((c) =>
                    c
                      .if(p.field(['subject']).eq('EQUIPMENT'))
                      .then((o) =>
                        o.mapValues('equipment_effects', {
                          whereColumn: 'equipment_id',
                          valueColumn: 'effect_id',
                          input: p.id(['equipmentIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('FEATURE'),
                          p.field(['relationCode']).eq('FEATURE')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('feature_effects', {
                          whereColumn: 'feature_id',
                          valueColumn: 'effect_id',
                          input: p.id(['featureIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('OPTION'),
                          p.field(['relationCode']).eq('OPTION')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('option_effects', {
                          whereColumn: 'option_id',
                          valueColumn: 'effect_id',
                          input: p.id(['optionIds'])
                        })
                      )
                      .elseIf(p.field(['subject']).eq('FEAT'))
                      .then((o) =>
                        o.mapValues('feat_effects', {
                          whereColumn: 'feat_id',
                          valueColumn: 'effect_id',
                          input: p.id(['featIds'])
                        })
                      )
                      .elseIf(p.field(['subject']).eq('SPELL'))
                      .then((o) =>
                        o.mapValues('spell_effects', {
                          whereColumn: 'spell_id',
                          valueColumn: 'effect_id',
                          input: p.id(['spellIds'])
                        })
                      )
                      .end()
                  )
                  .mapValues('effect_invocations', {
                    whereColumn: 'effect_id',
                    valueColumn: 'range_characteristic_id'
                  })
                  .mapValues('characteristic_ranges', {
                    whereColumn: 'characteristic_id',
                    valueColumn: 'kind'
                  })
                  .end()
              )
            }
          },
          {
            order: 3,
            showIf: and([
              local.field(['predicateCode']).eq('RANGE'),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'durationKind',
        selectMulti(
          ['durationKind'],
          'Duration Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: DURATION_OPTIONS,
            filter: {
              kind: 'ALLOW',
              by: chain((s) => {
                const selectedEffects = s.condition((c) =>
                  c
                    .if(p.field(['subject']).eq('EQUIPMENT'))
                    .then((o) =>
                      o.mapValues('equipment_effects', {
                        whereColumn: 'equipment_id',
                        valueColumn: 'effect_id',
                        input: p.id(['equipmentIds'])
                      })
                    )
                    .elseIf(
                      or([
                        p.field(['subject']).eq('FEATURE'),
                        p.field(['relationCode']).eq('FEATURE')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('feature_effects', {
                        whereColumn: 'feature_id',
                        valueColumn: 'effect_id',
                        input: p.id(['featureIds'])
                      })
                    )
                    .elseIf(
                      or([
                        p.field(['subject']).eq('OPTION'),
                        p.field(['relationCode']).eq('OPTION')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('option_effects', {
                        whereColumn: 'option_id',
                        valueColumn: 'effect_id',
                        input: p.id(['optionIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('FEAT'))
                    .then((o) =>
                      o.mapValues('feat_effects', {
                        whereColumn: 'feat_id',
                        valueColumn: 'effect_id',
                        input: p.id(['featIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('SPELL'))
                    .then((o) =>
                      o.mapValues('spell_effects', {
                        whereColumn: 'spell_id',
                        valueColumn: 'effect_id',
                        input: p.id(['spellIds'])
                      })
                    )
                    .end()
                )

                return selectedEffects
                  .union((u) =>
                    u
                      .branch((b) =>
                        b
                          .mapValues('effect_paths', {
                            whereColumn: 'effect_id',
                            valueColumn: 'result_block_id'
                          })
                          .mapValues('effect_result_blocks', {
                            whereColumn: 'id',
                            valueColumn: 'duration_id'
                          })
                          .end()
                      )
                      .branch((b) =>
                        b
                          .mapValues('effect_paths', {
                            whereColumn: 'effect_id',
                            valueColumn: 'id'
                          })
                          .mapValues('effect_path_choice_options', {
                            whereColumn: 'path_id',
                            valueColumn: 'result_block_id'
                          })
                          .mapValues('effect_result_blocks', {
                            whereColumn: 'id',
                            valueColumn: 'duration_id'
                          })
                          .end()
                      )
                      .branch((b) =>
                        b
                          .mapValues('effect_paths', {
                            whereColumn: 'effect_id',
                            valueColumn: 'id'
                          })
                          .mapValues('effect_path_roll_table_rows', {
                            whereColumn: 'path_id',
                            valueColumn: 'result_block_id'
                          })
                          .mapValues('effect_result_blocks', {
                            whereColumn: 'id',
                            valueColumn: 'duration_id'
                          })
                          .end()
                      )
                      .end()
                  )
                  .mapValues('characteristic_durations', {
                    whereColumn: 'characteristic_id',
                    valueColumn: 'kind'
                  })
                  .end()
              })
            }
          },
          {
            order: 3,
            showIf: and([
              local.field(['predicateCode']).eq('DURATION'),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'min',
        number(['min'], 'Min Amount', {
          order: 3,
          requiredIf: true,
          showIf: or([
            and([
              local.field(['predicateCode']).eq('RANGE'),
              or([
                and([
                  local.field(['rangeKind']).contains(['DISTANCE']),
                  local.field(['authoringModeKind']).eq('SELECTED')
                ]),
                local.field(['authoringModeKind']).eq('ALL')
              ])
            ]),
            and([
              local.field(['predicateCode']).eq('DURATION'),
              or([
                and([
                  not(local.field(['durationKind']).onlyValues(['INSTANTANEOUS'])),
                  local.field(['authoringModeKind']).eq('SELECTED')
                ]),
                local.field(['authoringModeKind']).eq('ALL')
              ])
            ]),
            local.field(['predicateCode']).eq('SPELL_LEVEL'),
            local.field(['predicateCode']).eq('SAVING_THROW_DC'),
            local.field(['predicateCode']).eq('ARMOR_CLASS'),
            local.field(['predicateCode']).eq('CHARACTER_LEVEL'),
            local.field(['predicateCode']).eq('CLASS_LEVEL'),
            local.field(['predicateCode']).eq('ABILITY_SCORE'),
            local.field(['predicateCode']).eq('SAVING_THROW_ABILITY_BONUS')
          ])
        })
      )
      .set(
        'max',
        number(['max'], 'Max Amount', {
          showIf: or([
            and([
              local.field(['predicateCode']).eq('RANGE'),
              or([
                and([
                  local.field(['rangeKind']).contains(['DISTANCE']),
                  local.field(['authoringModeKind']).eq('SELECTED')
                ]),
                local.field(['authoringModeKind']).eq('ALL')
              ])
            ]),
            and([
              local.field(['predicateCode']).eq('DURATION'),
              or([
                and([
                  not(local.field(['durationKind']).onlyValues(['INSTANTANEOUS'])),
                  local.field(['authoringModeKind']).eq('SELECTED')
                ]),
                local.field(['authoringModeKind']).eq('ALL')
              ])
            ]),
            local.field(['predicateCode']).eq('SPELL_LEVEL'),
            local.field(['predicateCode']).eq('SAVING_THROW_DC'),
            local.field(['predicateCode']).eq('ARMOR_CLASS'),
            local.field(['predicateCode']).eq('CHARACTER_LEVEL'),
            local.field(['predicateCode']).eq('CLASS_LEVEL'),
            local.field(['predicateCode']).eq('ABILITY_SCORE'),
            local.field(['predicateCode']).eq('SAVING_THROW_ABILITY_BONUS')
          ])
        })
      )
      .set(
        'maxFeet',
        number(['maxFeet'], 'Max Feet Moved', {
          order: 3,
          showIf: local.field(['predicateCode']).eq('TURN_MOVEMENT')
        })
      )
      .set(
        'maxSpeedFraction',
        number(['maxSpeedFraction'], 'Max Fraction of Speed', {
          order: 3,
          showIf: local.field(['predicateCode']).eq('TURN_MOVEMENT')
        })
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
            requiredIf: and([
              local.field(['predicateCode']).eq('FEATURE_OBTAINED'),
              p.field(['subject']).eq('CHARACTER')
            ]),
            showIf: and([
              p.field(['subject']).eq('CHARACTER'),
              or([
                local.field(['predicateCode']).eq('FEATURE_OBTAINED'),
                local.field(['predicateCode']).eq('OPTION_OBTAINED')
              ])
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
            preserveUnknownOptions: true,
            relationship: condition((c) =>
              c
                .if(local.scope(['featureIds']).allOrMissing)
                .then((o) =>
                  o.table('options', {
                    selectColumns: ['id', 'label']
                  })
                )
                .else((o) =>
                  o.chain((s) =>
                    s
                      .input('feature_options', {
                        whereColumn: 'feature_id',
                        valueColumn: 'option_id',
                        input: local.id(['featureIds'])
                      })
                      .mapValues('options', {
                        whereColumn: 'id',
                        valueColumn: 'id',
                        selectColumns: ['id', 'label']
                      })
                      .end()
                  )
                )
                .end()
            )
          },
          {
            order: 3,
            requiredIf: true,
            showIf: and([
              local.field(['predicateCode']).eq('OPTION_OBTAINED'),
              p.field(['subject']).eq('CHARACTER')
            ])
          }
        )
      )
      .set(
        'magicSchoolIds',
        selectMulti(
          ['magicSchoolIds'],
          'Magic Schools',
          {
            kind: 'DATA',
            relationship: chain((s) =>
              s
                .input('spells', {
                  whereColumn: 'id',
                  valueColumn: 'magic_school_id',
                  input: p.id(['spellIds'])
                })
                .mapValues('magic_schools', {
                  whereColumn: 'id',
                  valueColumn: 'id',
                  selectColumns: ['id', 'label', 'description']
                })
                .end()
            )
          },
          {
            order: 3,
            showIf: and([
              local.field(['predicateCode']).eq('MAGIC_SCHOOL'),
              local.field(['authoringModeKind']).eq('SELECTED')
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
            kind: 'INLINE_OPTIONS',
            options: ABILITY_OPTIONS,
            filter: {
              kind: 'ALLOW',
              by: condition((c) =>
                c
                  .if(local.field(['predicateCode']).eq('SPELLCASTING_ABILITY'))
                  .then((o) =>
                    o.condition((c2) =>
                      c2
                        .if(p.field(['subject']).eq('CLASS'))
                        .then((o2) =>
                          o2.mapValues('class_spellcasting', {
                            whereColumn: 'class_id',
                            valueColumn: 'ability_code',
                            input: p.id(['classIds'])
                          })
                        )
                        .elseIf(
                          or([
                            p.field(['subject']).eq('SUBCLASS'),
                            p.field(['relationCode']).eq('SUBCLASS')
                          ])
                        )
                        .then((o2) =>
                          o2.mapValues('class_spellcasting', {
                            whereColumn: 'class_id',
                            valueColumn: 'ability_code',
                            input: p.id(['subclassIds'])
                          })
                        )
                        .end()
                    )
                  )
                  .elseIf(local.field(['predicateCode']).eq('SAVE_ABILITY_PROFICIENCY'))
                  .then((o) =>
                    o.condition((c2) =>
                      c2
                        .if(p.field(['subject']).eq('CLASS'))
                        .then((o2) =>
                          o2.chain((s) =>
                            s
                              .input('class_proficiency_grants', {
                                whereColumn: 'class_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['classIds'])
                              })
                              .mapValues('proficiency_grant_save_abilities', {
                                whereColumn: 'proficiency_grant_id',
                                valueColumn: 'ability_code'
                              })
                              .end()
                          )
                        )
                        .elseIf(
                          or([
                            p.field(['subject']).eq('SUBCLASS'),
                            p.field(['relationCode']).eq('SUBCLASS')
                          ])
                        )
                        .then((o2) =>
                          o2.chain((s) =>
                            s
                              .input('class_proficiency_grants', {
                                whereColumn: 'class_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['subclassIds'])
                              })
                              .mapValues('proficiency_grant_save_abilities', {
                                whereColumn: 'proficiency_grant_id',
                                valueColumn: 'ability_code'
                              })
                              .end()
                          )
                        )
                        .elseIf(p.field(['subject']).eq('BACKGROUND'))
                        .then((o2) =>
                          o2.chain((s) =>
                            s
                              .input('background_proficiency_grants', {
                                whereColumn: 'background_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['backgroundIds'])
                              })
                              .mapValues('proficiency_grant_save_abilities', {
                                whereColumn: 'proficiency_grant_id',
                                valueColumn: 'ability_code'
                              })
                              .end()
                          )
                        )
                        .elseIf(p.field(['subject']).eq('FEAT'))
                        .then((o2) =>
                          o2.chain((s) =>
                            s
                              .input('feat_proficiency_grants', {
                                whereColumn: 'feat_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['featIds'])
                              })
                              .mapValues('proficiency_grant_save_abilities', {
                                whereColumn: 'proficiency_grant_id',
                                valueColumn: 'ability_code'
                              })
                              .end()
                          )
                        )
                        .elseIf(
                          or([
                            p.field(['subject']).eq('FEATURE'),
                            p.field(['relationCode']).eq('FEATURE')
                          ])
                        )
                        .then((o2) =>
                          o2.chain((s) =>
                            s
                              .input('feature_proficiency_grants', {
                                whereColumn: 'feature_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['featureIds'])
                              })
                              .mapValues('proficiency_grant_save_abilities', {
                                whereColumn: 'proficiency_grant_id',
                                valueColumn: 'ability_code'
                              })
                              .end()
                          )
                        )
                        .elseIf(
                          or([
                            p.field(['subject']).eq('OPTION'),
                            p.field(['relationCode']).eq('OPTION')
                          ])
                        )
                        .then((o2) =>
                          o2.chain((s) =>
                            s
                              .input('option_proficiency_grants', {
                                whereColumn: 'option_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['optionIds'])
                              })
                              .mapValues('proficiency_grant_save_abilities', {
                                whereColumn: 'proficiency_grant_id',
                                valueColumn: 'ability_code'
                              })
                              .end()
                          )
                        )
                        .end()
                    )
                  )
                  .end()
              )
            }
          },
          {
            order: 3,
            showIf: and([
              or([
                local.field(['predicateCode']).eq('SPELLCASTING_ABILITY'),
                local.field(['predicateCode']).eq('SAVING_THROW_ABILITY'),
                local.field(['predicateCode']).eq('SAVE_ABILITY_PROFICIENCY'),
                local.field(['predicateCode']).eq('ABILITY_SCORE'),
                local.field(['predicateCode']).eq('SAVING_THROW_ABILITY_BONUS')
              ]),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'ability',
        selectSingle(
          ['ability'],
          'Attack Ability',
          { kind: 'INLINE_OPTIONS', options: ABILITY_OPTIONS },
          {
            order: 3,
            showIf: local.field(['predicateCode']).eq('ATTACK_ABILITY'),
            requiredIf: local.field(['predicateCode']).eq('ATTACK_ABILITY')
          }
        )
      )
      .set(
        'activation',
        selectSingle(
          ['activation'],
          'Attack Activation',
          { kind: 'INLINE_OPTIONS', options: ACTIVATION_OPTIONS },
          {
            order: 3,
            showIf: local.field(['predicateCode']).eq('ATTACK_ACTIVATION'),
            requiredIf: local.field(['predicateCode']).eq('ATTACK_ACTIVATION')
          }
        )
      )
      .set(
        'rollMode',
        selectSingle(
          ['rollMode'],
          'Attack Roll Mode',
          { kind: 'DATA', relationship: table('roll_modes', { selectColumns: ['id', 'label'] }) },
          { order: 3, showIf: attackRollMode, requiredIf: attackRollMode }
        )
      )
      .set(
        'negated',
        toggle(['negated'], 'Any other roll mode', { order: 3, showIf: attackRollMode })
      )
      .set(
        'feet',
        number(['feet'], 'Feet', {
          constraints: { minimum: 1 },
          order: 3,
          showIf: local.field(['predicateCode']).eq('ENEMY_NEAR_TARGET'),
          requiredIf: local.field(['predicateCode']).eq('ENEMY_NEAR_TARGET')
        })
      )
      .set(
        'minFeet',
        number(['minFeet'], 'Minimum Feet Closed', {
          constraints: { minimum: 1 },
          order: 3,
          showIf: local.field(['predicateCode']).eq('MOVED_TOWARD_TARGET'),
          requiredIf: local.field(['predicateCode']).eq('MOVED_TOWARD_TARGET')
        })
      )
      .set(
        'category',
        selectSingle(
          ['category'],
          'Equipment Category',
          {
            kind: 'INLINE_OPTIONS',
            options: EQUIPMENT_CATEGORY_OPTIONS,
            filter: {
              kind: 'ALLOW',
              by: condition((c) =>
                c
                  .if(
                    and([
                      or([
                        local.field(['predicateCode']).eq('EQUIPMENT_CATEGORY'),
                        local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY')
                      ]),
                      p.field(['subject']).eq('EQUIPMENT')
                    ])
                  )
                  .then((o) =>
                    o.condition((c2) =>
                      c2
                        .if(p.scope(['equipmentIds']).selected)
                        .then((o2) =>
                          o2.mapValues('equipment', {
                            whereColumn: 'id',
                            valueColumn: 'category',
                            input: p.id(['equipmentIds'])
                          })
                        )
                        .elseIf(p.scope(['equipmentIds']).all)
                        .then((o2) =>
                          o2.chain((s) => s.seed('equipment', { valueColumn: 'category' }).end())
                        )
                        .end()
                    )
                  )
                  .elseIf(local.field(['predicateCode']).eq('EQUIPMENT_EQUIPPED'))
                  .then((o) =>
                    o.condition((c2) =>
                      c2
                        .if(local.scope(['equipmentIds']).selected)
                        .then((o) =>
                          o.mapValues('equipment', {
                            whereColumn: 'id',
                            valueColumn: 'category',
                            input: local.id(['equipmentIds'])
                          })
                        )
                        .elseIf(local.scope(['equipmentIds']).all)
                        .then((o) =>
                          o.chain((s) => s.seed('equipment', { valueColumn: 'category' }).end())
                        )
                        .end()
                    )
                  )
                  .elseIf(p.field(['subject']).eq('CHARACTER'))
                  .then((o) =>
                    o.chain((s) => s.seed('equipment', { valueColumn: 'category' }).end())
                  )
                  .else((o) =>
                    o.chain((s) =>
                      s
                        .condition((c2) =>
                          c2
                            .if(p.field(['subject']).eq('CLASS'))
                            .then((o2) =>
                              o2.mapValues('class_proficiency_grants', {
                                whereColumn: 'class_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['classIds'])
                              })
                            )
                            .elseIf(p.field(['subject']).eq('FEAT'))
                            .then((o2) =>
                              o2.mapValues('feat_proficiency_grants', {
                                whereColumn: 'feat_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['featIds'])
                              })
                            )
                            .elseIf(
                              or([
                                p.field(['subject']).eq('FEATURE'),
                                p.field(['relationCode']).eq('FEATURE')
                              ])
                            )
                            .then((o2) =>
                              o2.mapValues('feature_proficiency_grants', {
                                whereColumn: 'feature_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['featureIds'])
                              })
                            )
                            .elseIf(
                              or([
                                p.field(['subject']).eq('OPTION'),
                                p.field(['relationCode']).eq('OPTION')
                              ])
                            )
                            .then((o2) =>
                              o2.mapValues('option_proficiency_grants', {
                                whereColumn: 'option_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['optionIds'])
                              })
                            )
                            .end()
                        )
                        .condition((c2) =>
                          c2
                            .if(local.field(['predicateCode']).eq('EQUIPMENT_PROFICIENCY'))
                            .then((o2) =>
                              o2.mapValues('proficiency_grant_equipment', {
                                whereColumn: 'proficiency_grant_id',
                                valueColumn: 'equipment_id'
                              })
                            )
                            .elseIf(
                              local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY_PROFICIENCY')
                            )
                            .then((o2) =>
                              o2.chain((s2) =>
                                s2
                                  .mapValues('proficiency_grant_equipment_properties', {
                                    whereColumn: 'proficiency_grant_id',
                                    valueColumn: 'property_code'
                                  })
                                  .mapValues('equipment_properties', {
                                    whereColumn: 'property_code',
                                    valueColumn: 'equipment_id'
                                  })
                                  .end()
                              )
                            )
                            .end()
                        )
                        .mapValues('equipment', {
                          whereColumn: 'id',
                          valueColumn: 'category'
                        })
                        .end()
                    )
                  )
                  .end()
              )
            }
          },
          {
            order: 3,
            showIf: or([
              local.field(['predicateCode']).eq('EQUIPMENT_CATEGORY'),
              local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY'),
              local.field(['predicateCode']).eq('EQUIPMENT_PROFICIENCY'),
              local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY_PROFICIENCY'),
              local.field(['predicateCode']).eq('EQUIPMENT_EQUIPPED')
            ]),
            requiredIf: local.field(['predicateCode']).eq('EQUIPMENT_CATEGORY')
          }
        )
      )
      .set(
        'properties',
        selectMulti(
          ['properties'],
          'Equipment Properties',
          {
            kind: 'INLINE_OPTIONS',
            options: EQUIPMENT_PROPERTY_OPTIONS,
            filter: {
              kind: 'ALLOW',
              by: condition((c) =>
                c
                  .if(local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY'))
                  .then((o) =>
                    o.condition((c2) =>
                      c2
                        .if(p.scope(['equipmentIds']).selected)
                        .then((o2) =>
                          o2.mapValues('equipment_properties', {
                            whereColumn: 'equipment_id',
                            valueColumn: 'property_code',
                            input: p.id(['equipmentIds'])
                          })
                        )
                        .elseIf(p.scope(['equipmentIds']).all)
                        .then((o2) =>
                          o2.chain((s) =>
                            s.seed('equipment_properties', { valueColumn: 'property_code' }).end()
                          )
                        )
                        .end()
                    )
                  )
                  .elseIf(local.field(['predicateCode']).eq('ATTACK_ACTION_OTHER_WEAPON'))
                  .then((o) =>
                    o.chain((s) =>
                      s.seed('equipment_properties', { valueColumn: 'property_code' }).end()
                    )
                  )
                  .elseIf(local.field(['predicateCode']).eq('EQUIPMENT_EQUIPPED'))
                  .then((o) =>
                    o.condition((c2) =>
                      c2
                        .if(local.scope(['equipmentIds']).selected)
                        .then((o) =>
                          o.mapValues('equipment_properties', {
                            whereColumn: 'equipment_id',
                            valueColumn: 'property_code',
                            input: local.id(['equipmentIds'])
                          })
                        )
                        .elseIf(local.scope(['equipmentIds']).all)
                        .then((o) =>
                          o.chain((s) =>
                            s.seed('equipment_properties', { valueColumn: 'property_code' }).end()
                          )
                        )
                        .end()
                    )
                  )
                  .elseIf(
                    and([
                      or([
                        local.field(['predicateCode']).eq('EQUIPMENT_PROFICIENCY'),
                        local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY_PROFICIENCY')
                      ]),
                      p.field(['subject']).eq('CHARACTER')
                    ])
                  )
                  .then((o) =>
                    o.chain((s) =>
                      s.seed('equipment_properties', { valueColumn: 'property_code' }).end()
                    )
                  )
                  .elseIf(
                    or([
                      local.field(['predicateCode']).eq('EQUIPMENT_PROFICIENCY'),
                      local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY_PROFICIENCY')
                    ])
                  )
                  .then((o) =>
                    o.chain((s) =>
                      s
                        .condition((c2) =>
                          c2
                            .if(p.field(['subject']).eq('CLASS'))
                            .then((o2) =>
                              o2.mapValues('class_proficiency_grants', {
                                whereColumn: 'class_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['classIds'])
                              })
                            )
                            .elseIf(p.field(['subject']).eq('FEAT'))
                            .then((o2) =>
                              o2.mapValues('feat_proficiency_grants', {
                                whereColumn: 'feat_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['featIds'])
                              })
                            )
                            .elseIf(
                              or([
                                p.field(['subject']).eq('FEATURE'),
                                p.field(['relationCode']).eq('FEATURE')
                              ])
                            )
                            .then((o2) =>
                              o2.mapValues('feature_proficiency_grants', {
                                whereColumn: 'feature_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['featureIds'])
                              })
                            )
                            .elseIf(
                              or([
                                p.field(['subject']).eq('OPTION'),
                                p.field(['relationCode']).eq('OPTION')
                              ])
                            )
                            .then((o2) =>
                              o2.mapValues('option_proficiency_grants', {
                                whereColumn: 'option_id',
                                valueColumn: 'proficiency_grant_id',
                                input: p.id(['optionIds'])
                              })
                            )
                            .end()
                        )
                        .mapValues('proficiency_grant_equipment_properties', {
                          whereColumn: 'proficiency_grant_id',
                          valueColumn: 'property_code'
                        })
                        .end()
                    )
                  )
                  .end()
              )
            }
          },
          {
            order: 3,
            requiredIf: and([
              or([
                local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY'),
                local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY_PROFICIENCY'),
                local.field(['predicateCode']).eq('ATTACK_ACTION_OTHER_WEAPON')
              ]),
              local.field(['authoringModeKind']).eq('SELECTED')
            ]),
            showIf: or([
              and([
                or([
                  local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY'),
                  local.field(['predicateCode']).eq('EQUIPMENT_PROPERTY_PROFICIENCY'),
                  local.field(['predicateCode']).eq('ATTACK_ACTION_OTHER_WEAPON')
                ]),
                local.field(['authoringModeKind']).eq('SELECTED')
              ]),
              local.field(['predicateCode']).eq('EQUIPMENT_PROFICIENCY'),
              local.field(['predicateCode']).eq('EQUIPMENT_EQUIPPED')
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
            showIf: and([
              or([
                local.field(['predicateCode']).eq('EQUIPMENT_PROFICIENCY'),
                local.field(['predicateCode']).eq('EQUIPMENT_EQUIPPED')
              ]),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'level',
        selectSingle(
          ['level'],
          'Proficiency Level',
          {
            kind: 'INLINE_OPTIONS',
            options: SCALING_AMOUNT_OPTIONS
          },
          {
            order: 3,
            showIf: or([
              local.field(['predicateCode']).eq('EQUIPMENT_PROFICIENCY'),
              local.field(['predicateCode']).eq('SAVE_ABILITY_PROFICIENCY'),
              local.field(['predicateCode']).eq('SKILL_PROFICIENCY'),
              local.field(['predicateCode']).eq('LANGUAGE_PROFICIENCY')
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
            relationship: chain((s) =>
              s
                .condition((c) =>
                  c
                    .if(p.field(['subject']).eq('FEAT'))
                    .then((o) =>
                      o.mapValues('feat_proficiency_grants', {
                        whereColumn: 'feat_id',
                        valueColumn: 'proficiency_grant_id',
                        input: p.id(['featIds'])
                      })
                    )
                    .elseIf(
                      or([
                        p.field(['subject']).eq('FEATURE'),
                        p.field(['relationCode']).eq('FEATURE')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('feature_proficiency_grants', {
                        whereColumn: 'feature_id',
                        valueColumn: 'proficiency_grant_id',
                        input: p.id(['featureIds'])
                      })
                    )
                    .elseIf(
                      or([
                        p.field(['subject']).eq('OPTION'),
                        p.field(['relationCode']).eq('OPTION')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('option_proficiency_grants', {
                        whereColumn: 'option_id',
                        valueColumn: 'proficiency_grant_id',
                        input: p.id(['optionIds'])
                      })
                    )
                    .end()
                )
                .mapValues('proficiency_grant_languages', {
                  whereColumn: 'proficiency_grant_id',
                  valueColumn: 'language_id'
                })
                .end()
            )
          },
          {
            order: 3,
            showIf: and([
              local.field(['predicateCode']).eq('LANGUAGE_PROFICIENCY'),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'damageTypeIds',
        selectMulti(
          ['damageTypeIds'],
          'Damage Types',
          {
            kind: 'DATA',
            relationship: chain((s) =>
              s
                .condition((c) =>
                  c
                    .if(
                      or([
                        p.field(['subject']).eq('FEATURE'),
                        p.field(['relationCode']).eq('FEATURE')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('feature_effects', {
                        whereColumn: 'feature_id',
                        valueColumn: 'effect_id',
                        input: p.id(['featureIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('FEAT'))
                    .then((o) =>
                      o.mapValues('feat_effects', {
                        whereColumn: 'feat_id',
                        valueColumn: 'effect_id',
                        input: p.id(['featIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('SPELL'))
                    .then((o) =>
                      o.mapValues('spell_effects', {
                        whereColumn: 'spell_id',
                        valueColumn: 'effect_id',
                        input: p.id(['spellIds'])
                      })
                    )
                    .elseIf(
                      or([
                        p.field(['subject']).eq('OPTION'),
                        p.field(['relationCode']).eq('OPTION')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('option_effects', {
                        whereColumn: 'option_id',
                        valueColumn: 'effect_id',
                        input: p.id(['optionIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('EQUIPMENT'))
                    .then((o) =>
                      o.mapValues('equipment_effects', {
                        whereColumn: 'equipment_id',
                        valueColumn: 'effect_id',
                        input: p.id(['equipmentIds'])
                      })
                    )
                    .end()
                )
                .union((u) =>
                  u
                    .branch((b) =>
                      b
                        .mapValues('effect_paths', {
                          whereColumn: 'effect_id',
                          valueColumn: 'result_block_id'
                        })
                        .mapValues('effect_result_block_outcomes', {
                          whereColumn: 'result_block_id',
                          valueColumn: 'outcome_id'
                        })
                        .end()
                    )
                    .branch((b) =>
                      b
                        .mapValues('effect_paths', {
                          whereColumn: 'effect_id',
                          valueColumn: 'id'
                        })
                        .mapValues('effect_path_choice_options', {
                          whereColumn: 'path_id',
                          valueColumn: 'result_block_id'
                        })
                        .mapValues('effect_result_block_outcomes', {
                          whereColumn: 'result_block_id',
                          valueColumn: 'outcome_id'
                        })
                        .end()
                    )
                    .branch((b) =>
                      b
                        .mapValues('effect_paths', {
                          whereColumn: 'effect_id',
                          valueColumn: 'id'
                        })
                        .mapValues('effect_path_roll_table_rows', {
                          whereColumn: 'path_id',
                          valueColumn: 'result_block_id'
                        })
                        .mapValues('effect_result_block_outcomes', {
                          whereColumn: 'result_block_id',
                          valueColumn: 'outcome_id'
                        })
                        .end()
                    )
                    .end()
                )
                .mapValues('damages', {
                  whereColumn: 'id',
                  valueColumn: 'damage_type_id'
                })
                .end()
            )
          },
          {
            order: 3,
            requiredIf: true,
            showIf: and([
              local.field(['predicateCode']).eq('DAMAGE_TYPE'),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'conditionTypeIds',
        selectMulti(
          ['conditionTypeIds'],
          'Condition Types',
          {
            kind: 'DATA',
            relationship: chain((s) =>
              s
                .condition((c) =>
                  c
                    .if(
                      or([
                        p.field(['subject']).eq('FEATURE'),
                        p.field(['relationCode']).eq('FEATURE')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('feature_effects', {
                        whereColumn: 'feature_id',
                        valueColumn: 'effect_id',
                        input: p.id(['featureIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('FEAT'))
                    .then((o) =>
                      o.mapValues('feat_effects', {
                        whereColumn: 'feat_id',
                        valueColumn: 'effect_id',
                        input: p.id(['featIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('SPELL'))
                    .then((o) =>
                      o.mapValues('spell_effects', {
                        whereColumn: 'spell_id',
                        valueColumn: 'effect_id',
                        input: p.id(['spellIds'])
                      })
                    )
                    .elseIf(
                      or([
                        p.field(['subject']).eq('OPTION'),
                        p.field(['relationCode']).eq('OPTION')
                      ])
                    )
                    .then((o) =>
                      o.mapValues('option_effects', {
                        whereColumn: 'option_id',
                        valueColumn: 'effect_id',
                        input: p.id(['optionIds'])
                      })
                    )
                    .elseIf(p.field(['subject']).eq('EQUIPMENT'))
                    .then((o) =>
                      o.mapValues('equipment_effects', {
                        whereColumn: 'equipment_id',
                        valueColumn: 'effect_id',
                        input: p.id(['equipmentIds'])
                      })
                    )
                    .end()
                )
                .union((u) =>
                  u
                    .branch((b) =>
                      b
                        .mapValues('effect_paths', {
                          whereColumn: 'effect_id',
                          valueColumn: 'result_block_id'
                        })
                        .mapValues('effect_result_block_outcomes', {
                          whereColumn: 'result_block_id',
                          valueColumn: 'outcome_id'
                        })
                        .end()
                    )
                    .branch((b) =>
                      b
                        .mapValues('effect_paths', {
                          whereColumn: 'effect_id',
                          valueColumn: 'id'
                        })
                        .mapValues('effect_path_choice_options', {
                          whereColumn: 'path_id',
                          valueColumn: 'result_block_id'
                        })
                        .mapValues('effect_result_block_outcomes', {
                          whereColumn: 'result_block_id',
                          valueColumn: 'outcome_id'
                        })
                        .end()
                    )
                    .branch((b) =>
                      b
                        .mapValues('effect_paths', {
                          whereColumn: 'effect_id',
                          valueColumn: 'id'
                        })
                        .mapValues('effect_path_roll_table_rows', {
                          whereColumn: 'path_id',
                          valueColumn: 'result_block_id'
                        })
                        .mapValues('effect_result_block_outcomes', {
                          whereColumn: 'result_block_id',
                          valueColumn: 'outcome_id'
                        })
                        .end()
                    )
                    .end()
                )
                .mapValues('conditions', {
                  whereColumn: 'id',
                  valueColumn: 'condition_type_id'
                })
                .end()
            )
          },
          {
            order: 3,
            requiredIf: true,
            showIf: and([
              local.field(['predicateCode']).eq('CONDITION_TYPE'),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'chargeLimitKind',
        selectMulti(
          ['chargeLimitKind'],
          'Charge Limit Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: CHARGE_LIMIT_OPTIONS,
            filter: {
              kind: 'ALLOW',
              by: chain((s) =>
                s
                  .condition((c) =>
                    c
                      .if(p.field(['subject']).eq('EQUIPMENT'))
                      .then((o) =>
                        o.mapValues('equipment', {
                          whereColumn: 'id',
                          valueColumn: 'charge_id',
                          input: p.id(['equipmentIds'])
                        })
                      )
                      .elseIf(p.field(['subject']).eq('FEAT'))
                      .then((o) =>
                        o.mapValues('feats', {
                          whereColumn: 'id',
                          valueColumn: 'charge_id',
                          input: p.id(['featIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('FEATURE'),
                          p.field(['relationCode']).eq('FEATURE')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('features', {
                          whereColumn: 'id',
                          valueColumn: 'charge_id',
                          input: p.id(['featureIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('OPTION'),
                          p.field(['relationCode']).eq('OPTION')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('options', {
                          whereColumn: 'id',
                          valueColumn: 'charge_id',
                          input: p.id(['optionIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('RESOURCE'),
                          p.field(['relationCode']).eq('RESOURCE')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('class_resources', {
                          whereColumn: 'id',
                          valueColumn: 'charge_id',
                          input: p.id(['resourceIds'])
                        })
                      )
                      .end()
                  )
                  .mapValues('charge_limits', {
                    whereColumn: 'charge_id',
                    valueColumn: 'limit_kind'
                  })
                  .end()
              )
            }
          },
          {
            order: 3,
            showIf: and([
              local.field(['predicateCode']).eq('CHARGE_LIMIT_KIND'),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
      .set(
        'chargeResetKind',
        selectMulti(
          ['chargeResetKind'],
          'Charge Reset Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: CHARGE_RESET_OPTIONS,
            filter: {
              kind: 'ALLOW',
              by: chain((s) =>
                s
                  .condition((c) =>
                    c
                      .if(p.field(['subject']).eq('EQUIPMENT'))
                      .then((o) =>
                        o.mapValues('equipment', {
                          whereColumn: 'id',
                          valueColumn: 'charge_id',
                          input: p.id(['equipmentIds'])
                        })
                      )
                      .elseIf(p.field(['subject']).eq('FEAT'))
                      .then((o) =>
                        o.mapValues('feats', {
                          whereColumn: 'id',
                          valueColumn: 'charge_id',
                          input: p.id(['featIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('FEATURE'),
                          p.field(['relationCode']).eq('FEATURE')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('features', {
                          whereColumn: 'id',
                          valueColumn: 'charge_id',
                          input: p.id(['featureIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('OPTION'),
                          p.field(['relationCode']).eq('OPTION')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('options', {
                          whereColumn: 'id',
                          valueColumn: 'charge_id',
                          input: p.id(['optionIds'])
                        })
                      )
                      .elseIf(
                        or([
                          p.field(['subject']).eq('RESOURCE'),
                          p.field(['relationCode']).eq('RESOURCE')
                        ])
                      )
                      .then((o) =>
                        o.mapValues('class_resources', {
                          whereColumn: 'id',
                          valueColumn: 'charge_id',
                          input: p.id(['resourceIds'])
                        })
                      )
                      .end()
                  )
                  .mapValues('charges', {
                    whereColumn: 'id',
                    valueColumn: 'reset_kind'
                  })
                  .end()
              )
            }
          },
          {
            order: 3,
            requiredIf: true,
            showIf: and([
              local.field(['predicateCode']).eq('CHARGE_RESET_KIND'),
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
              local.field(['predicateCode']).eq('SPELL_OBTAINED'),
              p.field(['subject']).eq('CHARACTER')
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
              local.field(['predicateCode']).eq('FEAT_OBTAINED'),
              p.field(['subject']).eq('CHARACTER')
            ])
          }
        )
      )
      .set(
        'heritageIds',
        selectMulti(
          ['heritageIds'],
          'Heritages',
          {
            kind: 'DATA',
            relationship: table('heritages', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            order: 3,
            requiredIf: true,
            showIf: and([
              local.field(['predicateCode']).eq('HERITAGE'),
              local.field(['authoringModeKind']).eq('SELECTED'),
              p.field(['subject']).eq('CHARACTER')
            ])
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
            relationship: condition((c) =>
              c
                .if(local.field(['predicateCode']).eq('SKILL_PROFICIENCY'))
                .then((o) =>
                  o.chain((s) =>
                    s
                      .condition((c) =>
                        c
                          .if(p.field(['subject']).eq('CLASS'))
                          .then((o) =>
                            o.mapValues('class_proficiency_grants', {
                              whereColumn: 'class_id',
                              valueColumn: 'proficiency_grant_id',
                              input: p.id(['classIds'])
                            })
                          )
                          .elseIf(p.field(['subject']).eq('FEAT'))
                          .then((o) =>
                            o.mapValues('feat_proficiency_grants', {
                              whereColumn: 'feat_id',
                              valueColumn: 'proficiency_grant_id',
                              input: p.id(['featIds'])
                            })
                          )
                          .elseIf(
                            or([
                              p.field(['subject']).eq('FEATURE'),
                              p.field(['relationCode']).eq('FEATURE')
                            ])
                          )
                          .then((o) =>
                            o.mapValues('feature_proficiency_grants', {
                              whereColumn: 'feature_id',
                              valueColumn: 'proficiency_grant_id',
                              input: p.id(['featureIds'])
                            })
                          )
                          .elseIf(
                            or([
                              p.field(['subject']).eq('OPTION'),
                              p.field(['relationCode']).eq('OPTION')
                            ])
                          )
                          .then((o) =>
                            o.mapValues('option_proficiency_grants', {
                              whereColumn: 'option_id',
                              valueColumn: 'proficiency_grant_id',
                              input: p.id(['optionIds'])
                            })
                          )
                          .end()
                      )
                      .mapValues('proficiency_grant_skills', {
                        whereColumn: 'proficiency_grant_id',
                        valueColumn: 'skill_id'
                      })
                      .end()
                  )
                )
                .end()
            )
          },
          {
            order: 3,
            requiredIf: true,
            showIf: and([
              or([
                local.field(['predicateCode']).eq('SKILL_SCORE'),
                local.field(['predicateCode']).eq('SKILL_PROFICIENCY')
              ]),
              local.field(['authoringModeKind']).eq('SELECTED')
            ])
          }
        )
      )
  })
}

const FACET_PREDICATE_NODE_MAP = createFacetPredicateNodeMap('facetPredicate', 'PARENT')
const FACET_BODY_PREDICATE_NODE_MAP = createFacetPredicateNodeMap('facetBodyPredicate', 'BODY')

const facetConditionNode = buildNodeMap<FacetConditionAuthored>()

const FACET_PREDICATE_CONDITION_OPTION = {
  code: 'PREDICATE',
  label: 'Property',
  description: 'Test a property of the selected subject.'
} as const

const FACET_EXISTS_CONDITION_OPTION = {
  code: 'EXISTS',
  label: 'Related Subject',
  description: 'Require or exclude a related subject.'
} as const

const RELATIONAL_TARGET_CODES = RELATION_CODES.filter((relationCode) =>
  (RELATION_SUBJECTS as readonly string[]).includes(relationCode)
)

function createFacetConditionNodeMap(
  mapId: string,
  existsMap: NodeMap<ExistsConditionAuthored>,
  predicateMap: NodeMap<PredicateConditionAuthored>,
  ownerScope: 'PARENT' | 'BODY'
) {
  return facetConditionNode.define(
    mapId,
    ({ map, nodes, cond, logic }) => {
      const local = cond.local()
      const owner =
        ownerScope === 'PARENT' ? cond.parent<FacetExistMin>() : cond.ancestor<FacetExistMin>(3)
      const isExists = local.field(['kind']).eq('EXISTS')
      const isPredicate = local.field(['kind']).eq('PREDICATE')
      const conditionKindIsValid = logic.not(logic.and([isExists, isPredicate]))
      const ownerSupportsRelations = logic.or([
        ...RELATION_SUBJECTS.map((subject) => owner.field(['subject']).eq(subject)),
        ...RELATIONAL_TARGET_CODES.map((relationCode) =>
          owner.field(['relationCode']).eq(relationCode)
        )
      ])
      const predicateUsesSelection = logic.or(
        SELECTABLE_PREDICATE_CODES.map((code) => local.field(['predicateCode']).eq(code))
      )

      map
        .set(
          'kind',
          nodes.selectSingle(
            ['kind'],
            'Condition Type',
            {
              kind: 'INLINE_GROUPS',
              optionGroups: [
                {
                  showIf: conditionKindIsValid,
                  options: [FACET_PREDICATE_CONDITION_OPTION]
                },
                {
                  showIf: ownerSupportsRelations,
                  options: [FACET_EXISTS_CONDITION_OPTION]
                }
              ]
            },
            { order: 1, requiredIf: true }
          )
        )
        .set(
          'constraint',
          nodes.selectSingle(
            ['constraint'],
            'Constraint',
            {
              kind: 'INLINE_OPTIONS',
              options: AUTHORING_CONSTRAINT_OPTIONS
            },
            { order: 2, requiredIf: true }
          )
        )
        .set(
          'authoringModeKind',
          nodes.selectSingle(
            ['authoringModeKind'],
            'Authoring Mode',
            {
              kind: 'INLINE_OPTIONS',
              options: AUTHORING_MODE_KIND_OPTIONS
            },
            {
              order: 3,
              hiddenBehavior: 'CLEAR',
              showIf: logic.or([isExists, logic.and([isPredicate, predicateUsesSelection])])
            }
          )
        )
        .merge(toConditionBranchNodes(existsMap, 'exists', isExists, logic.and))
        .merge(toConditionBranchNodes(predicateMap, 'predicate', isPredicate, logic.and))
    },
    {
      collection: {
        rowSummary: 'facet-condition'
      }
    }
  )
}

function toConditionBranchNodes<TCondition extends object>(
  branchMap: NodeMap<TCondition>,
  prefix: string,
  branchCondition: ConditionIfExpr,
  and: (conditions: readonly ConditionIfExpr[]) => ConditionIfExpr
): Record<string, NodeEntry<FacetConditionAuthored>> {
  return Object.fromEntries(
    Object.entries(branchMap.nodes)
      .filter(([nodeId]) => nodeId !== 'constraint' && nodeId !== 'authoringModeKind')
      .map(([nodeId, node]) => [
        `${prefix}${nodeId.charAt(0).toUpperCase()}${nodeId.slice(1)}`,
        {
          ...node,
          order: (node.order ?? 0) + 10,
          hiddenBehavior: 'CLEAR',
          showIf: node.showIf === undefined ? branchCondition : and([branchCondition, node.showIf])
        }
      ])
  ) as Record<string, NodeEntry<FacetConditionAuthored>>
}

const FACET_CONDITION_NODE_MAP = createFacetConditionNodeMap(
  'facetCondition',
  FACET_EXISTS_NODE_MAP,
  FACET_PREDICATE_NODE_MAP,
  'PARENT'
)

const FACET_BODY_CONDITION_NODE_MAP = createFacetConditionNodeMap(
  'facetBodyCondition',
  FACET_BODY_EXISTS_NODE_MAP,
  FACET_BODY_PREDICATE_NODE_MAP,
  'BODY'
)

const facetContext = buildNodeMap<FacetContextAuthored>()

const FACET_CONTEXT_NODE_MAP = facetContext.define(
  'facetContext',
  ({ map, nodes }) => {
    const { groupArray } = nodes
    const selectionNodes = Object.fromEntries(
      Object.entries(FACET_SCOPED_NODE_MAP.nodes)
        .filter(([nodeId]) => nodeId !== 'groups')
        .map(([nodeId, node]) => [
          nodeId,
          nodeId === 'subject' ? node : { ...node, hiddenBehavior: 'CLEAR' }
        ])
    ) as Record<string, NodeEntry<FacetContextAuthored>>

    map.merge(selectionNodes).set(
      'conditions',
      groupArray(['conditions'], 'Conditions', () => FACET_CONDITION_NODE_MAP, {
        presentation: 'inline',
        order: 100,
        ...LOGIC_CONDITION_AUTHORING
      })
    )
  },
  {
    collection: {
      rowSummary: 'facet-context'
    }
  }
)

const facetGroup = buildNodeMap<FacetGroupAuthored>()

const FACET_GROUP_NODE_MAP = facetGroup.define('facetGroup', ({ map, nodes }) => {
  const { groupArray } = nodes

  map.set(
    'contexts',
    groupArray(['contexts'], 'Context', () => FACET_CONTEXT_NODE_MAP, {
      presentation: 'inline',
      ...LOGIC_CONTEXT_AUTHORING
    })
  )
})

const facet = buildNodeMap<FacetAuthored>()

export const FACET_NODE_MAP = facet.define('facet', ({ map, nodes }) => {
  const { groupArray } = nodes

  map.set(
    'groups',
    groupArray(['groups'], 'Groups', () => FACET_GROUP_NODE_MAP, {
      presentation: 'inline',
      ...LOGIC_OPTION_AUTHORING
    })
  )
})

const characterFacetContext = buildNodeMap<FacetContextAuthored<'CHARACTER'>>()

const CHARACTER_FACET_CONTEXT_NODE_MAP = characterFacetContext.define(
  'characterFacetContext',
  ({ map, nodes }) => {
    const { selectSingle, groupArray } = nodes

    map
      .set(
        'subject',
        selectSingle(
          ['subject'],
          'Context',
          {
            kind: 'INLINE_OPTIONS',
            options: NODE_SUBJECT_OPTIONS.filter((option) => option.code === 'CHARACTER')
          },
          { order: 1, requiredIf: true }
        )
      )
      .set(
        'conditions',
        groupArray(
          ['conditions'],
          'Conditions',
          () => FACET_CONDITION_NODE_MAP as NodeMap<FacetConditionAuthored<'CHARACTER'>>,
          { presentation: 'inline', order: 100, ...LOGIC_CONDITION_AUTHORING }
        )
      )
  },
  {
    collection: {
      rowSummary: 'facet-context'
    }
  }
)

const characterFacetGroup = buildNodeMap<FacetGroupAuthored<'CHARACTER'>>()

const CHARACTER_FACET_GROUP_NODE_MAP = characterFacetGroup.define(
  'characterFacetGroup',
  ({ map, nodes }) => {
    map.set(
      'contexts',
      nodes.groupArray(['contexts'], 'Context', () => CHARACTER_FACET_CONTEXT_NODE_MAP, {
        presentation: 'inline',
        ...LOGIC_CONTEXT_AUTHORING
      })
    )
  }
)

const characterFacet = buildNodeMap<FacetAuthored<'CHARACTER'>>()

export const CHARACTER_FACET_NODE_MAP = characterFacet.define(
  'characterFacet',
  ({ map, nodes }) => {
    map.set(
      'groups',
      nodes.groupArray(['groups'], 'Groups', () => CHARACTER_FACET_GROUP_NODE_MAP, {
        presentation: 'inline',
        ...LOGIC_OPTION_AUTHORING
      })
    )
  }
)
