import type { CampaignSessionReferencePinDto } from '#app/lib/api'

export type AuthoredReferenceTarget = Extract<
  CampaignSessionReferencePinDto['target'],
  { kind: 'AUTHORED_ROUTE' }
>

export const authoredReferenceSubjectOptions: ReadonlyArray<{
  label: string
  value: AuthoredReferenceTarget['routeSubjectKind']
}> = [
  { label: 'Background', value: 'BACKGROUND' },
  { label: 'Class', value: 'CLASS' },
  { label: 'Creature', value: 'CREATURE' },
  { label: 'Equipment', value: 'EQUIPMENT' },
  { label: 'Feat', value: 'FEAT' },
  { label: 'Race', value: 'RACE' },
  { label: 'Spell', value: 'SPELL' },
  { label: 'Vehicle', value: 'VEHICLE' }
]
