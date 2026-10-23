import { buildNodeMap, type NodeMap } from '#utils'
import {
  SubjectSelectionAuthored,
  type ExistsConditionAuthored,
  type FacetBodyAuthored,
  type FacetContextAuthored
} from '#authored'
import {
  AUTHORING_CONSTRAINT_OPTIONS,
  AUTHORING_MODE_KIND_OPTIONS,
  getRelatedSubjectOptions,
  PROFICIENCY_KIND_OPTIONS,
  RELATION_CODES,
  RELATION_SUBJECTS
} from '#core'
import type { AllUnionFields } from 'type-fest'

const facetExistsNode = buildNodeMap<ExistsConditionAuthored>()

export type FacetExistMin = AllUnionFields<
  (Pick<ExistsConditionAuthored, 'relationCode'> | Pick<FacetContextAuthored, 'subject'>) &
    SubjectSelectionAuthored
>

export function createFacetExistsNodeMap(
  mapId: string,
  ownerScope: 'PARENT' | 'BODY',
  bodyNodeMap: NodeMap<FacetBodyAuthored>
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
        groupObject(['where'], 'Where', () => bodyNodeMap, { presentation: 'inline' })
      )
  })
}
