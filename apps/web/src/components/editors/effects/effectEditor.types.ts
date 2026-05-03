import type {
  EffectDto,
  PathDto,
  TargetingDto
} from '@artificer-toolkit/schema/effects'
import type { SavingThrowDto } from '@artificer-toolkit/schema/shared'

export type EffectEditorReferenceData = {
  damageTypes: Array<{ value: string, label: string }>
  conditionTypes: Array<{ value: string, label: string }>
  creatures: Array<{ value: string, label: string }>
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
