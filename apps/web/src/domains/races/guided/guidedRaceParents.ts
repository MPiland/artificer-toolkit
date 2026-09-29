import type { AuthoredCatalogueItem } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { RACE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'

export function toGuidedRaceParentOptions(
  items: readonly AuthoredCatalogueItem[],
  subjectId: string | undefined
) {
  return items
    .filter((item) => item.category === RACE_CATEGORY_CODE.BASE && item.id !== subjectId)
    .map((item) => ({ label: item.label, value: item.id }))
}
