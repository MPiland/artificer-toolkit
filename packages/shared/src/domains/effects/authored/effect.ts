import type {
  SavingThrowAuthored,
  MomentAuthored,
  RangeAuthored,
  ShapeAuthored
} from '#authored'
import type {
  ACTIVATION_CODE,
  ActivationCode,
  Trigger
} from '#core'

export type ActivationAuthored
  = | { code: typeof ACTIVATION_CODE.FREE }
    | {
      code: Exclude<ActivationCode, typeof ACTIVATION_CODE.FREE>
      amount: number
    }

export type InvocationAuthored<TTrigger extends Trigger = Trigger>
  = | {
    triggerCode: Extract<TTrigger, 'SAVING_THROW'>
    savingThrow: SavingThrowAuthored
    activation: ActivationAuthored
    range: RangeAuthored
    shape?: ShapeAuthored
  } | {
    triggerCode: Exclude<TTrigger, 'SAVING_THROW'>
    activation: ActivationAuthored
    range: RangeAuthored
    shape?: ShapeAuthored
  }

export type EffectAuthored<
  TTrigger extends Trigger = Trigger
> = {
  id: string
  order: number // int
  invocation: InvocationAuthored<TTrigger>
  moments: MomentAuthored<TTrigger>[]
}
