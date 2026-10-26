import { type PathChoiceOptionAuthored } from '#authored'
import { buildNodeMap } from '#utils'

const choiceOptionRequiredRule =
  buildNodeMap<NonNullable<PathChoiceOptionAuthored['requiresOptionalRule']>>()

/** The optional combat rule a pick option is offered under (MOVE-2.T2a). */
export const CHOICE_OPTION_REQUIRED_RULE_NODE_MAP = choiceOptionRequiredRule.define(
  'choiceOptionRequiredRule',
  ({ map, nodes, data }) => {
    const { selectSingle } = nodes
    const { table } = data

    map.set(
      'definitionId',
      selectSingle(
        ['definitionId'],
        'Optional Rule',
        {
          kind: 'DATA',
          relationship: table('reusable_definitions', { selectColumns: ['id', 'label'] })
        },
        { requiredIf: true }
      )
    )
  }
)
