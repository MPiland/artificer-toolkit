import '@mantine/core/styles/PillsInput.css'
import { Combobox, PillsInput, Pill, Input } from '@mantine/core'
import type { ReactNode } from 'react'
import type { DropdownCommonProps } from './Dropdown.types'
import { ChevronDown } from 'lucide-react'
import {
  dropdown_input,
  dropdown_label,
  dropdown_wrapper,
  dropdown_icon,
  dropdown,
} from './Dropdown.css'
import clsx from 'clsx'
import { useClickOutside } from '@mantine/hooks'

type DropdownMultipleProps = {
  value: string[]
  handleValueSelect: (optionId: string) => void
  activeLabels: (string | ReactNode)[]
  toggleDropdown: () => void
  closeDropdown: () => void
  height?: 'full' | 'auto' | 'default'
  border?: 'none' | 'default'
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
}: DropdownMultipleProps) => {
  const labels = activeLabels
    ?.slice(0, MAX_DISPLAYED_VALUES === value.length ? MAX_DISPLAYED_VALUES : MAX_DISPLAYED_VALUES - 1)
    .map((item, index) => <Pill key={`pill-${index}`}>{item}</Pill>)

  const ref = useClickOutside(() => closeDropdown())

  return (
    <Combobox.DropdownTarget ref={ref}>
      <PillsInput
        classNames={{
          wrapper: clsx(dropdown_wrapper),
          label: dropdown_label,
          input: dropdown_input,
          root: dropdown,
        }}
        label={label}
        required={required}
        pointer
        onClick={() => toggleDropdown()}
        rightSection={
          !activeLabels.length && (
            <ChevronDown
              onClick={(event) => {
                event.stopPropagation()
                toggleDropdown()
              }}
              className={dropdown_icon}
            />
          )
        }
        error={error}
      >
        <Pill.Group>
          {labels?.length ? labels : <Input.Placeholder>{placeholder}</Input.Placeholder>}
          <Combobox.EventsTarget>
            <PillsInput.Field
              type='hidden'
              onBlur={closeDropdown}
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
