import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'

export type CharacterBuilderStepId =
  | 'BASICS'
  | 'RACE'
  | 'CLASSES'
  | 'BACKGROUND'
  | 'DETAILS'
  | 'NOTES'
  | 'ABILITIES'
  | 'EQUIPMENT'
  | 'REVIEW'

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

type CharacterBuilderIssue = CharacterBuilderPayloadDto['resolution']['outstandingChoices'][number]
type CharacterBuilderValidation = CharacterBuilderPayloadDto['resolution']['validations'][number]

export function getCharacterBuilderIssueStepId(
  issue: CharacterBuilderIssue
): CharacterBuilderStepId {
  return issueStepByCode[issue.code] ?? getCharacterBuilderSourceStepId(issue.source) ?? 'REVIEW'
}

export function getCharacterBuilderValidationStepId(
  validation: CharacterBuilderValidation
): CharacterBuilderStepId {
  return (
    validationStepByCode[validation.code] ??
    getCharacterBuilderSourceStepId(validation.source) ??
    'REVIEW'
  )
}

const issueStepByCode: Partial<Record<string, CharacterBuilderStepId>> = {
  ANCESTRY_SELECTION_REQUIRED: 'RACE',
  BACKGROUND_STARTING_EQUIPMENT_REQUIRED: 'EQUIPMENT',
  CLASS_STARTING_EQUIPMENT_REQUIRED: 'EQUIPMENT',
  SPECIALIZATION_REQUIRED: 'CLASSES',
  SPELL_SELECTION_INCOMPLETE: 'CLASSES',
  SPELL_SELECTION_INVALID: 'CLASSES',
  SPELL_SELECTION_OVER_LIMIT: 'CLASSES',
  SPELL_SELECTION_REQUIRED: 'CLASSES',
  SUBCLASS_SELECTION_REQUIRED: 'CLASSES'
}

const validationStepByCode: Partial<Record<string, CharacterBuilderStepId>> = {
  ANCESTRY_OPTION_NOT_FOUND: 'RACE',
  ANCESTRY_SOURCE_MISMATCH: 'RACE',
  BACKGROUND_NOT_FOUND: 'BACKGROUND',
  BACKGROUND_STARTING_EQUIPMENT_UNAVAILABLE: 'EQUIPMENT',
  CLASS_NOT_FOUND: 'CLASSES',
  CLASS_STARTING_EQUIPMENT_UNAVAILABLE: 'EQUIPMENT',
  DUPLICATE_SPELL_SELECTION: 'CLASSES',
  EXPERTISE_REQUIRES_PROFICIENCY: 'CLASSES',
  INVALID_HITPOINT_PROGRESSION: 'ABILITIES',
  INVALID_MANUAL_HITPOINT_ROLL: 'ABILITIES',
  MALFORMED_ABILITY_ASSIGNMENTS: 'ABILITIES',
  MISSING_MANUAL_HITPOINT_ROLL: 'ABILITIES',
  MULTICLASS_PREREQUISITE_UNMET: 'CLASSES',
  POINT_BUY_OVERSPEND: 'ABILITIES',
  RACE_NOT_FOUND: 'RACE',
  REDUNDANT_PROFICIENCY_SELECTION: 'CLASSES',
  SPELL_SELECTION_INVALID: 'CLASSES',
  STALE_ANCESTRY_SELECTION: 'RACE',
  STALE_RESOURCE_GRANT: 'CLASSES',
  STALE_SPELL_SELECTION: 'CLASSES',
  STANDARD_ARRAY_SCORE_REUSE: 'ABILITIES',
  SUBCLASS_NOT_FOUND: 'CLASSES',
  SUBCLASS_PARENT_MISMATCH: 'CLASSES',
  SUBCLASS_SELECTION_UNAVAILABLE: 'CLASSES',
  SUBRACE_NOT_FOUND: 'RACE',
  SUBRACE_PARENT_MISMATCH: 'RACE'
}

function getCharacterBuilderSourceStepId(
  source: CharacterBuilderIssue['source']
): CharacterBuilderStepId | undefined {
  if (!source) return undefined

  switch (source.kind) {
    case 'RACE':
    case 'SUBRACE':
    case 'ANCESTRY':
      return 'RACE'
    case 'CLASS':
    case 'SUBCLASS':
      return 'CLASSES'
    case 'BACKGROUND':
      return 'BACKGROUND'
    default:
      return undefined
  }
}
