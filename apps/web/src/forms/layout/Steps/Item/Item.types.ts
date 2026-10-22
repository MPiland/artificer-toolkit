export type ItemIcon =
  | 'book'
  | 'bolt'
  | 'check'
  | 'cube'
  | 'eye'
  | 'flame'
  | 'gear'
  | 'sliders'
  | 'spark'
  | 'sword'
  | 'trend'

export type ItemStatus = 'complete' | 'dirty' | 'warning' | 'error' | 'incomplete' | 'empty'

type ItemTone = 'default' | 'muted'

export type ItemProps = {
  children?: readonly ItemProps[]
  description?: string
  expanded?: boolean
  icon?: ItemIcon
  id: string
  isActive?: boolean
  label: string
  level?: number
  navigationTargetId?: string
  navigationHref?: string
  onSelect?: () => void
  status?: ItemStatus
  tone?: ItemTone
}
