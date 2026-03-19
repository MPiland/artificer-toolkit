import type {
  SavingThrowAuthored,
  BranchAuthored,
  RangeAuthored,
  ShapeAuthored,
  TargetingAuthored
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
    targeting?: TargetingAuthored
  } | {
    triggerCode: Exclude<TTrigger, 'SAVING_THROW'>
    activation: ActivationAuthored
    range: RangeAuthored
    shape?: ShapeAuthored
    targeting?: TargetingAuthored
  }

export type EffectAuthored<
  TTrigger extends Trigger = Trigger
> = {
  id: string
  order: number // int
  invocation: InvocationAuthored<TTrigger>
  branches: BranchAuthored<TTrigger>[]
}
