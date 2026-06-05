export type TopBarCrumb = {
  label: string
}

export type TopBarProps = {
  accountLabel?: string
  crumbs: readonly TopBarCrumb[]
  isNavigationOpen: boolean
  onNavigationToggle: () => void
  statusLabel?: string
}
