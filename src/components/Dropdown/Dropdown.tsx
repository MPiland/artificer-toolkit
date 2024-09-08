import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  dropdown_container,
  dropdown_input,
  dropdown_label,
  dropdown_active_option,
  dropdown_right_section,
  dropdown_wrapper,
  dropdown_menu,
  dropdown_option,
  dropdown,
  dropdown_option_right_side,
  dropdown_height,
  dropdown_border,
} from './Dropdown.css'
import { get, isEqual, uniqBy } from 'lodash'
import clsx from 'clsx'
import { DropdownOptionType, FilterType, ReducerActionType } from '../../utils/types'
import { TbX, TbChevronDown, TbCheck } from 'react-icons/tb'
import {
  autoUpdate,
  offset,
  useFloating,
  FloatingPortal,
  useInteractions,
  useClick,
  useListNavigation,
  useTypeahead,
  useDismiss,
  FloatingFocusManager,
  flip,
} from '@floating-ui/react'
import ScrollArea from '../ScrollArea/ScrollArea'
import Tooltip from '../Tooltip/Tooltip'

interface DropdownProps {
  label?: string | boolean
  name: string
  required?: boolean
  value: DropdownOptionType[] | DropdownOptionType | null
  className?: string | number | symbol | any
  placeholder?: string
  options: DropdownOptionType[]
  multiSelect?: boolean
  onChange: (arg: ReducerActionType) => void
  errorMsg?: string
  id?: string
  filter?: FilterType[]
  all?: boolean
  height?: 'full' | 'auto' | 'default'
  border?: 'none' | 'default'
}

const Dropdown = ({
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
  filter,
  all = true,
  height = 'default',
  border = 'default',
}: DropdownProps) => {
  const [selectedOptions, setSelectedOptions] = useState<DropdownOptionType[] | DropdownOptionType | null>(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [error, setError] = useState<boolean>(false)
  const [settingOption, setSettingOption] = useState<boolean>(false)

  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const selectedOptionsRef = useRef<DropdownOptionType[] | DropdownOptionType | null>(null)

  useEffect(() => {
    const dropdown = dropdownRef.current
    if (dropdown) {
      dropdown.addEventListener('setErrorState', (e: any) => setError(e.detail))

      return () => dropdown.removeEventListener('setErrorState', (e: any) => setError(e.detail))
    }
  }, [])

  const appMain = document.getElementById('app-content')
  const formContent = document.getElementById('form-content')

  const { refs, floatingStyles, context } = useFloating({
    placement: 'bottom-start',
    open: isOpen,
    onOpenChange(isOpen) {
      setIsOpen(isOpen)
      setError(false)
    },
    whileElementsMounted: autoUpdate,
    middleware: [offset(10), flip()],
  })

  const click = useClick(context)

  const dismiss = useDismiss(context)

  const listItemsRef = useRef<Array<HTMLDivElement | null>>([])
  const listContentRef = useRef<Array<string | null>>([])

  const typeahead = useTypeahead(context, {
    listRef: listContentRef,
    activeIndex,
    onMatch: setActiveIndex,
  })

  const listNavigation = useListNavigation(context, {
    listRef: listItemsRef,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
  })

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    listNavigation,
    typeahead,
    dismiss,
  ])

  const filteredArray = useCallback(() => {
    let optionArray: DropdownOptionType[] = [...(options ?? [])]
    if (options?.length > 0) {
      optionArray = optionArray?.filter((option) => option?.value != null)
      optionArray = uniqBy(optionArray, (obj) => obj.name)
      if (filter && filter?.length > 0) {
        filter?.map((filterObject) => {
          if (filterObject.object != null) {
            const filterValue = get(filterObject.object, `${filterObject.key}`)
            if (filterValue != undefined) {
              if (Array.isArray(filterValue)) {
                optionArray = optionArray?.filter((option: any) => {
                  const optionValue = get(option, `${filterObject.matchingKey ?? filterObject.key}`)
                  if (Array.isArray(optionValue) && optionValue?.length > 0) {
                    return optionValue.some((key: any) =>
                      filterValue.some((value: any) => {
                        const matchValue = value._id == null ? value.name : value._id
                        if (filterObject.type === 'equal') {
                          return key._id === matchValue
                        } else {
                          return key._id !== matchValue
                        }
                      })
                    )
                  } else {
                    return filterValue.some((value: any) => {
                      const matchValue = value._id == null ? value.name : value._id
                      if (filterObject.type === 'equal') {
                        return String(optionValue) === String(matchValue)
                      } else {
                        return String(optionValue) !== String(matchValue)
                      }
                    })
                  }
                })
              } else if (typeof filterValue === 'object') {
                const matchValue = filterValue._id == null ? filterValue.name : filterValue._id

                optionArray = optionArray?.filter((option: any) => {
                  const optionValue = get(option, `${filterObject.matchingKey ?? filterObject.key}`)
                  if (optionValue) {
                    if (filterObject.type === 'equal') {
                      return String(optionValue) === String(matchValue)
                    } else {
                      return String(optionValue) !== String(matchValue)
                    }
                  }
                })
              } else {
                optionArray = optionArray?.filter((option: any) => {
                  const optionValue = get(option, `${filterObject.matchingKey ?? filterObject.key}`)
                  if (optionValue) {
                    if (filterObject.type === 'equal') {
                      return String(optionValue) === String(filterValue)
                    } else {
                      return String(optionValue) !== String(filterValue)
                    }
                  }
                })
              }
            }
          }
          if (filterObject.value != undefined) {
            optionArray = optionArray.filter((option) => {
              const optionValue = get(option, `${filterObject.matchingKey ?? filterObject.key}`)
              if (filterObject.type === 'equal') {
                return optionValue === filterObject.value
              } else {
                return optionValue !== filterObject.value
              }
            })
          }
          if (filterObject.mapKey) {
            optionArray = optionArray.flatMap((item: any) => {
              const value = get(item, `${filterObject.mapKey}`)
              if (value) {
                return value
              }
            })
          }
        })
      }
      if (optionArray.length > 0) {
        optionArray = uniqBy(optionArray, (obj) => obj?.name)
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
          optionArray.unshift({ name: 'all', value: 'All', _id: null }, { name: 'clear', value: 'Clear', _id: null })
        }
      }
    }
    return optionArray
  }, [filter, multiSelect, options, all])

  const filteredOptions = useMemo(() => filteredArray(), [filteredArray])

  useEffect(() => {
    if (options?.length > 0 && filteredOptions?.length > 0) {
      if (!isEqual(value, selectedOptionsRef.current) && !settingOption) {
        selectedOptionsRef.current = value
      }

      if (value == null && selectedOptionsRef.current == null && selectedOptions != null && !settingOption) {
        setSelectedOptions(null)
      }

      if (selectedOptionsRef.current && !settingOption) {
        if (Array.isArray(selectedOptionsRef.current) && multiSelect) {
          if (selectedOptionsRef.current.some((valueItem) => valueItem.name === 'all')) {
            if (
              selectedOptions?.length === 0 ||
              !options?.every((option) =>
                selectedOptions?.some((selectedOption: DropdownOptionType) => {
                  if (
                    (option._id !== null && selectedOption._id !== null) ||
                    (option?.name != null && selectedOption?.name != null)
                  ) {
                    if (selectedOption._id === option._id) {
                      return true
                    }
                    if (selectedOption.name === option.name) {
                      return true
                    }
                    return false
                  }
                })
              )
            ) {
              const optionArray = filteredOptions.filter(
                (option: any) => option.name !== 'all' && option.name !== 'clear'
              )
              setSelectedOptions(optionArray)
            }
          } else if (!isEqual(selectedOptions, selectedOptionsRef.current)) {
            const filterSelectedOptions = selectedOptionsRef.current.filter((valueItem) =>
              filteredOptions.some((option) => {
                if (
                  (option?._id != null && valueItem?._id != null) ||
                  (option?.name != null && valueItem?.name != null)
                ) {
                  if (valueItem?._id === option?._id) {
                    return true
                  }
                  if (valueItem?.name === option?.name) {
                    return true
                  }
                  return false
                }
              })
            )
            selectedOptionsRef.current = filterSelectedOptions
            setSelectedOptions(filterSelectedOptions)
          }
        } else {
          if (
            !multiSelect &&
            (selectedOptionsRef.current as DropdownOptionType).name !== (selectedOptions as DropdownOptionType)?.name
          ) {
            if (
              filteredOptions.some((option) => {
                if (option?._id != null || option.name != null) {
                  if (option?._id === (selectedOptionsRef.current as DropdownOptionType)._id) {
                    return true
                  }
                  if (option?.name === (selectedOptionsRef.current as DropdownOptionType).name) {
                    selectedOptionsRef.current = option
                    return true
                  }
                  return false
                }
              })
            ) {
              setSelectedOptions(selectedOptionsRef.current)
            } else {
              setSelectedOptions(null)
              onChange({ type: 'removed', target: { name: name } })
            }
          }
        }
      }
    }
  }, [value, options, settingOption, name, onChange, selectedOptions, multiSelect, filteredOptions])

  const handleValueSelect = (option: DropdownOptionType) => {
    setSettingOption(true)
    if (multiSelect) {
      if (option.name === 'clear') {
        setSelectedOptions(null)
        selectedOptionsRef.current = null
        return onChange({
          type: 'removed',
          target: { name: name },
        })
      } else if (option.name === 'all') {
        const allOptions = filteredOptions.filter((option) => option.name !== 'all' && option.name !== 'clear')
        setSelectedOptions(allOptions)
        selectedOptionsRef.current = [option]
      } else {
        if (!(selectedOptions?.length > 0)) {
          selectedOptionsRef.current = [option]
          setSelectedOptions([option])
        } else if (
          selectedOptions?.some((selectedOption: DropdownOptionType) => {
            if (selectedOption._id != null) {
              return selectedOption._id === option._id
            }
            return selectedOption.name === option.name
          })
        ) {
          selectedOptionsRef.current = selectedOptions?.filter((selectedOption: DropdownOptionType) => {
            if (selectedOption._id != null) {
              return selectedOption._id !== option._id
            }
            return selectedOption.name !== option.name
          })
          setSelectedOptions(selectedOptionsRef.current)
        } else {
          selectedOptionsRef.current = [...(selectedOptionsRef.current as DropdownOptionType[]), option]
          setSelectedOptions(selectedOptionsRef.current)
        }
      }
    } else {
      // If it's a single select, update selectedOptionsRef.current to match selectedOptions
      setSelectedOptions(option)
      setIsOpen(false)
      selectedOptionsRef.current = option
    }
    onChange({
      target: { name: name, value: selectedOptionsRef.current },
    })
    setSettingOption(false)
  }

  const handleValueRemove = () => {
    setSettingOption(true)
    selectedOptionsRef.current = null
    onChange({ type: 'removed', target: { name: name } })
    setSelectedOptions(null)
    setSettingOption(true)
  }

  const values =
    multiSelect && selectedOptions
      ? selectedOptions?.slice(0, 1).map((item: DropdownOptionType, index: number) => (
          <span className={dropdown_active_option} key={index}>
            {item.value}
          </span>
        ))
      : []

  return (
    <div className={clsx(dropdown, { [className]: className })}>
      <Tooltip opened={error} label={errorMsg} className={dropdown_wrapper}>
        {label && <span className={clsx(dropdown_label, { ['required']: required })}>{label}</span>}
        <div
          className={clsx(
            dropdown_container,
            'dropdown',
            {
              ['invalid']: error,
            },
            dropdown_height[height],
            dropdown_border[border]
          )}
          ref={(el) => {
            refs.setReference(el)
            dropdownRef.current = el
          }}
          {...getReferenceProps()}
          tabIndex={0}
          data-atapp-options={
            multiSelect
              ? selectedOptions?.length > 0 && 'true'
              : (selectedOptions as DropdownOptionType)?.value != null
                ? 'true'
                : 'false'
          }
          id={id}
          aria-required={required}
        >
          <span className={clsx(dropdown_input, { ['multiselect']: multiSelect })}>
            {multiSelect ? (
              selectedOptions?.length > 0 ? (
                <>
                  {values}
                  {selectedOptions?.length > 1 && (
                    <span className={dropdown_active_option}>+{selectedOptions?.length - 1} more</span>
                  )}
                </>
              ) : (
                placeholder
              )
            ) : (
              ((selectedOptions as DropdownOptionType)?.value ?? placeholder)
            )}
          </span>
          <span className={dropdown_right_section}>
            {selectedOptions && !multiSelect ? (
              <TbX
                onClick={(e) => {
                  e.stopPropagation()
                  !multiSelect && handleValueRemove()
                }}
              />
            ) : (
              <TbChevronDown
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen((prev) => !prev)
                }}
              />
            )}
          </span>
        </div>
      </Tooltip>
      {isOpen && (
        <FloatingPortal root={formContent ?? appMain} preserveTabOrder={true}>
          <FloatingFocusManager context={context} closeOnFocusOut={true} modal={false}>
            <div className={dropdown_menu} ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
              <ScrollArea scrollDirection='vertical'>
                {filteredOptions.map((optionItem: DropdownOptionType, optionIndex: number) => {
                  const active = multiSelect
                    ? selectedOptions?.some((selectedOption: DropdownOptionType) => {
                        if (selectedOption._id != null && optionItem?._id !== null) {
                          return selectedOption._id === optionItem?._id
                        } else {
                          return selectedOption.value === optionItem?.value
                        }
                      })
                    : optionItem?._id != null
                      ? (selectedOptions as DropdownOptionType)?._id != null &&
                        (selectedOptions as DropdownOptionType)?._id === optionItem?._id
                      : optionItem?.name != null &&
                        (selectedOptions as DropdownOptionType)?.name != null &&
                        (selectedOptions as DropdownOptionType)?.name === optionItem?.name

                  return (
                    <div
                      className={dropdown_option}
                      key={optionIndex}
                      {...getItemProps({
                        onClick() {
                          handleValueSelect(optionItem)
                        },
                        onKeyDown(e) {
                          if (e.key === 'Enter' || e.key === 'Space') {
                            handleValueSelect(optionItem)
                          }
                        },
                      })}
                      tabIndex={activeIndex === optionIndex ? 0 : -1}
                      ref={(node) => {
                        listItemsRef.current[optionIndex] = node
                        listContentRef.current[optionIndex] = node?.textContent ?? null
                      }}
                    >
                      <span>{optionItem?.value}</span>
                      <span className={dropdown_option_right_side}>{active && <TbCheck />}</span>
                    </div>
                  )
                })}
              </ScrollArea>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  )
}

export default Dropdown
