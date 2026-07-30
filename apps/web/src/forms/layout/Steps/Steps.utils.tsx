import { ItemIcon, ItemStatus, ItemProps } from './Item/Item.types'
import { AlertTriangle, CheckCircle2, Circle, GitBranch } from 'lucide-react'
import type { AuthoringStepProgressStatus } from '../../validation/authoringProgress'
import type { SummaryProps } from './StatusSummary/StatusSummary.types'
import type { AuthoringNavigationNode } from '../authoringNavigation'
import { getAuthoringStepHref } from '../authoringSearch'

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
      return <AlertTriangle size={size} />
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
  currentHref = '/',
  steps,
  stepStatuses,
  visitedStepIds
}: {
  activeSections: readonly RailSection[]
  activeStepId?: string
  mode: string
  onStepSelect: (stepId: string) => void
  currentHref?: string
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
      expanded: isActive,
      icon: iconForStep(step.label),
      id: step.id,
      isActive,
      label: step.label,
      level: 0,
      navigationTargetId: step.id,
      navigationHref: getAuthoringStepHref(currentHref, step.id),
      onSelect: children?.length ? undefined : () => onStepSelect(step.id),
      status
    }
  })
}

export function toAuthoringNavigationRailItems({
  activeTargetId,
  mode,
  navigationTree,
  onTargetSelect,
  currentHref = '/',
  visitedStepIds
}: {
  activeTargetId?: string
  mode: string
  navigationTree: readonly AuthoringNavigationNode[]
  onTargetSelect: (targetId: string, hasChildren: boolean) => void
  currentHref?: string
  visitedStepIds: ReadonlySet<string>
}): readonly ItemProps[] {
  return navigationTree.map((node) =>
    toNavigationRailItem({
      activeTargetId,
      mode,
      node,
      onTargetSelect,
      currentHref,
      visitedStepIds
    })
  )
}

export function toAuthoringRailSummaries({
  hasChanges,
  mode,
  summary
}: {
  hasChanges: boolean
  mode: string
  summary: SummarySource | undefined
}): readonly SummaryProps[] {
  const stepCount = summary?.stepCount ?? 0
  const completeCount = summary?.completeCount ?? 0
  const issueCount = (summary?.warningCount ?? 0) + (summary?.errorCount ?? 0)
  const statusSummary: SummaryProps = hasChanges
    ? {
        label: 'status',
        status: 'dirty',
        value: 'Edited'
      }
    : mode === 'create'
      ? {
          label: 'status',
          markerLabel: 'New item',
          status: 'empty',
          value: 'New'
        }
      : {
          label: 'status',
          status: 'complete',
          value: 'Saved'
        }

  return [
    {
      label: 'steps',
      markerLabel: 'Completed steps',
      status: 'complete',
      value: `${completeCount}/${stepCount}`
    },
    {
      label: issueCount === 1 ? 'issue' : 'issues',
      markerLabel: issueCount > 0 ? 'Issues found' : 'No issues',
      status: issueCount > 0 ? 'warning' : 'complete',
      value: `${issueCount}`
    },
    statusSummary
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

function toNavigationRailItem({
  activeTargetId,
  mode,
  node,
  onTargetSelect,
  currentHref,
  visitedStepIds
}: {
  activeTargetId?: string
  mode: string
  node: AuthoringNavigationNode
  onTargetSelect: (targetId: string, hasChildren: boolean) => void
  currentHref: string
  visitedStepIds: ReadonlySet<string>
}): ItemProps {
  const children = node.children?.map((child) =>
    toNavigationRailItem({
      activeTargetId,
      mode,
      node: child,
      onTargetSelect,
      currentHref,
      visitedStepIds
    })
  )
  const isActive = node.target?.id === activeTargetId
  const hasActiveDescendant = children?.some(hasActiveRailDescendant) ?? false
  const leafStatus = node.target
    ? toRailStatus(node.status, {
        mode,
        visited: visitedStepIds.has(node.target.id)
      })
    : undefined
  const status = aggregateRailStatus([
    leafStatus,
    ...(children?.map((child) => child.status) ?? [])
  ])

  return {
    children,
    expanded: hasActiveDescendant || isActive,
    icon: iconForStep(node.label),
    id: node.id,
    isActive,
    label: node.label,
    level: node.level,
    navigationTargetId: node.target?.id,
    navigationHref: node.target ? getAuthoringStepHref(currentHref, node.target.id) : undefined,
    onSelect: node.target
      ? () => onTargetSelect(node.target?.id ?? '', Boolean(children?.length))
      : undefined,
    status
  }
}

function hasActiveRailDescendant(item: ItemProps): boolean {
  return Boolean(item.isActive || item.children?.some(hasActiveRailDescendant))
}

export function aggregateRailStatus(
  statuses: readonly (ItemStatus | undefined)[] | undefined
): ItemStatus {
  const resolvedStatuses = statuses?.filter((status): status is ItemStatus => Boolean(status)) ?? []
  if (resolvedStatuses.length === 0) return 'empty'
  if (resolvedStatuses.includes('error')) return 'error'
  if (resolvedStatuses.includes('warning')) return 'warning'
  if (resolvedStatuses.includes('incomplete')) return 'incomplete'
  if (resolvedStatuses.includes('empty')) return 'empty'
  if (resolvedStatuses.includes('dirty')) return 'dirty'
  return 'complete'
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
      if (mode === 'create' && !visited) return 'empty'
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
  if (key.includes('effect')) return 'eye'
  if (key.includes('modifier')) return 'sliders'
  if (key.includes('attack')) return 'sword'
  if (key.includes('mechanic') || key.includes('rule')) return 'gear'
  if (key.includes('damage') || key.includes('ancestry')) return 'flame'
  if (key.includes('feature') || key.includes('option')) return 'spark'
  if (key.includes('scaling') || key.includes('level')) return 'trend'
  return 'book'
}
