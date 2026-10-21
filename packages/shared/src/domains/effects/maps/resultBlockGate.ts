import { type ResultBlockGateAuthored } from '#authored'
import { buildNodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'

const resultBlockGate = buildNodeMap<AllUnionFields<ResultBlockGateAuthored>>()

export const RESULT_BLOCK_GATE_NODE_MAP = resultBlockGate.define(
  'resultBlockGate',
  ({ map, nodes, cond, logic }) => {
    const { number, selectSingle, text } = nodes
    const kind = cond.local().field(['kind'])
    const isReducedToZero = kind.eq('REDUCED_TO_ZERO_BY')
    const isHitPointGate = logic.or([
      kind.eq('TARGET_HIT_POINTS_AT_MOST'),
      kind.eq('TARGET_HIT_POINTS_AT_LEAST')
    ])

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
              },
              {
                code: 'REDUCED_TO_ZERO_BY',
                label: 'Reduced To 0 Hit Points By',
                description:
                  'The named damage outcome of this path took the target from above 0 hit points to 0.'
              }
            ]
          },
          { requiredIf: true }
        )
      )
      .set(
        'amount',
        number(['amount'], 'Hit Points', {
          constraints: { minimum: 1 },
          requiredIf: isHitPointGate,
          showIf: isHitPointGate
        })
      )
      .set(
        'damageOutcomeId',
        text(['damageOutcomeId'], 'Damage Outcome ID', {
          requiredIf: isReducedToZero,
          showIf: isReducedToZero
        })
      )
  }
)
