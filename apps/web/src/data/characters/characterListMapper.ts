import type { CharacterListResponseDto } from '#app/lib/api'
import type { AuthoredListAttributeColumn, AuthoredListFilter, AuthoredListItem } from '#components/AuthoredList'

function formatStatus(status: string | undefined): string {
  if (!status) return 'Draft'
  return status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function characterDescription(item: CharacterListResponseDto['items'][number]): string {
  if (item.draft?.draftState === 'ACTIVE_WITH_DRAFT') {
    return 'Draft changes saved. Active character stays unchanged until finalized.'
  }

  if (item.draft?.draftState === 'DRAFT_ONLY') {
    return 'New character draft in progress.'
  }

  return 'Character build ready to inspect.'
}

type CharacterListItem = CharacterListResponseDto['items'][number]

function isDraftOnlyCharacterListItem(item: CharacterListItem) {
  return item.draft?.draftState === 'DRAFT_ONLY'
}

function hasCharacterDraftWork(item: CharacterListItem) {
  return item.status === 'DRAFT' || item.draft != null
}

function mapCharacterListItemToAuthoredItem(item: CharacterListItem): AuthoredListItem {
  return {
    id: item.id,
    publicId: item.publicId,
    name: item.label || 'Untitled Character',
    description: characterDescription(item),
    attributes: {
      Version: item.streamVersion > 0 ? String(item.streamVersion) : 'Draft'
    },
    statusLabel: item.draft ? 'Draft' : formatStatus(item.status),
    statusTone: item.draft || item.status === 'DRAFT' ? 'draft' : 'default',
    filterValues: {
      status: item.status,
      draftState: item.draft?.draftState ?? 'ACTIVE'
    },
    sortValues: {
      name: item.label || 'Untitled Character',
      status: formatStatus(item.status)
    },
    searchText: `${item.label} ${item.status} ${item.draft?.draftState ?? ''}`,
    sourceLabel: 'Your character',
    sourceKind: 'owned',
    permissions: {
      canView: true,
      canEdit: true,
      canCopy: false,
      canDelete: false
    }
  }
}

export function mapCharacterListToAuthoredItems(response: CharacterListResponseDto): AuthoredListItem[] {
  return response.items.map(mapCharacterListItemToAuthoredItem)
}

export function mapCharacterListToActiveAuthoredItems(response: CharacterListResponseDto): AuthoredListItem[] {
  return response.items
    .filter((item) => !isDraftOnlyCharacterListItem(item))
    .map(mapCharacterListItemToAuthoredItem)
}

export function mapCharacterListToDraftAuthoredItems(response: CharacterListResponseDto): AuthoredListItem[] {
  return response.items
    .filter(hasCharacterDraftWork)
    .map(mapCharacterListItemToAuthoredItem)
}

export function buildCharacterListFilters(response: CharacterListResponseDto): AuthoredListFilter[] {
  const statuses = Array.from(new Set(response.items.map((item) => item.status))).sort()
  const draftStates = Array.from(new Set(response.items.map((item) => item.draft?.draftState ?? 'ACTIVE'))).sort()

  return [
    {
      key: 'status',
      label: 'Status',
      placeholder: 'Any status',
      options: statuses.map((status) => ({
        value: status,
        label: formatStatus(status)
      }))
    },
    {
      key: 'draftState',
      label: 'Draft',
      placeholder: 'Any draft state',
      options: draftStates.map((draftState) => ({
        value: draftState,
        label: draftState === 'ACTIVE'
          ? 'No draft'
          : draftState === 'ACTIVE_WITH_DRAFT'
            ? 'Active with draft'
            : 'Draft only'
      }))
    }
  ]
}

export const characterListAttributeColumns = [
  { key: 'Version', label: 'Version', width: 112 }
] satisfies AuthoredListAttributeColumn[]

export const characterListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'status', label: 'Status' }
]

export function summarizeCharacterList(response: CharacterListResponseDto) {
  const draftCount = response.items.filter((item) => item.status === 'DRAFT' || item.draft != null).length
  const activeCount = response.items.length - draftCount

  return `${response.items.length} characters / ${activeCount} active / ${draftCount} drafts`
}
