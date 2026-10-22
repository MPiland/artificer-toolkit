import type { ReactNode } from 'react'

type CharacterSelectionCardDetail = {
  label: string
  value: ReactNode
  prominence?: 'primary' | 'secondary'
  status?: 'default' | 'unmet'
}

export type CharacterSelectionCardOption = {
  id: string
  label: string
  description?: string
  details: CharacterSelectionCardDetail[]
  disabled?: boolean
  disabledReason?: string
}

export type CharacterSelectionCardGroup = {
  id: string
  label?: string
  options: CharacterSelectionCardOption[]
}

export type CharacterSelectionModalProps = {
  actionLabel: string
  currentId: string | null
  description: string
  groups: CharacterSelectionCardGroup[]
  opened: boolean
  selectedId: string | null
  title: string
  onClose: () => void
  onCommit: (id: string) => void
  onSelectedIdChange: (id: string) => void
}
