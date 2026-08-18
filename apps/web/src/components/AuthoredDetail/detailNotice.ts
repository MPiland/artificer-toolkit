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
      title: 'Draft needs attention',
      body: `This draft was saved in an older format. Your active ${lowerLabel} is unchanged. Discard the draft to continue.`,
      action: { label: 'Discard draft', tone: 'secondary', onClick: onDiscard }
    }
  }

  if (!canViewActive && mode !== 'draft') return undefined

  return {
    tone: 'draft',
    title: canViewActive ? 'Draft preview' : 'Draft only',
    body: canViewActive
      ? isViewingActive
        ? `You are viewing the active ${lowerLabel}. A draft is still available to resume.`
        : `You are previewing the draft. The active ${lowerLabel} remains unchanged until you activate it.`
      : `This ${lowerLabel} has not been activated yet.`,
    action: canViewActive
      ? {
          label: isViewingActive ? 'View draft' : 'View active',
          tone: 'secondary',
          onClick: isViewingActive ? onViewDraft : onViewActive
        }
      : undefined
  }
}
