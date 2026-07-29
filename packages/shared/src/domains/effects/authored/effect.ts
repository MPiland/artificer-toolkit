import type {
  OutcomeAuthored,
  SavingThrowAuthored,
  EffectPathAuthored,
  RangeAuthored,
  ShapeAuthored,
  TargetingAuthored
} from '#authored'
import type { ACTIVATION_CODE, ActivationCode, Trigger } from '#core'

export const EFFECT_INVOCATION_KIND = {
  ACTION: 'ACTION',
  PASSIVE: 'PASSIVE'
} as const

export type EffectInvocationKind = keyof typeof EFFECT_INVOCATION_KIND

export type ActivationAuthored =
  | {
      code: typeof ACTIVATION_CODE.FREE
    }
  | {
      code: Exclude<ActivationCode, typeof ACTIVATION_CODE.FREE>
      amount: number
    }

export type ActionEffectInvocationAuthored<TTrigger extends Trigger = Trigger> =
  | {
      kind?: typeof EFFECT_INVOCATION_KIND.ACTION
      triggerCode: Extract<TTrigger, 'SAVING_THROW'>
      savingThrow: SavingThrowAuthored
      activation: ActivationAuthored
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
    }
  | {
      kind?: typeof EFFECT_INVOCATION_KIND.ACTION
      triggerCode: Exclude<TTrigger, 'SAVING_THROW'>
      activation: ActivationAuthored
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
    }

export type PassiveEffectInvocationAuthored<TTrigger extends Trigger = Trigger> =
  | {
      kind: typeof EFFECT_INVOCATION_KIND.PASSIVE
      triggerCode: Extract<TTrigger, 'SAVING_THROW'>
      savingThrow: SavingThrowAuthored
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
    }
  | {
      kind: typeof EFFECT_INVOCATION_KIND.PASSIVE
      triggerCode: Exclude<TTrigger, 'SAVING_THROW'>
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
    }

export type EffectInvocationAuthored<TTrigger extends Trigger = Trigger> =
  | ActionEffectInvocationAuthored<TTrigger>
  | PassiveEffectInvocationAuthored<TTrigger>

export type EffectAuthored<
  TTrigger extends Trigger = Trigger,
  TOutcome extends OutcomeAuthored = OutcomeAuthored
> = {
  id: string
  order: number // int
  invocation: EffectInvocationAuthored<TTrigger>
  paths: EffectPathAuthored<TTrigger, TOutcome>[]
}
