import { createContext, useContext } from 'react'
import type { ManualCollectionOrderingContextValue } from './manualCollectionOrdering.types'

export const ManualCollectionOrderingContext =
  createContext<ManualCollectionOrderingContextValue | null>(null)

export function useManualCollectionOrderingContext(): ManualCollectionOrderingContextValue {
  const value = useContext(ManualCollectionOrderingContext)
  if (!value) throw new Error('Manual ordering rows must be rendered inside their provider.')
  return value
}
