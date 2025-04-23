import { useEffect, useState, useRef, useMemo, useCallback, ReactNode } from 'react'
import {
  dropdown_container,
  dropdown_input,
  dropdown_label,
  dropdown_active_option,
  dropdown_right_section,
  dropdown_wrapper,
  dropdown_menu,
  dropdown,
  dropdown_height,
  dropdown_border,
} from './Dropdown.css'
import { isEqual, uniqBy } from 'lodash'
import clsx from 'clsx'
import { DropdownOption } from './Dropdown.types'
import { TbX, TbChevronDown } from 'react-icons/tb'
import ScrollArea from '@/components/ScrollArea'
import Floating from '@/components/Floating'
import { DropdownProps } from './Dropdown.types'

const Dropdown = <T,>({
  label,
  required,
  name,
  options,
  multiSelect,
  value,
  onChange,
  placeholder,
  className,
  errorMsg = 'Must select an option',
  id,
  all = true,
  height = 'default',
  border = 'default',
  boundary = 'form',
}: DropdownProps<T>) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [error, setError] = useState<boolean>(false)
  const [settingOption, setSettingOption] = useState<boolean>(false)
  const [selectedOptions, setSelectedOptions] = useState<string[] | string | null>(null)

  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const dropdown = dropdownRef.current
    if (dropdown) {
      dropdown.addEventListener('setErrorState', (e: any) => setError(e.detail))

      return () => dropdown.removeEventListener('setErrorState', (e: any) => setError(e.detail))
    }
  }, [])

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

  const selectedLabels: string | string[] | ReactNode = useMemo(() => {
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

  const handleValueSelect = (option: DropdownOption) => {
    setSettingOption(true)
    if (multiSelect) {
      let newOptions: string[] | null = [option.id]
      if (option.id === 'clear') {
        newOptions = null
      } else if (option.id === 'all') {
        newOptions = ['all']
        const allOptions = filteredOptions.filter((opt) => opt.id !== 'all' && opt.id !== 'clear').map((opt) => opt.id)
        onChange.updateField({ path: name, value: newOptions })
        return setSelectedOptions(allOptions)
      }
      if (newOptions != null && Array.isArray(selectedOptions) && selectedOptions?.length) {
        if (selectedOptions.includes(option.id)) {
          newOptions = selectedOptions.filter((selectedOption) => selectedOption !== option.id)
        } else {
          newOptions = [...selectedOptions, ...newOptions]
        }
      }
      onChange.updateField({ path: name, value: newOptions })
      setSelectedOptions(newOptions)
    } else {
      // If it's a single select, update selectedOptionsRef.current to match selectedOptions
      setIsOpen(false)
      setSelectedOptions(option.id)
      onChange.updateField({ path: name, value: option.id })
    }
    setSettingOption(false)
  }

  const handleValueRemove = () => {
    setSettingOption(true)
    setSelectedOptions(null)
    onChange.removeField({ path: name })
    setSettingOption(false)
  }

  const labels =
    multiSelect && selectedLabels ?
      (selectedLabels as string[])?.slice(0, 1)?.map((label, index) => {
        return (
          <span className={dropdown_active_option} key={index}>
            {label}
          </span>
        )
      })
    : []

  return (
    <div className={clsx(dropdown, { [className]: className })}>
      <Floating>
        <div className={dropdown_wrapper}>
          {label && (
            <label className={clsx(dropdown_label, { ['required']: required })} htmlFor={id || name}>
              {label}
            </label>
          )}
          <Floating.Anchor
            className={clsx(
              dropdown_container,
              'dropdown',
              { ['invalid']: error },
              dropdown_height[height],
              dropdown_border[border]
            )}
            ref={dropdownRef}
            tabIndex={0}
            data-atapp-options={
              multiSelect ? activeOptions?.length && 'true'
              : (activeOptions as string[])?.length || activeOptions != null ?
                'true'
              : 'false'
            }
            id={id || name}
            aria-required={required}
          >
            <span className={clsx(dropdown_input, { ['multiselect']: multiSelect })}>
              {multiSelect && activeOptions?.length ?
                <>
                  {labels}
                  {activeOptions?.length > 1 && (
                    <span className={dropdown_active_option}>+{activeOptions?.length - 1} more</span>
                  )}
                </>
              : (selectedLabels ?? placeholder)}
            </span>
            <span className={dropdown_right_section}>
              {activeOptions && !multiSelect ?
                <TbX
                  onClick={(e) => {
                    e.stopPropagation()
                    handleValueRemove()
                  }}
                />
              : <TbChevronDown />}
            </span>
          </Floating.Anchor>
        </div>
        <Floating.Tooltip
          className={'invalid'}
          open={error}
          onOpenChange={setError}
          role='tooltip'
          boundary='app'
          showArrow={true}
        >
          {errorMsg}
        </Floating.Tooltip>
        <Floating.Menu className={dropdown_menu} boundary={boundary} open={isOpen} onOpenChange={setIsOpen}>
          <ScrollArea scrollDirection='vertical'>
            {filteredOptions.map((option: DropdownOption, optionIndex: number) => {
              const selected =
                multiSelect ?
                  (activeOptions as string[])?.some((activeOption) => activeOption === option?.id)
                : option?.id != null && activeOptions != null && activeOptions === option?.id

              return (
                <Floating.Option
                  option={{
                    id: option.id,
                    label: option.label,
                    value: String(option.value),
                    renderedLabel: option?.renderedLabel,
                  }}
                  key={optionIndex}
                  selected={selected}
                  onSelect={(option: DropdownOption) => handleValueSelect(option)}
                />
              )
            })}
          </ScrollArea>
        </Floating.Menu>
      </Floating>
    </div>
  )
}

export default Dropdown
