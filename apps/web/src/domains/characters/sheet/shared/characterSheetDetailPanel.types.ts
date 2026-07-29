import type { ReactNode } from 'react'

export type CharacterSheetDetailPanelProps = {
  ariaId: string
  title: string
  description?: ReactNode
  headerActions?: ReactNode
  hideTitle?: boolean
  children: ReactNode
}

export type CharacterSheetDetailRowProps = {
  ariaLabel?: string
  left: ReactNode
  right?: ReactNode
}

export type CharacterSheetDetailRowListProps = {
  children: ReactNode
}
