import type { ItemStatus } from '../Item/Item.types'

export type SummaryProps = {
  label: string
  markerLabel?: string
  status: ItemStatus
  value: string
}
