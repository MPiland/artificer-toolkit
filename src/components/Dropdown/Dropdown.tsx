import { useEffect, useState, useRef } from 'react'
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
} from './Dropdown.css'
import { isEqual, uniqBy } from 'lodash'
import clsx from 'clsx'
import { DropdownOption, ReducerActionType } from '../../utils/types'
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
  value: DropdownOption[] | DropdownOption | null
  className?: string | number | symbol | any
  placeholder?: string
  options: DropdownOption[] | undefined
  multiSelect?: boolean
  optionalKey?: string | any[]
  onChange: (arg: ReducerActionType) => void
  errorMsg?: string
  id?: string
}

const Dropdown = ({
  label,
  required,
  name,
  options,
  multiSelect,
  optionalKey,
  value,
  onChange,
  placeholder,
  className,
  errorMsg = 'Must select an option',
  id,
}: DropdownProps) => {
  const [selectedOptions, setSelectedOptions] = useState<
    DropdownOption[] | DropdownOption | null
  >(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [error, setError] = useState<boolean>(false)
  const [settingOption, setSettingOption] = useState<boolean>(false)

  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const updatedOptions = useRef<DropdownOption[] | DropdownOption | null>(
    value ?? null
  )

  useEffect(() => {
    const dropdown = dropdownRef.current
    if (dropdown) {
      dropdown.addEventListener('setErrorState', (e: any) => setError(e.detail))

      return () =>
        dropdown.removeEventListener('setErrorState', (e: any) =>
          setError(e.detail)
        )
    }
  }, [])

  const appMain = document.getElementById('app-main')

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

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [click, listNavigation, typeahead, dismiss]
  )

  let optionArray: DropdownOption[]

  if (options?.length) {
    optionArray = options?.filter((option) => option?.value != null)
    optionArray = optionArray.map(({ name, value, _id, ...rest }) => {
      const newObj: DropdownOption = { name, value, _id }

      if (optionalKey) {
        if (Array.isArray(optionalKey)) {
          optionalKey.forEach((key) => {
            newObj[key] = rest[key]
          })
        } else {
          const optionalValue = rest[optionalKey]
          if (optionalValue !== undefined) {
            newObj[optionalKey] = optionalValue
          }
        }
      }

      return newObj
    })
    optionArray.sort((a, b) =>
      a.value === b.value ? 0 : a.value > b.value ? 1 : -1
    )
  } else {
    optionArray = []
  }

  optionArray = uniqBy(optionArray, (obj) => obj.value)

  const newOptions = [...optionArray]

  if (multiSelect) {
    newOptions.unshift(
      { name: 'all', value: 'All', _id: null },
      { name: 'clear', value: 'Clear', _id: null }
    )
  }

  useEffect(() => {
    if (!isEqual(value, updatedOptions.current) && !settingOption) {
      updatedOptions.current = value
    }
    if (updatedOptions.current && !settingOption) {
      if (Array.isArray(updatedOptions.current)) {
        if (
          updatedOptions.current.some((valueItem) => valueItem.name === 'all')
        ) {
          if (
            selectedOptions?.length === 0 ||
            !optionArray?.every((optionItem: DropdownOption) =>
              selectedOptions?.some(
                (selectedOption: DropdownOption) =>
                  selectedOption._id === optionItem._id
              )
            )
          ) {
            setSelectedOptions(optionArray)
          }
        } else if (!isEqual(selectedOptions, updatedOptions.current)) {
          setSelectedOptions(
            updatedOptions.current.filter((valueItem) =>
              optionArray.some((optionItem) => valueItem._id === optionItem._id)
            )
          )
        }
      } else if (!isEqual(updatedOptions.current, selectedOptions)) {
        if (
          optionArray.some(
            (optionItem) =>
              optionItem._id === (updatedOptions.current as DropdownOption)._id
          )
        ) {
          setSelectedOptions(updatedOptions.current)
        } else {
          setSelectedOptions(null)
          onChange({ type: 'removed', target: { name: name } })
        }
      }
    }
  }, [value, optionArray, settingOption, name, onChange, selectedOptions])

  const handleValueSelect = (option: DropdownOption) => {
    setSettingOption(true)
    if (multiSelect) {
      if (option.name === 'clear') {
        setSelectedOptions(null)
        updatedOptions.current = null
        return onChange({
          type: 'removed',
          target: { name: name },
        })
      } else if (option.name === 'all') {
        setSelectedOptions(optionArray)
        updatedOptions.current = [option]
      } else {
        if (!(selectedOptions?.length > 0)) {
          updatedOptions.current = [option]
          setSelectedOptions([option])
        } else if (
          selectedOptions?.some(
            (selectedOption: DropdownOption) =>
              selectedOption._id === option._id
          )
        ) {
          updatedOptions.current = selectedOptions.filter(
            (selectedOption: DropdownOption) =>
              selectedOption._id !== option._id
          )
          setSelectedOptions((current) =>
            current?.filter(
              (currentItem: DropdownOption) => currentItem._id !== option._id
            )
          )
        } else {
          updatedOptions.current = [
            ...(updatedOptions.current as DropdownOption[]),
            option,
          ]
          setSelectedOptions((current) => {
            return [...(current as DropdownOption[]), option]
          })
        }
      }
    } else {
      // If it's a single select, update updatedOptions.current to match selectedOptions
      setSelectedOptions(option)
      setIsOpen(false)
      updatedOptions.current = option
    }
    onChange({
      target: { name: name, value: updatedOptions.current },
    })
    setSettingOption(false)
  }

  const handleValueRemove = () => {
    setSettingOption(true)
    updatedOptions.current = null
    onChange({ type: 'removed', target: { name: name } })
    setSelectedOptions(null)
    setSettingOption(true)
  }

  const values = multiSelect
    ? selectedOptions
        ?.slice(0, 1)
        .map((item: DropdownOption, index: number) => (
          <span className={dropdown_active_option} key={index}>
            {item.value}
          </span>
        ))
    : []

  return (
    <div className={clsx(dropdown, { [className]: className })}>
      <Tooltip error={error} errorMsg={errorMsg} className={dropdown_wrapper}>
        {label && (
          <span className={clsx(dropdown_label, { ['required']: required })}>
            {label}
          </span>
        )}
        <div
          className={clsx(dropdown_container, 'dropdown', {
            ['invalid']: error,
          })}
          ref={(el) => {
            refs.setReference(el)
            dropdownRef.current = el
          }}
          {...getReferenceProps()}
          tabIndex={0}
          data-atapp-options={
            multiSelect
              ? selectedOptions?.length > 0 && 'true'
              : (selectedOptions as DropdownOption)?.value
              ? 'true'
              : 'false'
          }
          id={id}
          aria-required={required}
        >
          <span className={dropdown_input}>
            {multiSelect ? (
              selectedOptions?.length > 0 ? (
                <>
                  {values}
                  {selectedOptions?.length > 1 && (
                    <span className={dropdown_active_option}>
                      +{selectedOptions?.length - 1} more
                    </span>
                  )}
                </>
              ) : (
                placeholder
              )
            ) : (
              (selectedOptions as DropdownOption)?.value ?? placeholder
            )}
          </span>
          <span
            className={dropdown_right_section}
            onClick={(e: any) => {
              e.stopPropagation()
              !multiSelect && handleValueRemove()
              multiSelect && setIsOpen((prev) => !prev)
            }}
          >
            {selectedOptions && !multiSelect ? <TbX /> : <TbChevronDown />}
          </span>
        </div>
      </Tooltip>
      {isOpen && (
        <FloatingPortal root={appMain} preserveTabOrder={true}>
          <FloatingFocusManager
            context={context}
            closeOnFocusOut={true}
            modal={false}
          >
            <div
              className={dropdown_menu}
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
            >
              <ScrollArea scrollDirection='vertical'>
                {newOptions.map(
                  (optionItem: DropdownOption, optionIndex: number) => {
                    const active = multiSelect
                      ? selectedOptions?.some(
                          (selectedOption: DropdownOption) => {
                            if (selectedOption._id != null) {
                              return selectedOption._id === optionItem._id
                            } else {
                              return selectedOption.value === optionItem.value
                            }
                          }
                        )
                      : (selectedOptions as DropdownOption)?._id ===
                        optionItem._id
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
                          listContentRef.current[optionIndex] =
                            node?.textContent ?? null
                        }}
                      >
                        <span>{optionItem.value}</span>
                        <span className={dropdown_option_right_side}>
                          {active && <TbCheck />}
                        </span>
                      </div>
                    )
                  }
                )}
              </ScrollArea>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  )
}

export default Dropdown
