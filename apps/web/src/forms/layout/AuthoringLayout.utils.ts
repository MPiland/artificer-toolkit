import { ReactNode } from 'react'
import { AuthoringStepProgressStatus } from '../validation/authoringProgress'

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
