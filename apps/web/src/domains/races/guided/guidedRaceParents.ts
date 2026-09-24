import type { AuthoredCataloguePage } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { RACE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'

export function toGuidedRaceParentOptions(
  items: AuthoredCataloguePage['page'],
  subjectId: string | undefined
) {
  return items
    .filter((item) => item.category === RACE_CATEGORY_CODE.BASE && item.id !== subjectId)
    .map((item) => ({ label: item.label, value: item.id }))
}
