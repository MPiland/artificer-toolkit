import '@mantine/core/styles/Input.css'
import { Combobox, InputBase, Input } from '@mantine/core'
import type { ReactNode, MouseEvent } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { DropdownCommonProps } from './Dropdown.types'
import {
  dropdown_input,
  dropdown_label,
  dropdown_icon,
  dropdown_wrapper,
  dropdown,
} from './Dropdown.css'
import clsx from 'clsx'
import { useClickOutside } from '@mantine/hooks'

type DropdownSingleProps = {
  value: string | null | undefined
  handleRemoveValue: () => void
  activeLabel: string | ReactNode
  toggleDropdown: () => void
  closeDropdown: () => void
  height?: 'full' | 'auto' | 'default'
  border?: 'none' | 'default'
  error?: string
} & DropdownCommonProps

const DropdownSingle = ({
  toggleDropdown,
  closeDropdown,
  activeLabel,
  placeholder,
  handleRemoveValue,
  label,
  required,
  error,
}: DropdownSingleProps) => {
  const ref = useClickOutside(() => closeDropdown())
  return (
    <Combobox.DropdownTarget ref={ref}>
      <InputBase
        classNames={{
          wrapper: clsx(dropdown_wrapper),
          label: dropdown_label,
          input: dropdown_input,
          root: dropdown,
        }}
        label={label}
        required={required}
        component='button'
        type='button'
        pointer
        rightSection={
          activeLabel !== null ?
            <X
              className={dropdown_icon}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation()
                handleRemoveValue()
              }}
              aria-label='Clear value'
            />
          : <ChevronDown className={dropdown_icon} />
        }
        rightSectionPointerEvents={activeLabel != null ? 'all' : 'none'}
        wrapperProps={{
          onClick: () => toggleDropdown(),
          onMouseDown: (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation(),
        }}
        onBlur={closeDropdown}
        error={error}
      >
        {activeLabel || <Input.Placeholder>{placeholder}</Input.Placeholder>}
      </InputBase>
    </Combobox.DropdownTarget>
  )
}
export default DropdownSingle
