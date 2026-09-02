import { EFFECT_KIND } from '#core'

export type ScalarReductionAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.SCALAR_REDUCTION
  valueDefinitionId: string
  amount: { kind: 'DICE'; diceConfig: string }
  stacking: 'ADDITIVE'
  floor: 0
  recoveryTriggers: Array<'SHORT_REST' | 'LONG_REST'>
  terminalConsequence: 'TARGET_DIED'
}
