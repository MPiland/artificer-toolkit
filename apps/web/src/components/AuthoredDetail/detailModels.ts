import type { AuthoredContentProvenanceDto } from '@artificer-toolkit/schema/api/common'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import type { AuthoredDetailAction, AuthoredDetailSectionModel } from './AuthoredDetail.types'
import type { AuthoredDetailViewMode } from './authoredDetailState'
import { formatEnumLabel, stripHtml } from './detailFormatters'

export interface LabelDescriptionRecord {
  id?: string
  label?: string
  description?: string | null
  order?: number
  availableAtLevel?: number
}

export function sortLabelDescriptionRecords<TRecord extends LabelDescriptionRecord>(
  records: readonly TRecord[] | null | undefined
): TRecord[] {
  return [...(records ?? [])].sort((first, second) => {
    const firstOrder = first.order ?? Number.MAX_SAFE_INTEGER
    const secondOrder = second.order ?? Number.MAX_SAFE_INTEGER
    if (firstOrder !== secondOrder) return firstOrder - secondOrder
    return (first.label ?? '').localeCompare(second.label ?? '')
  })
}

export function toDetailItems(records: readonly LabelDescriptionRecord[] | null | undefined) {
  return sortLabelDescriptionRecords(records).map((record, index) => ({
    id: record.id ?? `${record.label ?? 'item'}-${index}`,
    title: record.label ?? 'Untitled',
    meta: record.availableAtLevel ? `Level ${record.availableAtLevel}` : undefined,
    description: record.description
  }))
}

export function buildDetailStatusLabels({
  mode,
  provenance,
  status
}: {
  draft: AuthoredDraftDto | null
  mode: AuthoredDetailViewMode
  provenance: AuthoredContentProvenanceDto
  status?: string
}) {
  const statusLabel = status ? formatEnumLabel(status) : null
  const labels = [
    provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
    mode === 'draft' && statusLabel === 'Draft' ? null : statusLabel
  ]

  if (mode === 'draft') {
    labels.unshift('Draft')
  }

  if (mode === 'invalid-draft-only') {
    labels.unshift('Invalid Draft')
  }

  return labels.filter((label): label is string => Boolean(label))
}

export function compactAuthoredDetailActions(
  actions: (AuthoredDetailAction | null | undefined)[]
): AuthoredDetailAction[] {
  return actions.filter((action): action is AuthoredDetailAction => Boolean(action))
}

export function compactAuthoredDetailSections(
  sections: (AuthoredDetailSectionModel | null | undefined)[]
): AuthoredDetailSectionModel[] {
  return sections.filter((section): section is AuthoredDetailSectionModel => Boolean(section))
}

export function hasDetailText(value: string | null | undefined): boolean {
  return stripHtml(value).length > 0
}
