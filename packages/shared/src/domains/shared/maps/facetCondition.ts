import { buildNodeMap, type ConditionIfExpr, type NodeEntry, type NodeMap } from '#utils'
import type {
  ExistsConditionAuthored,
  FacetConditionAuthored,
  PredicateConditionAuthored
} from '#authored'
import {
  AUTHORING_CONSTRAINT_OPTIONS,
  AUTHORING_MODE_KIND_OPTIONS,
  RELATION_CODES,
  RELATION_SUBJECTS,
  SELECTABLE_PREDICATE_CODES
} from '#core'
import type { FacetExistMin } from './facetExists.js'

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

export function createFacetConditionNodeMap(
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
