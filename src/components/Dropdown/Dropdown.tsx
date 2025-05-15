import '@mantine/core/styles/Popover.layer.css'
import '@mantine/core/styles/Combobox.layer.css'
import { useEffect, useState, useRef, useMemo, useCallback, ReactNode } from 'react'
import { dropdown_option, dropdown_active_icon } from './Dropdown.css'
import { isEqual, uniqBy } from 'lodash'
import { DropdownOption, DropdownProps } from './Dropdown.types'
import { Combobox, useCombobox } from '@mantine/core'
import DropdownMultiple from './DropdownMultiple'
import DropdownSingle from './DropdownSingle'
import { Check } from 'lucide-react'
import { useClickOutside } from '@mantine/hooks'
import { ScrollArea } from '@mantine/core'

const Dropdown = <T,>({
  label,
  required,
  name,
  options,
  multiSelect,
  value,
  onChange,
  placeholder,
  all = true,
  height = 'default',
  border = 'default',
  disableRemove = false,
  errorMsg,
}: DropdownProps<T>) => {
  const [error, setError] = useState<string>()
  const [settingOption, setSettingOption] = useState<boolean>(false)
  const [selectedOptions, setSelectedOptions] = useState<string[] | string | null>(null)

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex('active'),
  })
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const ref = useClickOutside(() => combobox.closeDropdown())

  useEffect(() => {
    const dropdown = dropdownRef.current
    if (dropdown) {
      dropdown.addEventListener('setErrorState', () => setError(errorMsg || 'Please make a selection'))

      return () => dropdown.removeEventListener('setErrorState', () => setError(errorMsg || 'Please make a selection'))
    }
  }, [errorMsg])

  const filteredArray = useCallback(() => {
    if (!options) return []

    let optionArray: DropdownOption[] = Array.isArray(options) ? [...options] : []
    if (options?.length) {
      optionArray = optionArray?.filter((option) => option?.label != null)
      optionArray = uniqBy(optionArray, (option) => option.value)

      if (optionArray.length) {
        optionArray = uniqBy(optionArray, (obj) => obj?.id)
        optionArray.sort((a, b) => {
          // Helper function to extract leading digits from a string
          const extractLeadingDigits = (str: string) => {
            const match = str.match(/^\d+/)
            return match ? parseInt(match[0], 10) : null
          }

          // Function to get the comparable value (number or leading digits from string)
          const getComparableValue = (val: string | number | null | undefined) => {
            if (typeof val === 'number') {
              return val
            }
            if (typeof val === 'string') {
              const leadingDigits = extractLeadingDigits(val)
              return leadingDigits !== null ? leadingDigits : val
            }
            return val
          }

          // Get comparable values for a and b
          const aValue = getComparableValue(a.value)
          const bValue = getComparableValue(b.value)

          // Compare the values
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return aValue - bValue
          } else if (typeof aValue === 'number') {
            return -1 // numbers come before strings
          } else if (typeof bValue === 'number') {
            return 1 // strings come after numbers
          } else if (typeof aValue === 'string' && typeof bValue === 'string') {
            return aValue.localeCompare(bValue)
          }

          return 0
        })

        if (multiSelect && all === true) {
          optionArray.unshift(
            { value: 'all', label: 'All', id: 'all' },
            { value: 'clear', label: 'Clear', id: 'clear' }
          )
        }
      }
    }
    return optionArray
  }, [options, multiSelect, all])

  const filteredOptions = useMemo(() => filteredArray(), [filteredArray])

  useEffect(() => {
    if (options?.length && filteredOptions?.length) {
      if (value && !isEqual(value, selectedOptions) && (value != null || selectedOptions != null) && !settingOption) {
        setSelectedOptions(value)
      }
    }
  }, [filteredOptions?.length, options?.length, settingOption, value, selectedOptions])

  const activeOptions = useMemo(() => {
    if (!selectedOptions) return null

    if (Array.isArray(selectedOptions) && selectedOptions.includes('all')) {
      return filteredOptions.filter((option) => option.id !== 'all' && option.id !== 'clear').map((option) => option.id)
    }
    return selectedOptions
  }, [filteredOptions, selectedOptions])

  const activeLabels: string | string[] | ReactNode | ReactNode[] = useMemo(() => {
    if (!activeOptions || !filteredOptions?.length) return null
    if (Array.isArray(activeOptions)) {
      return activeOptions.map((id) => {
        const option = filteredOptions.find((opt) => opt.id === id)
        if (option?.renderedLabel) {
          return option?.renderedLabel
        }
        return option?.label
      })
    }
    return filteredOptions.find((opt) => opt.id === activeOptions)?.label
  }, [activeOptions, filteredOptions])

  const handleValueSelect = (optionId: string) => {
    console.log({ optionId })
    setSettingOption(true)
    if (multiSelect) {
      let newOptions: string[] | null = [optionId]
      if (optionId === 'clear') {
        newOptions = null
      } else if (optionId === 'all') {
        newOptions = ['all']
        const allOptions = filteredOptions.filter((opt) => opt.id !== 'all' && opt.id !== 'clear').map((opt) => opt.id)
        onChange.updateField({ path: name, value: newOptions })
        return setSelectedOptions(allOptions)
      }
      if (newOptions != null && Array.isArray(selectedOptions) && selectedOptions?.length) {
        if (selectedOptions.includes(optionId)) {
          newOptions = selectedOptions.filter((selectedOption) => selectedOption !== optionId)
        } else {
          newOptions = [...selectedOptions, ...newOptions]
        }
      }
      onChange.updateField({ path: name, value: newOptions })
      setSelectedOptions(newOptions)
    } else {
      // If it's a single select, update selectedOptionsRef.current to match selectedOptions
      setSelectedOptions(optionId)
      onChange.updateField({ path: name, value: optionId })
    }
    setSettingOption(false)
  }

  const handleValueRemove = () => {
    if (disableRemove) return
    setSettingOption(true)
    setSelectedOptions(null)
    onChange.removeField({ path: name })
    setSettingOption(false)
  }

  const comboOptions = filteredOptions.map((option, index) => (
    <Combobox.Option
      key={option.id}
      value={option.id}
      active={multiSelect ? value?.includes(option.id) : value === option.id}
      className={dropdown_option}
      onMouseOver={() => combobox.selectOption(index)}
    >
      {multiSelect ? value?.includes(option.id) : value === option.id && <Check className={dropdown_active_icon} />}
      {option.label}
    </Combobox.Option>
  ))

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={handleValueSelect}
      position='bottom-start'
      portalProps={{ target: '#app-shell' }}
      width='target'
      offset={8}
    >
      {multiSelect ?
        <DropdownMultiple
          value={(value as string[]) || []}
          placeholder={placeholder}
          handleValueSelect={handleValueSelect}
          activeLabels={(activeLabels as (string | ReactNode)[]) || []}
          label={label}
          required={required}
          toggleDropdown={() => combobox.toggleDropdown()}
          closeDropdown={() => combobox.closeDropdown()}
          height={height}
          border={border}
          error={error}
        />
      : <DropdownSingle
          value={value as string}
          placeholder={placeholder}
          handleRemoveValue={handleValueRemove}
          activeLabel={activeLabels as string | ReactNode}
          label={label}
          required={required}
          toggleDropdown={() => combobox.toggleDropdown()}
          closeDropdown={() => combobox.closeDropdown()}
          height={height}
          border={border}
          error={error}
        />
      }

      <Combobox.Dropdown ref={ref}>
        <Combobox.Options>
          <ScrollArea.Autosize mah={136} type='always'>
            {comboOptions.length ? comboOptions : <Combobox.Empty>No options</Combobox.Empty>}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}

export default Dropdown
