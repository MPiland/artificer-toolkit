import type { AuthoredDraftSummaryDto } from '@artificer-toolkit/schema/api/content'
import type { AuthoredListItem } from '#components/AuthoredList'

interface DraftSummaryListOptions {
  categoryAttributeKey?: string
  formatCategory?: (category: string | undefined) => string
  formatSchool?: (schoolId: string | undefined) => string | undefined
}

function summarizeDescription(description: string | null | undefined): string {
  if (!description) return 'No description yet.'
  return description.replace(/<[^>]*>/g, '').trim() || 'No description yet.'
}

export function mapDraftSummariesToAuthoredItems(
  drafts: AuthoredDraftSummaryDto[],
  options: DraftSummaryListOptions = {}
): AuthoredListItem[] {
  return drafts.map((draft) => {
    const categoryLabel = options.formatCategory?.(draft.category) ?? draft.category
    const magicSchoolId = draft.magicSchoolId ?? undefined
    const schoolLabel = options.formatSchool?.(magicSchoolId) ?? magicSchoolId

    return {
      id: draft.subjectId,
      publicId: draft.publicId,
      name: draft.label,
      description: summarizeDescription(draft.description),
      contentState: 'draft',
      attributes: {
        ...(options.categoryAttributeKey && categoryLabel ? { [options.categoryAttributeKey]: categoryLabel } : {}),
        ...(draft.level !== undefined ? { level: Number(draft.level) === 0 ? 'Cantrip' : String(draft.level) } : {}),
        ...(schoolLabel ? { school: schoolLabel } : {})
      },
      filterValues: {
        source: 'OWNED',
        ...(draft.category ? { category: draft.category } : {}),
        ...(draft.level !== undefined ? { level: String(draft.level) } : {}),
        ...(magicSchoolId ? { school: magicSchoolId } : {})
      },
      sortValues: {
        category: categoryLabel,
        level: draft.level ?? 0,
        name: draft.label,
        school: schoolLabel
      },
      searchText: summarizeDescription(draft.description),
      sourceLabel: 'Homebrew',
      sourceKind: 'owned',
      permissions: {
        canView: true,
        canEdit: true,
        canCopy: false,
        canDelete: true
      }
    }
  })
}
