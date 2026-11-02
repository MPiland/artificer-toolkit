import { EFFECT_KIND, type ModifierRolledDieAuthored } from '#core'

/**
 * The reactor rolls `die` and subtracts it from the d20 roll that triggered this reaction. The die is
 * the reactor's own, sized by `facesScaling` at the class level it holds (Cutting Words).
 */
export type SubtractFromTriggeringRollAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.SUBTRACT_FROM_TRIGGERING_ROLL
  die: ModifierRolledDieAuthored & { sign: 'SUBTRACT' }
}
