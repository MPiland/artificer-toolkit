import { handleRequest, getEquipmentListQuery, getEquipmentQuery } from '@artificer-toolkit/functions'
import type { Equipment, EquipmentListItem } from '@artificer-toolkit/shared'

// list
export const getEquipmentList = handleRequest<[], EquipmentListItem[] | []>(getEquipmentListQuery, () => [])

// single
export const getEquipment = handleRequest<[string], Equipment | null>(getEquipmentQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})
