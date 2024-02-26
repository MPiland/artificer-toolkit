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
  dropdown_error_message,
} from './Dropdown.css'
import { uniqBy } from 'lodash'
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

interface DropdownProps {
  label?: string | boolean
  name: string
  required?: boolean
  value: any[] | null
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
  errorMsg,
  id,
}: DropdownProps) => {
  const [selectedOptions, setSelectedOptions] = useState<
    DropdownOption[] | DropdownOption | null
  >(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [error, setError] = useState<boolean>(false)

  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const updatedOptions = useRef<DropdownOption[] | DropdownOption | null>(null)

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

  let newOptions: DropdownOption[]

  if (options?.length) {
    newOptions = options?.filter((option) => option?.value != null)
    newOptions = newOptions.map(({ name, value, id, ...rest }) => {
      const newObj: DropdownOption = { name, value, id }

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
    newOptions.sort((a, b) =>
      a.value === b.value ? 0 : a.value > b.value ? 1 : -1
    )
  } else {
    newOptions = []
  }

  newOptions = uniqBy(newOptions, (obj) => obj.value)

  if (multiSelect) {
    newOptions.unshift(
      { name: 'all', value: 'All', id: 'all' },
      { name: 'clear', value: 'Clear', id: 'clear' }
    )
  }

  useEffect(() => {
    if (Array.isArray(value)) {
      if (
        value.some((item) => item.name === 'all') &&
        !selectedOptions?.every((option: DropdownOption) =>
          newOptions.map((newOption) => newOption.value === option.value)
        )
      ) {
        setSelectedOptions(
          uniqBy(newOptions, (obj) => obj.value).filter(
            (option) => option.name !== 'all' && option.name !== 'clear'
          )
        )
      } else if (
        !value.every((option) =>
          newOptions.some((newOption) => newOption.id === option.id)
        )
      ) {
        updatedOptions.current = value.filter((valueItem) =>
          newOptions.some((newOption) => newOption.id === valueItem.id)
        )
        setSelectedOptions(
          value.filter((valueItem) =>
            newOptions.some((newOption) => newOption.id === valueItem.id)
          )
        )
      } else {
        updatedOptions.current = value
        setSelectedOptions(value)
      }
    }
    if (value !== updatedOptions.current) {
      updatedOptions.current = value
      setSelectedOptions(value)
    }
  }, [value, newOptions, selectedOptions])

  const handleValueSelect = (option: DropdownOption) => {
    if (multiSelect) {
      if (option.name === 'clear') {
        setSelectedOptions([])
        updatedOptions.current = null
      } else if (option.name === 'all') {
        const allOptions = uniqBy(options, (obj) => obj.value)
        setSelectedOptions(allOptions)
        updatedOptions.current = [option]
      } else {
        let updated: DropdownOption[] | null = null
        setSelectedOptions((current) => {
          if (current != null) {
            updated = current.some(
              (item: DropdownOption) => item.id === option.id
            )
              ? current.filter((v: any) => v.id !== option.id)
              : [...(current as DropdownOption[]), option]
          } else {
            updated = [option]
          }
          return updated
        })
        updatedOptions.current = updated
      }
    } else {
      setSelectedOptions(option)
      setIsOpen(false)
      // If it's a single select, update updatedOptions.current to match selectedOptions
      updatedOptions.current = option
    }
    onChange({
      target: { name: name, value: updatedOptions.current },
    })
  }

  const handleValueRemove = (option: DropdownOption) => {
    if (multiSelect) {
      setSelectedOptions((current) =>
        current?.filter((v: DropdownOption) => v !== option)
      )
    } else {
      updatedOptions.current = null
      onChange({ target: { name: name, value: null } })
      setSelectedOptions(null)
    }
  }

  const values = multiSelect
    ? selectedOptions?.slice(0, 1).map(
        (item: DropdownOption, index: number) =>
          item.name !== 'clear' &&
          item.name !== 'all' && (
            <span className={dropdown_active_option} key={index}>
              {item.value}
            </span>
          )
      )
    : []

  return (
    <div className={clsx(dropdown, { [className]: className })}>
      <div className={dropdown_wrapper}>
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
              selectedOptions && !multiSelect && e.stopPropagation()
              handleValueRemove(selectedOptions as DropdownOption)
            }}
          >
            {selectedOptions && !multiSelect ? <TbX /> : <TbChevronDown />}
          </span>
        </div>
        {error && <div className={dropdown_error_message}>{errorMsg}</div>}
      </div>
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
                          (selectedOption: DropdownOption) =>
                            selectedOption.id === optionItem.id
                        )
                      : (selectedOptions as DropdownOption)?.id ===
                        optionItem.id
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
