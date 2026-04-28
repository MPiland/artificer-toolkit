import type { EffectDto, PathDto, SavingThrowDto, TargetingDto } from '@artificer-toolkit/schema'

export type EffectEditorReferenceData = {
  damageTypes: Array<{ value: string, label: string }>
  conditionTypes: Array<{ value: string, label: string }>
  creatures: Array<{ value: string, label: string }>
}

export type EffectEditorFormApi = {
  setFieldValue: (field: 'effects', value: EffectDto[]) => void
}

export type EffectInvocation = EffectDto['invocation']
export type EffectActivation = Extract<EffectInvocation, { activation: unknown }>['activation']
export type OutcomeDraft = Record<string, unknown>

export type FixedPathDto = PathDto & {
  selectionKind: 'FIXED'
  resultBlock: {
    outcomes: OutcomeDraft[]
  }
}

export function hasSavingThrow(invocation: EffectInvocation): invocation is EffectInvocation & { savingThrow: SavingThrowDto } {
  return 'savingThrow' in invocation
}

export function hasActivation(invocation: EffectInvocation): invocation is EffectInvocation & { activation: EffectActivation } {
  return 'activation' in invocation
}

export function isFixedPath(path: PathDto): path is FixedPathDto {
  return path.selectionKind === 'FIXED' && 'resultBlock' in path
}

export function isTargetingWithDisposition(targeting: TargetingDto): targeting is Extract<TargetingDto, { dispositionKind?: unknown }> {
  return targeting.selectionKind !== 'SELF'
}
