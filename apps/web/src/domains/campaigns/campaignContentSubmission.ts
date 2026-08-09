import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import type { SubmitCampaignContentVersionInput } from '@artificer-toolkit/schema/api/campaigns'
import { api } from '#app/lib/api'

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
  publicId: string
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
    .map((item) => ({ subjectId: item.id, publicId: item.publicId, label: item.label }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

function requireOwnedSnapshot(
  response: {
    item: unknown
    provenance: { kind: 'MASTER' | 'OWNED' }
  } | null
): SubmitCampaignContentVersionInput['snapshot'] {
  if (!response?.item || response.provenance.kind !== 'OWNED') {
    throw new Error('That owned homebrew record is no longer available.')
  }
  return response.item as SubmitCampaignContentVersionInput['snapshot']
}

export async function listOwnedCampaignContent(
  subjectKind: AuthoredSubjectKindDto
): Promise<CampaignContentCandidate[]> {
  switch (subjectKind) {
    case 'BACKGROUND':
      return toCandidates((await api.content.backgrounds.list()).items)
    case 'CLASS':
      return toCandidates((await api.content.classes.list()).items)
    case 'CREATURE':
      return toCandidates((await api.content.creatures.list()).items)
    case 'EQUIPMENT':
      return toCandidates((await api.content.equipment.list()).items)
    case 'FEAT':
      return toCandidates((await api.content.feats.list()).items)
    case 'RACE':
      return toCandidates((await api.content.races.list()).items)
    case 'SPELL':
      return toCandidates((await api.content.spells.list()).items)
    case 'VEHICLE':
      return toCandidates((await api.content.vehicles.list()).items)
  }
}

export async function loadCampaignContentSnapshot(
  subjectKind: AuthoredSubjectKindDto,
  publicId: string
): Promise<SubmitCampaignContentVersionInput['snapshot']> {
  switch (subjectKind) {
    case 'BACKGROUND':
      return requireOwnedSnapshot(await api.content.backgrounds.get(publicId))
    case 'CLASS':
      return requireOwnedSnapshot(await api.content.classes.get(publicId))
    case 'CREATURE':
      return requireOwnedSnapshot(await api.content.creatures.get(publicId))
    case 'EQUIPMENT':
      return requireOwnedSnapshot(await api.content.equipment.get(publicId))
    case 'FEAT':
      return requireOwnedSnapshot(await api.content.feats.get(publicId))
    case 'RACE':
      return requireOwnedSnapshot(await api.content.races.get(publicId))
    case 'SPELL':
      return requireOwnedSnapshot(await api.content.spells.get(publicId))
    case 'VEHICLE':
      return requireOwnedSnapshot(await api.content.vehicles.get(publicId))
  }
}
