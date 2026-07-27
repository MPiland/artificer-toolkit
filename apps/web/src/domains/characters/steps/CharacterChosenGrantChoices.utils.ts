import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'
import type {
  CharacterBuilderChoiceOptionDto,
  CharacterBuilderChosenGrantChoiceViewDto
} from '@artificer-toolkit/schema/api/characters'
import type { CharacterFormValues } from '../characterBuilder.utils'

type ChosenGrantSelection = NonNullable<
  CharacterFormValues['intent']['chosenGrantSelections']
>[number]
type ProficiencyLevel = NonNullable<CharacterBuilderChosenGrantChoiceViewDto['proficiencyLevel']>

type ProficiencyLevels = {
  half: boolean
  full: boolean
  double: boolean
}

export function applyLocalProficiencyEligibility(
  choice: CharacterBuilderChosenGrantChoiceViewDto,
  allChoices: CharacterBuilderChosenGrantChoiceViewDto[],
  selections: CharacterFormValues['intent']['chosenGrantSelections']
): CharacterBuilderChosenGrantChoiceViewDto {
  if (!choice.proficiencyKind || !choice.proficiencyLevel) return choice
  const proficiencyLevel = choice.proficiencyLevel

  const levelsByTargetId = new Map<string, ProficiencyLevels>()
  for (const otherChoice of allChoices) {
    if (
      otherChoice.id === choice.id ||
      otherChoice.proficiencyKind !== choice.proficiencyKind ||
      !otherChoice.proficiencyLevel
    )
      continue

    for (const targetId of getSelectedChosenGrantTargetIds(selections, otherChoice)) {
      addProficiencyLevel(levelsByTargetId, targetId, otherChoice.proficiencyLevel)
    }
  }

  return {
    ...choice,
    options: choice.options.map((option) => {
      if (option.disabled) return option
      const reason = getProficiencyDisabledReason(proficiencyLevel, levelsByTargetId.get(option.id))

      return reason ? { ...option, disabled: true, disabledReason: reason } : option
    })
  }
}

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
  const nextTargetIds = Array.from(
    { length: choice.requiredCount },
    (_, index) => selectedTargetIds[index] ?? ''
  )
  nextTargetIds[slotIndex] = targetId ?? ''
  return setChosenGrantTargetIds(selections, choice, nextTargetIds.filter(Boolean))
}

export function setChosenGrantTargetIds(
  selections: CharacterFormValues['intent']['chosenGrantSelections'],
  choice: CharacterBuilderChosenGrantChoiceViewDto,
  targetIds: readonly string[]
): CharacterFormValues['intent']['chosenGrantSelections'] {
  const currentSelections = selections ?? []
  const compactTargetIds = targetIds.filter(Boolean).slice(0, choice.requiredCount)
  const existingSelection = currentSelections.find((selection) =>
    isSelectionForChoice(selection, choice)
  )

  if (compactTargetIds.length === 0) {
    const remainingSelections = currentSelections.filter(
      (selection) => !isSelectionForChoice(selection, choice)
    )
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
    ? currentSelections.map((selection) =>
        isSelectionForChoice(selection, choice) ? nextSelection : selection
      )
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
  return (
    selection.grantId === choice.grantId &&
    selection.progressionLevel === choice.progressionLevel &&
    isSameCharacterProvenanceIdentity(selection.source, choice.source)
  )
}

function addProficiencyLevel(
  levelsByTargetId: Map<string, ProficiencyLevels>,
  targetId: string,
  level: ProficiencyLevel
) {
  const levels = levelsByTargetId.get(targetId) ?? { half: false, full: false, double: false }
  if (level === 'HALF') levels.half = true
  if (level === 'FULL') levels.full = true
  if (level === 'DOUBLE') levels.double = true
  levelsByTargetId.set(targetId, levels)
}

function getProficiencyDisabledReason(
  level: ProficiencyLevel,
  existing: ProficiencyLevels | undefined
): string | undefined {
  if (level === 'HALF' && (existing?.half || existing?.full)) {
    return 'Already has at least half proficiency.'
  }
  if (level === 'FULL' && existing?.full) return 'Already has full proficiency.'
  if (level === 'DOUBLE' && !existing?.full) return 'Requires full proficiency first.'
  if (level === 'DOUBLE' && existing?.double) return 'Already has expertise.'

  return undefined
}
