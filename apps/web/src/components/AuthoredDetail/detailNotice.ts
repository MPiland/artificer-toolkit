import type { AuthoredDetailNotice } from './AuthoredDetail.types'

export function buildAuthoredDetailNotice({
  canViewActive,
  domainLabel,
  hasInvalidDraft,
  isViewingActive,
  mode,
  onDiscard,
  onViewActive,
  onViewDraft
}: {
  canViewActive: boolean
  domainLabel: string
  hasInvalidDraft: boolean
  isViewingActive: boolean
  mode: string
  onDiscard: () => void
  onViewActive: () => void
  onViewDraft: () => void
}): AuthoredDetailNotice | undefined {
  const lowerLabel = domainLabel.toLowerCase()

  if (hasInvalidDraft) {
    return {
      tone: 'warning',
      title: 'Invalid draft found',
      body: `The active ${lowerLabel} is shown because the saved draft no longer matches the current schema.`,
      action: { label: 'Discard Draft', tone: 'secondary', onClick: onDiscard }
    }
  }

  if (!canViewActive && mode !== 'draft') return undefined

  return {
    tone: 'draft',
    title: canViewActive ? 'Draft preview' : 'Draft only',
    body: canViewActive
      ? isViewingActive
        ? `You are viewing the active ${lowerLabel}. A draft is still available to resume.`
        : `You are previewing unsaved draft changes. The active ${lowerLabel} remains unchanged until activation.`
      : `This ${lowerLabel} has not been activated yet.`,
    action: canViewActive
      ? {
          label: isViewingActive ? 'View Draft' : 'View Active',
          tone: 'secondary',
          onClick: isViewingActive ? onViewDraft : onViewActive
        }
      : undefined
  }
}
