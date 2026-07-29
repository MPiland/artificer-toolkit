import type {
  CharacterBuilderChoiceOptionDto,
  CharacterBuilderChosenGrantChoiceViewDto,
  CharacterBuilderPayloadDto
} from '@artificer-toolkit/schema/api/characters'
import type { SelectOption } from '#forms/utils/formUtils'
import { compareCharacterBuilderLabels } from '../selection/optionProjection'

export function getAllChosenGrantChoices(
  view: CharacterBuilderPayloadDto['view']
): CharacterBuilderChosenGrantChoiceViewDto[] {
  return [
    ...view.race.grantChoices,
    ...view.classes.selectedClasses.flatMap((selectedClass) => selectedClass.grantChoices),
    ...view.background.grantChoices
  ]
}

export function choiceOptions(items: CharacterBuilderChoiceOptionDto[]): SelectOption[] {
  return items
    .map((item) => ({
      value: item.id,
      label: item.disabledReason ? `${item.label} (${item.disabledReason})` : item.label,
      disabled: item.disabled
    }))
    .sort((left, right) => compareCharacterBuilderLabels(left.label, right.label))
}

export function isChoiceOptionDisabled(
  items: CharacterBuilderChoiceOptionDto[],
  value: string | null | undefined
): boolean {
  if (!value) return true

  return items.find((item) => item.id === value)?.disabled === true
}
