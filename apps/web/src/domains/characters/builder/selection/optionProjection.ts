import type { SelectOption } from '#forms/utils/formUtils'

export function selectOptions(items: { id: string; label: string }[]): SelectOption[] {
  return items
    .map((item) => ({
      value: item.id,
      label: item.label
    }))
    .sort((left, right) => compareCharacterBuilderLabels(left.label, right.label))
}

const characterBuilderLabelCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
})

export function compareCharacterBuilderLabels(left: string, right: string): number {
  return characterBuilderLabelCollator.compare(left, right)
}
