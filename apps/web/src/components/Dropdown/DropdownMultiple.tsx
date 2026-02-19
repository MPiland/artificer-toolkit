import '@mantine/core/styles/PillsInput.css'
import { Combobox, PillsInput, Pill, Input } from '@mantine/core'
import type { ReactNode } from 'react'
import type { DropdownCommonProps } from './Dropdown.types'
import { ChevronDown } from 'lucide-react'
import { input, label as input_label, wrapper, icon, base } from './Dropdown.css'
import clsx from 'clsx'

type DropdownMultipleProps = {
  value: string[]
  handleValueSelect: (optionId: string) => void
  activeLabels: { id: string, label: string | ReactNode }[]
  toggleDropdown: () => void
  closeDropdown: () => void
  error?: string
} & DropdownCommonProps

const MAX_DISPLAYED_VALUES = 2

const DropdownMultiple = ({
  value,
  placeholder,
  handleValueSelect,
  activeLabels,
  label,
  required,
  toggleDropdown,
  closeDropdown,
  error,
  onBlur
}: DropdownMultipleProps) => {
  const labels
    = activeLabels?.length
      ? activeLabels
          ?.slice(0, MAX_DISPLAYED_VALUES === value.length ? MAX_DISPLAYED_VALUES : MAX_DISPLAYED_VALUES - 1)
          .map((item) => (
            <Pill key={`pill-${item.id}`} withRemoveButton onRemove={() => handleValueSelect(item.id)}>
              {item.label}
            </Pill>
          ))
      : []

  return (
    <Combobox.DropdownTarget>
      <PillsInput
        classNames={{
          wrapper: clsx(wrapper),
          label: input_label,
          input: input,
          root: base
        }}
        label={label}
        required={required}
        pointer
        onClick={toggleDropdown}
        onBlur={onBlur}
        rightSection={<ChevronDown className={icon} />}
        rightSectionPointerEvents='none'
        error={error}
      >
        <Pill.Group>
          {labels?.length
            ? (
                <>
                  {labels}
                  {activeLabels.length > MAX_DISPLAYED_VALUES && (
                    <Pill>
                      +
                      {activeLabels.length - (MAX_DISPLAYED_VALUES - 1)}
                      {' '}
                      more
                    </Pill>
                  )}
                </>
              )
            : <Input.Placeholder>{placeholder}</Input.Placeholder>}
          <Combobox.EventsTarget>
            <PillsInput.Field
              type='hidden'
              onBlur={() => closeDropdown()}
              onKeyDown={(event) => {
                if (event.key === 'Backspace') {
                  event.preventDefault()
                  handleValueSelect(value[value.length - 1])
                }
              }}
            />
          </Combobox.EventsTarget>
        </Pill.Group>
      </PillsInput>
    </Combobox.DropdownTarget>
  )
}
export default DropdownMultiple
