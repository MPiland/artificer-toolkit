import type { ReactNode } from 'react'

export type EditorSectionProps = {
  accessory?: ReactNode
  children: ReactNode
  description?: string
  headingId: string
  icon?: ReactNode
  title: string
}
