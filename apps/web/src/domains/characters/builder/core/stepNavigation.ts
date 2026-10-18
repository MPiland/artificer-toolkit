import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'

export type CharacterBuilderStepId =
  CharacterBuilderPayloadDto['resolution']['recommendedSectionId']

export const characterBuilderSteps: {
  id: CharacterBuilderStepId
  label: string
  description: string
}[] = [
  {
    id: 'BASICS',
    label: 'Basics',
    description: 'Name the character and choose how advancement is tracked.'
  },
  { id: 'RACE', label: 'Race', description: 'Choose your race and any race-specific options.' },
  {
    id: 'CLASSES',
    label: 'Classes',
    description: 'Choose class levels and class-specific options.'
  },
  {
    id: 'BACKGROUND',
    label: 'Background',
    description: 'Choose a background and any background options.'
  },
  {
    id: 'ABILITIES',
    label: 'Abilities & HP',
    description: 'Assign abilities and starting hit point intent.'
  },
  {
    id: 'EQUIPMENT',
    label: 'Equipment & Currency',
    description: 'Resolve starting equipment and manual starting inventory.'
  },
  {
    id: 'DETAILS',
    label: 'Personality & Appearance',
    description: 'Set alignment, faith, appearance, and other profile details.'
  },
  { id: 'NOTES', label: 'Notes', description: 'Track backstory, relationships, and table notes.' },
  {
    id: 'REVIEW',
    label: 'Review',
    description: 'Check concrete blockers before activating the character.'
  }
]
