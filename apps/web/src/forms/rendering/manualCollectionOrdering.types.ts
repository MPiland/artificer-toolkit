import type { ReactNode } from 'react'

type ManualCollectionOrderingItem = {
  id: string
  label: string
}

export type ManualCollectionOrderingProviderProps = {
  children: ReactNode
  disabled: boolean
  enabled: boolean
  items: readonly ManualCollectionOrderingItem[]
  onMove: (fromIndex: number, toIndex: number) => void
}

export type ManualCollectionOrderingRowProps = ManualCollectionOrderingItem & {
  children: ReactNode
  disabled: boolean
  index: number
}

export type ManualCollectionOrderingContextValue = {
  instructionsId: string
}
