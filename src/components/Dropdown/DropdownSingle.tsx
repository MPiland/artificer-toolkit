import '@mantine/core/styles/Input.css'
import { Combobox, InputBase, Input } from '@mantine/core'
import type { ReactNode, MouseEvent, FocusEvent } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { DropdownCommonProps } from './Dropdown.types'
import { input, label as input_label, icon, wrapper, base } from './Dropdown.css'
import clsx from 'clsx'

type DropdownSingleProps = {
  value: string | null | undefined
  handleRemoveValue: () => void
  activeLabel: { id: string; label: string | ReactNode }
  toggleDropdown: () => void
  error?: string
} & DropdownCommonProps

const DropdownSingle = ({
  toggleDropdown,
  activeLabel,
  placeholder,
  handleRemoveValue,
  label,
  required,
  error,
  onBlur,
}: DropdownSingleProps) => {
  return (
    <Combobox.DropdownTarget>
      <InputBase
        classNames={{
          wrapper: clsx(wrapper),
          label: input_label,
          input: input,
          root: base,
        }}
        label={label}
        required={required}
        component='button'
        type='button'
        pointer
        rightSection={
          activeLabel === null || (Array.isArray(activeLabel) && !activeLabel?.length) ?
            <ChevronDown className={icon} />
          : <X
              className={icon}
              onClick={(event) => {
                event.stopPropagation()
                handleRemoveValue()
              }}
              aria-label='Clear value'
            />
        }
        rightSectionPointerEvents={activeLabel != null ? 'all' : 'none'}
        wrapperProps={{
          onClick: () => toggleDropdown(),
          onMouseDown: (event: MouseEvent<HTMLDivElement>) => event.stopPropagation(),
        }}
        onBlur={onBlur as ((arg: FocusEvent<HTMLButtonElement>) => void) | undefined}
        error={error}
      >
        {activeLabel.label || <Input.Placeholder>{placeholder}</Input.Placeholder>}
      </InputBase>
    </Combobox.DropdownTarget>
  )
}
export default DropdownSingle
