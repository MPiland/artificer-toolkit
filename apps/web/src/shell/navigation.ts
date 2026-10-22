import type { ComponentType } from 'react'
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
}

export const platformNavigation: AppShellNavGroup[] = [
  {
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
  },
  {
    label: 'Content',
    items: [
      {
        label: 'Spells',
        href: '/spells',
        icon: IScroll
      },
      {
        label: 'Backgrounds',
        href: '/backgrounds',
        icon: IBook
      },
      {
        label: 'Feats',
        href: '/feats',
        icon: IFeat
      },
      {
        label: 'Races',
        href: '/races',
        icon: IRaces
      },
      {
        label: 'Classes',
        href: '/classes',
        icon: IClass
      },
      {
        label: 'Equipment',
        href: '/equipment',
        icon: ISack
      },
      {
        label: 'Creatures',
        href: '/creatures',
        icon: ICreature
      },
      {
        label: 'Vehicles',
        href: '/vehicles',
        icon: ICategory
      }
    ]
  }
]

export function isNavItemActive(item: AppShellNavItem, currentPath: string) {
  if (!item.href) {
    return false
  }

  if (item.href === '/home') {
    return currentPath === '/home'
  }

  return currentPath === item.href || currentPath.startsWith(`${item.href}/`)
}
