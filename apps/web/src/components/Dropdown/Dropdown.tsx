import { useEffect, useState, useMemo, useCallback, ReactNode } from 'react'
import { combobox_option, active_icon } from './Dropdown.css'
import { isEqual, uniqBy } from 'lodash-es'
import { DropdownOption, DropdownProps } from './Dropdown.types'
import { Combobox, Group, useCombobox } from '@mantine/core'
import DropdownMultiple from './DropdownMultiple'
import DropdownSingle from './DropdownSingle'
import { Check } from 'lucide-react'
import { ScrollArea } from '@mantine/core'

// TODO: Update to use the ALL code as a custom function instead.

const Dropdown = ({
  label,
  required,
  options,
  multiselect,
  value,
  onChange,
  placeholder,
  all = true,
  disableRemove = false,
  error,
  onBlur
}: DropdownProps) => {
  const [settingOption, setSettingOption] = useState<boolean>(false)
  const [selectedOptions, setSelectedOptions] = useState<string[] | string | null | undefined>(null)

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex('active')
  })

  const filteredArray = useCallback(() => {
    if (!options) return []

    let optionArray: DropdownOption[] = Array.isArray(options) ? [...options] : []
    if (options?.length) {
      optionArray = optionArray?.filter((option) => option?.label != null)
      optionArray = uniqBy(optionArray, (option) => option.label)

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
          const aValue = getComparableValue(a.label)
          const bValue = getComparableValue(b.label)

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

        if (multiselect && all === true) {
          optionArray.unshift({ label: 'All', id: 'all' }, { label: 'Clear', id: 'clear' })
        }
      }
    }
    return optionArray
  }, [options, multiselect, all])

  const filteredOptions = useMemo(() => filteredArray(), [filteredArray])

  useEffect(() => {
    if (options?.length && filteredOptions?.length) {
      if (!isEqual(value, selectedOptions) && !settingOption) {
        setSelectedOptions(value)
      }
    }
  }, [
    value, selectedOptions, settingOption, options?.length, filteredOptions?.length
  ])

  const activeOptions = useMemo(() => {
    if (!selectedOptions) return null

    if (Array.isArray(selectedOptions) && selectedOptions.includes('all')) {
      return filteredOptions.filter((option) => option.id !== 'all' && option.id !== 'clear').map((option) => option.id)
    }
    return selectedOptions
  }, [filteredOptions, selectedOptions])

  const activeLabels: { id: string, label: string | ReactNode } | { id: string, label: string | ReactNode }[]
    = useMemo(() => {
      if (!activeOptions || !filteredOptions?.length) return []
      if (Array.isArray(activeOptions)) {
        return activeOptions.map((id) => {
          const option = filteredOptions.find((opt) => opt.id === id)
          if (option?.renderedLabel) {
            return { id, label: option?.renderedLabel }
          }
          return { id: id || '', label: option?.label || '' }
        })
      }
      const option = filteredOptions.find((opt) => activeOptions.includes(opt.id))
      if (option?.renderedLabel) {
        return { id: option.id, label: option.renderedLabel }
      }
      return { id: option?.id || '', label: option?.label || '' }
    }, [activeOptions, filteredOptions])

  const handleValueSelect = (optionId: string) => {
    setSettingOption(true)
    if (multiselect) {
      let newOptions: string[] | null = [optionId]
      if (optionId === 'clear') {
        newOptions = null
      } else if (optionId === 'all') {
        newOptions = ['all']
        const allOptions = filteredOptions.filter((opt) => opt.id !== 'all' && opt.id !== 'clear').map((opt) => opt.id)
        onChange(newOptions)
        return setSelectedOptions(allOptions)
      }
      if (newOptions != null && Array.isArray(selectedOptions) && selectedOptions?.length) {
        if (selectedOptions.includes('all')) {
          newOptions = filteredOptions
            .filter((opt) => opt.id !== 'all' && opt.id !== 'clear' && opt.id !== optionId)
            .map((opt) => opt.id)
        } else if (selectedOptions.includes(optionId)) {
          newOptions = selectedOptions.filter((selectedOption) => selectedOption !== optionId)
        } else {
          newOptions = [...selectedOptions, ...newOptions]
        }
      }
      onChange(newOptions)
      setSelectedOptions(newOptions)
    } else {
      // If it's a single select, update selectedOptionsRef.current to match selectedOptions
      setSelectedOptions(optionId)
      onChange(optionId)
    }
    setSettingOption(false)
  }

  const handleValueRemove = () => {
    if (disableRemove) return
    setSettingOption(true)
    setSelectedOptions(null)
    onChange(null)
    setSettingOption(false)
  }

  const comboOptions = filteredOptions.map((option, index) => {
    return (
      <Combobox.Option
        key={option.id}
        value={option.id}
        active={multiselect ? value?.includes(option.id) : value === option.id}
        className={combobox_option}
        onMouseOver={() => combobox.selectOption(index)}
      >
        <Group justify='space-between'>
          {option.label}
          {(multiselect ? value?.includes(option.id) : value === option.id) && <Check className={active_icon} />}
        </Group>
      </Combobox.Option>
    )
  })

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={handleValueSelect}
      position='bottom-start'
      portalProps={{ target: '#app-shell' }}
      width='target'
      offset={8}
    >
      {multiselect
        ? (
            <DropdownMultiple
              value={(value as string[]) || []}
              placeholder={placeholder}
              handleValueSelect={handleValueSelect}
              activeLabels={(activeLabels as { id: string, label: string | ReactNode }[]) || []}
              label={label}
              required={required}
              toggleDropdown={combobox.toggleDropdown}
              closeDropdown={combobox.closeDropdown}
              error={error}
              onBlur={onBlur}
            />
          )
        : (
            <DropdownSingle
              value={value as string}
              placeholder={placeholder}
              handleRemoveValue={handleValueRemove}
              activeLabel={activeLabels as { id: string, label: string | ReactNode }}
              label={label}
              required={required}
              toggleDropdown={combobox.toggleDropdown}
              error={error}
              onBlur={onBlur}
            />
          )}

      <Combobox.Dropdown>
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
