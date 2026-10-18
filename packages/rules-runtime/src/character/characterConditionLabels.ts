import type { VocabularyDto } from '@artificer-toolkit/schema/vocabulary/vocabulary'

/**
 * A Character's conditions with their System labels. A condition type the System does not define is
 * a dangling reference and fails loudly rather than being shown as an unknown condition.
 */
export function labelCharacterConditions(
  conditions: readonly { conditionTypeId: string; notes?: string }[],
  conditionTypes: readonly Pick<VocabularyDto, 'id' | 'label' | 'description'>[]
) {
  return conditions.map((condition) => {
    const definition = conditionTypes.find((entry) => entry.id === condition.conditionTypeId)
    if (!definition)
      throw new Error(`Condition type "${condition.conditionTypeId}" is not defined by the System.`)
    return {
      conditionTypeId: condition.conditionTypeId,
      label: definition.label,
      ...(definition.description ? { description: definition.description } : {}),
      ...(condition.notes ? { notes: condition.notes } : {})
    }
  })
}
