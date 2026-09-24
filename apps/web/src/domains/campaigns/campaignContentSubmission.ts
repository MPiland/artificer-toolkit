import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'

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
