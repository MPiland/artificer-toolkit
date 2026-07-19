import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'
import type {
  CharacterBuilderChoiceOptionDto,
  CharacterBuilderChosenGrantChoiceViewDto
} from '@artificer-toolkit/schema/api/characters'
import type { CharacterFormValues } from '../characterBuilder.utils'

type ChosenGrantSelection = NonNullable<CharacterFormValues['intent']['chosenGrantSelections']>[number]

export function getChosenGrantSlotOptions(
  choice: CharacterBuilderChosenGrantChoiceViewDto,
  selectedTargetIds: readonly string[],
  slotIndex: number
): CharacterBuilderChoiceOptionDto[] {
  if (choice.duplicatePolicy === 'REPEATABLE') return choice.options

  const currentTargetId = selectedTargetIds[slotIndex]
  const unavailableTargetIds = new Set(
    selectedTargetIds.filter((_, selectedIndex) => selectedIndex !== slotIndex)
  )

  return choice.options.filter(
    (option) => option.id === currentTargetId || !unavailableTargetIds.has(option.id)
  )
}

export function setChosenGrantSlotValue(
  selections: CharacterFormValues['intent']['chosenGrantSelections'],
  choice: CharacterBuilderChosenGrantChoiceViewDto,
  selectedTargetIds: readonly string[],
  slotIndex: number,
  targetId: string | null
): CharacterFormValues['intent']['chosenGrantSelections'] {
  const currentSelections = selections ?? []
  const nextTargetIds = Array.from(
    { length: choice.requiredCount },
    (_, index) => selectedTargetIds[index] ?? ''
  )
  nextTargetIds[slotIndex] = targetId ?? ''
  const compactTargetIds = nextTargetIds.filter(Boolean)
  const existingSelection = currentSelections.find((selection) => isSelectionForChoice(selection, choice))

  if (compactTargetIds.length === 0) {
    const remainingSelections = currentSelections.filter((selection) => !isSelectionForChoice(selection, choice))
    return remainingSelections.length > 0 ? remainingSelections : undefined
  }

  const nextSelection: ChosenGrantSelection = {
    id: existingSelection?.id ?? crypto.randomUUID(),
    grantId: choice.grantId,
    source: choice.source,
    timing: choice.timing,
    progressionLevel: choice.progressionLevel,
    targetIds: compactTargetIds
  }

  return existingSelection
    ? currentSelections.map((selection) => isSelectionForChoice(selection, choice) ? nextSelection : selection)
    : [...currentSelections, nextSelection]
}

export function getSelectedChosenGrantTargetIds(
  selections: CharacterFormValues['intent']['chosenGrantSelections'],
  choice: CharacterBuilderChosenGrantChoiceViewDto
): string[] {
  return selections?.find((selection) => isSelectionForChoice(selection, choice))?.targetIds ?? []
}

function isSelectionForChoice(
  selection: ChosenGrantSelection,
  choice: CharacterBuilderChosenGrantChoiceViewDto
): boolean {
  return selection.grantId === choice.grantId
    && selection.progressionLevel === choice.progressionLevel
    && isSameCharacterProvenanceIdentity(selection.source, choice.source)
}
