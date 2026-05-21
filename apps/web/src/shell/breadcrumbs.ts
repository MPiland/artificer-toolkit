import type { AppShellNavGroup } from './navigation'
import { isNavItemActive } from './navigation'

export interface ShellBreadcrumbMatch {
  loaderData?: unknown
  routeId: string
}

export function buildShellBreadcrumbs({
  currentPath,
  matches,
  navigation
}: {
  currentPath: string
  matches: ShellBreadcrumbMatch[]
  navigation: AppShellNavGroup[]
}) {
  const activeItem = getActiveNavItem(navigation, currentPath)
  const labels = [activeItem?.label ?? 'Home']
  const dynamicLabel = getLastBreadcrumbLabel(matches)

  if (dynamicLabel && dynamicLabel !== labels[0]) {
    labels.push(dynamicLabel)
  }

  if (currentPath.endsWith('/edit')) {
    labels.push('Edit')
  } else if (currentPath.endsWith('/new')) {
    labels.push('New')
  }

  return labels
}

function getActiveNavItem(navigation: AppShellNavGroup[], currentPath: string) {
  for (const group of navigation) {
    const item = group.items.find((navItem) => isNavItemActive(navItem, currentPath))

    if (item) return item
  }

  return null
}

function getLastBreadcrumbLabel(matches: ShellBreadcrumbMatch[]) {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const label = getBreadcrumbLabel(matches[index].loaderData)

    if (label) return label
  }

  return null
}

function getBreadcrumbLabel(loaderData: unknown) {
  if (!isRecord(loaderData)) return null

  const label = loaderData.breadcrumbLabel
  return typeof label === 'string' && label.trim().length > 0 ? label : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
