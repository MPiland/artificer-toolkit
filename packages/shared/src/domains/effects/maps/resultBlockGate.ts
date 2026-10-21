import { type ResultBlockGateAuthored } from '#authored'
import { buildNodeMap } from '#utils'

const resultBlockGate = buildNodeMap<ResultBlockGateAuthored>()

export const RESULT_BLOCK_GATE_NODE_MAP = resultBlockGate.define(
  'resultBlockGate',
  ({ map, nodes }) => {
    const { number, selectSingle } = nodes

    map
      .set(
        'kind',
        selectSingle(
          ['kind'],
          'Condition',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              {
                code: 'TARGET_HIT_POINTS_AT_MOST',
                label: 'Target Hit Points At Most',
                description: "The target's current hit points are at most the amount."
              },
              {
                code: 'TARGET_HIT_POINTS_AT_LEAST',
                label: 'Target Hit Points At Least',
                description: "The target's current hit points are at least the amount."
              }
            ]
          },
          { requiredIf: true }
        )
      )
      .set(
        'amount',
        number(['amount'], 'Hit Points', { constraints: { minimum: 1 }, requiredIf: true })
      )
  }
)
