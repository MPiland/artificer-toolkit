import type { ReactNode } from 'react'

export type ContextCardProps = {
  children: ReactNode
  title: string
  titleId: string
  header?: ContextCardHeaderProps
}

export type ContextCardHeaderProps = {
  divider?: boolean
  emphasized?: boolean
}
