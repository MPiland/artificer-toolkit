import { type Dnd5eOptionalCombatReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/optionalCombat'
import {
  systemAuthoredDtoSchema,
  type SystemAuthoredDto
} from '@artificer-toolkit/schema/vocabulary/system'

export class OptionalCombatCheckDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OptionalCombatCheckDefinitionError'
  }
}

/** Extracts only the UUID-backed check references supported by the selected rules. */
export function optionalCombatCheckDefinitionIds(
  document: Dnd5eOptionalCombatReusableDefinitionDocumentDto
): readonly string[] {
  switch (document.parameters.kind) {
    case 'DISARM':
      return document.parameters.defenderCheckDefinitionIds
    case 'OVERRUN':
    case 'TUMBLE':
      return [
        document.parameters.initiatorCheckDefinitionId,
        document.parameters.targetCheckDefinitionId
      ]
    case 'CLIMB_ONTO_LARGER_CREATURE':
      return [
        ...document.parameters.initiatorCheckDefinitionIds,
        document.parameters.targetCheckDefinitionId
      ]
    default:
      return []
  }
}

function requireCheckVocabulary(document: unknown): SystemAuthoredDto {
  const parsed = systemAuthoredDtoSchema.safeParse(document)
  if (!parsed.success) {
    throw new OptionalCombatCheckDefinitionError(
      'Optional combat check definitions require a current typed System vocabulary.'
    )
  }
  return parsed.data
}

/**
 * Resolves UUID references only against the exact System vocabulary snapshot.
 * Labels, codes, and tooltips never participate in mechanics selection.
 */
export function validateOptionalCombatCheckDefinitions(input: {
  document: Dnd5eOptionalCombatReusableDefinitionDocumentDto
  systemVocabulary: unknown
}): void {
  const references = optionalCombatCheckDefinitionIds(input.document)
  if (references.length === 0) return

  const vocabulary = requireCheckVocabulary(input.systemVocabulary)
  if (vocabulary.id !== input.document.gameSystemId) {
    throw new OptionalCombatCheckDefinitionError(
      'Optional combat check definitions must use the same Game System vocabulary.'
    )
  }
  const checkIds = new Set(vocabulary.skills.map((skill) => skill.id))
  for (const definitionId of references) {
    if (!checkIds.has(definitionId)) {
      throw new OptionalCombatCheckDefinitionError(
        'Optional combat check definition is unavailable in the current Game System vocabulary.'
      )
    }
  }
}
