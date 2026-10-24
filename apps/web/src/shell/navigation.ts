import type { ComponentType } from 'react'
import type { GameSystemRuleCapabilityDto } from '@artificer-toolkit/schema/api/rulesRuntime'
import IBook from '#assets/icons/IBook'
import ICategory from '#assets/icons/ICategory'
import IChar from '#assets/icons/IChar'
import ICampaign from '#assets/icons/ICampaign'
import IClass from '#assets/icons/IClass'
import ICreature from '#assets/icons/ICreature'
import IFeat from '#assets/icons/IFeat'
import IHome from '#assets/icons/IHome'
import IRaces from '#assets/icons/IRaces'
import IScroll from '#assets/icons/IScroll'
import ISack from '#assets/icons/ISack'
import IUser from '#assets/icons/IUser'

export interface AppShellNavItem {
  label: string
  href?: string
  icon: ComponentType<{ className?: string; size?: number }>
}

export interface AppShellNavGroup {
  label: string
  items: AppShellNavItem[]
  /** Shown in the navigation menu when the group has no entries. */
  emptyLabel?: string
}

export type ContentKind = GameSystemRuleCapabilityDto['contentKinds'][number]

/** Presentation of each authored content kind; a missing kind fails typecheck. */
const contentKindNavigation = {
  SPELL: { label: 'Spells', href: '/spells', icon: IScroll },
  BACKGROUND: { label: 'Backgrounds', href: '/backgrounds', icon: IBook },
  FEAT: { label: 'Feats', href: '/feats', icon: IFeat },
  RACE: { label: 'Races', href: '/races', icon: IRaces },
  CLASS: { label: 'Classes', href: '/classes', icon: IClass },
  EQUIPMENT: { label: 'Equipment', href: '/equipment', icon: ISack },
  CREATURE: { label: 'Creatures', href: '/creatures', icon: ICreature },
  VEHICLE: { label: 'Vehicles', href: '/vehicles', icon: ICategory }
} satisfies Record<ContentKind, AppShellNavItem>

export const contentKindOrder = [
  'SPELL',
  'BACKGROUND',
  'FEAT',
  'RACE',
  'CLASS',
  'EQUIPMENT',
  'CREATURE',
  'VEHICLE'
] as const satisfies readonly ContentKind[]

const workspaceNavigation: AppShellNavGroup = {
  label: 'Workspace',
  items: [
    {
      label: 'Home',
      href: '/home',
      icon: IHome
    },
    {
      label: 'Characters',
      href: '/characters',
      icon: IChar
    },
    {
      label: 'Campaigns',
      href: '/campaigns',
      icon: ICampaign
    },
    {
      label: 'Game Systems',
      href: '/systems',
      icon: ICategory
    },
    {
      label: 'Social Hub',
      href: '/social',
      icon: IUser
    }
  ]
}

/**
 * Builds the navigation from the content kinds the visible Systems publish. `undefined` means the
 * kinds are still loading, so no Content group shows yet; an empty list shows an explicit empty state.
 */
export function buildPlatformNavigation(
  publishedKinds: readonly ContentKind[] | undefined
): AppShellNavGroup[] {
  if (!publishedKinds) return [workspaceNavigation]
  const items = contentKindOrder
    .filter((kind) => publishedKinds.includes(kind))
    .map((kind) => contentKindNavigation[kind])
  return [
    workspaceNavigation,
    {
      label: 'Content',
      items,
      emptyLabel: items.length === 0 ? 'No Game System content available' : undefined
    }
  ]
}

export function isNavItemActive(item: AppShellNavItem, currentPath: string) {
  if (!item.href) {
    return false
  }

  if (item.href === '/home') {
    return currentPath === '/home'
  }

  return currentPath === item.href || currentPath.startsWith(`${item.href}/`)
}
