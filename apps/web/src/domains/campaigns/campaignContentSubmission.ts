import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import { api } from '#app/lib/api'
import { loadPagedAuthoredCatalogItems } from '#app/data/authoredCatalogPages'

export const campaignContentTypeOptions: Array<{
  value: AuthoredSubjectKindDto
  label: string
}> = [
  { value: 'BACKGROUND', label: 'Background' },
  { value: 'CLASS', label: 'Class or subclass' },
  { value: 'CREATURE', label: 'Creature' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'FEAT', label: 'Feat' },
  { value: 'RACE', label: 'Race or heritage' },
  { value: 'SPELL', label: 'Spell' },
  { value: 'VEHICLE', label: 'Vehicle' }
]

export interface CampaignContentCandidate {
  subjectId: string
  label: string
}

function toCandidates(
  items: Array<{
    id: string
    publicId: string
    label: string
    provenance: { kind: 'MASTER' | 'OWNED' }
    permissions: { canEdit: boolean }
  }>
): CampaignContentCandidate[] {
  return items
    .filter((item) => item.provenance.kind === 'OWNED' && item.permissions.canEdit)
    .map((item) => ({ subjectId: item.id, label: item.label }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

export async function listOwnedCampaignContent(
  subjectKind: AuthoredSubjectKindDto
): Promise<CampaignContentCandidate[]> {
  switch (subjectKind) {
    case 'BACKGROUND':
      return toCandidates(
        await loadPagedAuthoredCatalogItems(api.content.backgrounds.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      )
    case 'CLASS':
      return toCandidates(
        await loadPagedAuthoredCatalogItems(api.content.classes.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      )
    case 'CREATURE':
      return toCandidates(
        await loadPagedAuthoredCatalogItems(api.content.creatures.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      )
    case 'EQUIPMENT':
      return toCandidates(
        await loadPagedAuthoredCatalogItems(api.content.equipment.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      )
    case 'FEAT':
      return toCandidates(
        await loadPagedAuthoredCatalogItems(api.content.feats.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      )
    case 'RACE':
      return toCandidates(
        await loadPagedAuthoredCatalogItems(api.content.races.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      )
    case 'SPELL':
      return toCandidates(
        await loadPagedAuthoredCatalogItems(api.content.spells.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      )
    case 'VEHICLE':
      return toCandidates(
        await loadPagedAuthoredCatalogItems(api.content.vehicles.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      )
  }
}
