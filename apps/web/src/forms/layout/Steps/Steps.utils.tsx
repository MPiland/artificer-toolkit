import { ItemIcon, ItemStatus, ItemProps } from './Item/Item.types'
import { AlertTriangle, CheckCircle2, Circle, GitBranch } from 'lucide-react'
import type { AuthoringStepProgressStatus } from '../../validation/authoringProgress'
import type { SummaryProps } from './StatusSummary/StatusSummary.types'

export function statusLabel(status: ItemStatus) {
  switch (status) {
    case 'complete':
      return 'Complete'
    case 'dirty':
      return 'Unsaved changes'
    case 'incomplete':
      return 'Incomplete'
    case 'warning':
      return 'Needs review'
    case 'error':
      return 'Has errors'
    case 'empty':
    default:
      return 'Not started'
  }
}

export function statusIcon(status: ItemStatus) {
  const size = 13

  switch (status) {
    case 'complete':
      return <CheckCircle2 size={size} />
    case 'dirty':
      return <GitBranch size={size} />
    case 'incomplete':
      return <Circle size={size} />
    case 'warning':
    case 'error':
      return <AlertTriangle size={size} />
    case 'empty':
    default:
      return <Circle size={size} />
  }
}

type RailSection = {
  id: string
  label: string
}

type RailStep = {
  description?: string
  id: string
  label: string
}

type SummarySource = {
  completeCount: number
  errorCount: number
  incompleteCount: number
  stepCount: number
  warningCount: number
}

export function toAuthoringRailItems({
  activeSections,
  activeStepId,
  mode,
  onStepSelect,
  steps,
  stepStatuses,
  visitedStepIds
}: {
  activeSections: readonly RailSection[]
  activeStepId?: string
  mode: string
  onStepSelect: (stepId: string) => void
  steps: readonly RailStep[]
  stepStatuses?: Partial<Record<string, AuthoringStepProgressStatus>>
  visitedStepIds: ReadonlySet<string>
}): readonly ItemProps[] {
  return steps.map((step) => {
    const isActive = step.id === activeStepId
    const children = isActive ? toStepChildren(step, activeSections) : undefined
    const status = toRailStatus(stepStatuses?.[step.id], {
      mode,
      visited: visitedStepIds.has(step.id)
    })

    return {
      children,
      description: step.description,
      expanded: isActive,
      icon: iconForStep(step.label),
      id: step.id,
      isActive,
      label: step.label,
      level: 0,
      onSelect: children?.length ? undefined : () => onStepSelect(step.id),
      status
    }
  })
}

export function toAuthoringRailSummaries({
  hasChanges,
  mode,
  stepStatuses,
  summary,
  visitedStepIds
}: {
  hasChanges: boolean
  mode: string
  stepStatuses?: Partial<Record<string, AuthoringStepProgressStatus>>
  summary: SummarySource | undefined
  visitedStepIds: ReadonlySet<string>
}): readonly SummaryProps[] {
  const stepCount = summary?.stepCount ?? 0
  const completeCount =
    mode === 'create'
      ? Object.entries(stepStatuses ?? {}).filter(
          ([stepId, status]) => status === 'complete' && visitedStepIds.has(stepId)
        ).length
      : (summary?.completeCount ?? 0)
  const issueCount =
    (summary?.warningCount ?? 0) + (summary?.errorCount ?? 0) + (summary?.incompleteCount ?? 0)

  return [
    {
      label: 'steps',
      status: completeCount === stepCount && stepCount > 0 ? 'complete' : 'incomplete',
      value: `${completeCount}/${stepCount}`
    },
    {
      label: issueCount === 1 ? 'issue' : 'issues',
      status: issueCount > 0 ? 'warning' : 'complete',
      value: `${issueCount}`
    },
    {
      label: hasChanges ? 'edited' : 'saved',
      status: hasChanges ? 'dirty' : 'complete',
      value: hasChanges ? 'Edited' : 'Saved'
    }
  ]
}

function toStepChildren(
  step: RailStep,
  sections: readonly RailSection[]
): readonly ItemProps[] | undefined {
  const distinctSections = sections.filter(
    (section) =>
      normalizeRailLabel(section.id) !== normalizeRailLabel(step.id) ||
      normalizeRailLabel(section.label) !== normalizeRailLabel(step.label)
  )

  if (distinctSections.length <= 1) return undefined

  return distinctSections.map((section) => ({
    icon: 'book' as ItemIcon,
    id: `${step.id}-${section.id}`,
    isActive: false,
    label: section.label,
    level: 1,
    status: 'empty' as ItemStatus,
    tone: 'muted'
  }))
}

function normalizeRailLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

function toRailStatus(
  status: AuthoringStepProgressStatus | undefined,
  { mode, visited }: { mode: string; visited: boolean }
): ItemStatus {
  switch (status) {
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
    case 'incomplete':
      return 'incomplete'
    case 'complete':
      if (mode === 'create' && !visited) return 'empty'
      return 'complete'
    case undefined:
      return 'empty'
  }
}

function iconForStep(label: string): ItemIcon {
  const key = label.toLowerCase()
  if (key.includes('mechanic') || key.includes('rule')) return 'gear'
  if (key.includes('damage') || key.includes('ancestry')) return 'flame'
  if (key.includes('feature') || key.includes('option')) return 'spark'
  if (key.includes('scaling') || key.includes('level')) return 'trend'
  return 'book'
}
