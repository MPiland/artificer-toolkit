import type { ReactNode } from 'react'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { AuthoringStepProgressStatus } from '../validation/authoringProgress'

export function getAuthoringStatus(mode: string, isDraft: boolean) {
  if (mode === 'create') return { label: 'Draft' }
  if (isDraft) return { label: 'Draft' }
  return { label: 'Active' }
}

export function readReactNodeText(value: ReactNode): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

export function getRulesetLabel(
  system:
    | Pick<NonNullable<SystemResponseDto>, 'label' | 'rulesetCode' | 'rulesetVersion'>
    | null
    | undefined
): string | undefined {
  if (!system) return undefined

  const rulesetName = system.rulesetCode === 'dnd5e' ? 'D&D 5e' : system.label
  return rulesetName.includes(system.rulesetVersion)
    ? rulesetName
    : `${rulesetName} ${system.rulesetVersion}`
}

export function getFinalizeBlockReason(status: AuthoringStepProgressStatus | undefined): string {
  switch (status) {
    case 'error':
      return 'Fix step errors before finalizing.'
    case 'warning':
      return 'Resolve step warnings before finalizing.'
    case 'incomplete':
      return 'Complete every required step before finalizing.'
    case 'complete':
    case undefined:
      return 'Complete every step before finalizing.'
  }
}
