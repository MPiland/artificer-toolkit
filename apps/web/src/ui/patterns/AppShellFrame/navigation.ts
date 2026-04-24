export interface AppShellNavItem {
  label: string
  note: string
  active?: boolean
}

export const platformNavigation: AppShellNavItem[] = [
  {
    label: 'Home',
    note: 'Platform foundation',
    active: true
  },
  {
    label: 'Characters',
    note: 'Builder and sheet next'
  },
  {
    label: 'Compendium',
    note: 'Lists and authored forms'
  },
  {
    label: 'Systems',
    note: 'Runtime data and settings'
  }
]
