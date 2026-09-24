import { convexQuery } from '@convex-dev/react-query'
import { queryOptions } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'

export function getEquipmentOptions(systemId?: string, excludeVariants = false) {
  return queryOptions(
    convexQuery(
      convexApi.content.equipmentOptions.list,
      systemId ? { systemId, ...(excludeVariants ? { excludeVariants: true } : {}) } : 'skip'
    )
  )
}
