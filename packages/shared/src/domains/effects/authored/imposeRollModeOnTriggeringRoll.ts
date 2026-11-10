import { EFFECT_KIND } from '#core'

/**
 * The roll that triggered this reaction takes `rollMode`, a code from the System's roll-mode
 * vocabulary (Protection: disadvantage on the attack roll).
 */
export type ImposeRollModeOnTriggeringRollAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL
  rollMode: string
}
