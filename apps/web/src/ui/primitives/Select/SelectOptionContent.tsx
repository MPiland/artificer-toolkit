import { CheckIcon, Tooltip, type ComboboxItem } from '@mantine/core'
import { getOptionDescription } from './selectOptions'
import * as selectStyles from './Select.css.ts'

export function SelectOptionContent({
  option,
  checked
}: {
  option: ComboboxItem
  checked?: boolean
}) {
  const description = getOptionDescription(option)
  const content = (
    <span className={selectStyles.optionContent}>
      <span>{option.label}</span>
      {checked ? <CheckIcon className={selectStyles.optionCheck} size={12} /> : null}
    </span>
  )

  return description ? (
    <Tooltip label={description} multiline position='right' w={260} withArrow>
      {content}
    </Tooltip>
  ) : (
    content
  )
}
