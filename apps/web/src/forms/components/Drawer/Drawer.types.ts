import type { ReactNode } from 'react'
import type { ResponsiveMode } from '../Table/Table.types'

export type DrawerProps = {
  children?: ReactNode
  onClose: () => void
  opened: boolean
  responsiveMode: ResponsiveMode
  title: string
}
