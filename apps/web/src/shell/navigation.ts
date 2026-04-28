import type { ComponentType } from 'react'
import IBook from '#assets/icons/IBook'
import ICategory from '#assets/icons/ICategory'
import IChar from '#assets/icons/IChar'
import IClass from '#assets/icons/IClass'
import IFeat from '#assets/icons/IFeat'
import IHome from '#assets/icons/IHome'
import IProps from '#assets/icons/IProps'
import IRaces from '#assets/icons/IRaces'
import IScroll from '#assets/icons/IScroll'
import ISack from '#assets/icons/ISack'

export interface AppShellNavItem {
  label: string
  href?: string
  icon: ComponentType<{ className?: string }>
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
        label: 'Spells',
        href: '/spells',
        icon: IScroll
      }
    ]
  }
]

export const storybookNavigation: AppShellNavGroup[] = [
  ...platformNavigation,
  {
    label: 'Coming later',
    items: [
      {
        label: 'Characters',
        icon: IChar
      },
      {
        label: 'Backgrounds',
        icon: IBook
      },
      {
        label: 'Feats',
        icon: IFeat
      },
      {
        label: 'Races',
        icon: IRaces
      },
      {
        label: 'Equipment',
        icon: ISack
      },
      {
        label: 'Classes',
        icon: IClass
      },
      {
        label: 'Creatures',
        icon: IProps
      },
      {
        label: 'Vehicles',
        icon: ICategory
      },
      {
        label: 'Systems',
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
