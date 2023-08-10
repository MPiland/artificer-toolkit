import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react'
import { uniqBy } from 'lodash'
import '../css/select.css'

const Select = forwardRef(
  (
    { name, multiple, placeholder, options, value, onChange, size, className },
    ref
  ) => {
    const [selectedOptions, setSelectedOptions] = useState(multiple ? [] : null)
    const [classText, setClassText] = useState('')
    const [currentLetter, setCurrentLetter] = useState()
    const parentRef = useRef(null)
    const buttonRef = useRef(null)
    const dropdownRef = useRef(null)
    const dropdownChildren = useRef([])
    const focusedIndex = useRef(0)

    let newOptions
    let updatedOptions

    if (options?.length) {
      newOptions = options?.map(({ name, value, _id }) => ({
        name,
        value,
        _id,
      }))
      newOptions.sort((a, b) => (a.value > b.value ? 1 : -1))
    } else {
      newOptions = []
    }

    newOptions = uniqBy(newOptions, (obj) => obj.value)

    if (multiple) {
      newOptions.unshift(
        { name: 'all', value: 'All' },
        { name: 'clear', value: 'Clear' }
      )
    }

    useEffect(() => {
      if (value && Array.isArray(value)) {
        if (value.some((item) => item.name === 'all')) {
          setSelectedOptions(
            uniqBy(
              options?.map(({ name, value, _id }) => ({ name, value, _id })),
              (obj) => obj.value
            )
          )
        } else {
          setSelectedOptions(value)
        }
      } else if (value && !Array.isArray(value)) {
        setSelectedOptions(value)
      } else {
        setSelectedOptions(multiple ? [] : null)
      }
    }, [value, multiple, options])

    useEffect(() => {
      document.addEventListener('click', handleOutsideClick)

      return () => {
        document.removeEventListener('click', handleOutsideClick)
      }
    }, [])

    useEffect(() => {
      const parentCurrent = parentRef.current
      const dropdownCurrent = dropdownRef.current
      const buttonCurrent = buttonRef.current

      const handleKeyUp = (event) => {
        const key = event.key
        if (key === 'Enter') {
          const focusedIndex = dropdownChildren.current.findIndex(
            (child) => document.activeElement === child
          )
          if (focusedIndex >= 0) {
            dropdownChildren.current[focusedIndex].click()
          }
          if (!multiple) {
            dropdownCurrent.classList.remove('show')
            buttonCurrent.setAttribute('aria-expanded', 'false')
          }
        } else if (key === 'Tab') {
          event.preventDefault()
          dropdownCurrent.classList.remove('show')
          buttonCurrent.setAttribute('aria-expanded', 'false')
        } else if (/^[a-zA-Z0-9]$/.test(key)) {
          setCurrentLetter(key)
          dropdownCurrent.classList.add('show')
          buttonCurrent.setAttribute('aria-expanded', 'true')

          if (key !== currentLetter) {
            setCurrentLetter(key)
            focusedIndex.current = 0
          } else {
            focusedIndex.current = focusedIndex.current + 1
          }

          const optionMatches = newOptions.filter((option) => {
            return (
              option.value &&
              String(option.value).toLowerCase().startsWith(key.toLowerCase())
            )
          })

          if (optionMatches.length > 0) {
            const nextFocusedIndex = findOptionIndex(optionMatches)

            setFocus(nextFocusedIndex)
          }
        }
      }

      const findOptionIndex = (optionMatches) => {
        if (focusedIndex.current > optionMatches.length - 1) {
          focusedIndex.current = 0
        }

        const optionIndexValue = newOptions.findIndex(
          (option) => option.value === optionMatches[focusedIndex.current].value
        )

        if (optionIndexValue === -1) {
          return 0
        } else {
          return optionIndexValue
        }
      }

      const setFocus = (index) => {
        if (dropdownChildren.current[index]) {
          dropdownChildren.current[index].focus()
        }
      }

      parentCurrent.addEventListener('keyup', handleKeyUp)

      return () => {
        parentCurrent.removeEventListener('keyup', handleKeyUp)
      }
    }, [newOptions, currentLetter, focusedIndex, multiple])

    const handleOutsideClick = (event) => {
      const parentCurrent = parentRef.current
      const target = event.target
      if (!parentCurrent.contains(target)) {
        dropdownRef.current.classList.remove('show')
        buttonRef.current.setAttribute('aria-expanded', 'false')
      }
    }

    const handleOptionClick = (option) => {
      if (multiple) {
        // Clear all options
        if (option.name === 'clear') {
          updatedOptions = []
          // Add all options
        } else if (option.name === 'all') {
          updatedOptions = [
            {
              name: option.name ?? null,
              id: option._id ?? null,
              value: option.value,
            },
          ]
          // If shown options are an array and all valid
        } else if (
          Array.isArray(selectedOptions) &&
          selectedOptions.every((option) =>
            newOptions.some((item) => item.value === option.value)
          )
        ) {
          // Remove the option selected if it's part of the selected options
          if (selectedOptions.some((item) => item.value === option.value)) {
            updatedOptions = selectedOptions.filter(
              (item) => item.value !== option.value
            )
            // Add the option if it's not
          } else {
            updatedOptions = [
              ...selectedOptions,
              {
                name: option.name ?? null,
                id: option._id ?? null,
                value: option.value,
              },
            ]
          }
        } else {
          updatedOptions = [
            {
              name: option.name ?? null,
              id: option._id ?? null,
              value: option.value,
            },
          ]
        }
      } else {
        updatedOptions = {
          name: option.name,
          id: option._id,
          value: option.value,
        }
      }
      onChange({ payload: { target: { name: name, value: updatedOptions } } })
    }

    const selectClass = (option) => {
      if (multiple) {
        if (selectedOptions?.length > 0) {
          if (selectedOptions?.some((item) => item.value === option.value)) {
            return 'rounded-pill selected'
          } else {
            return 'rounded-pill border border-secondary-subtle'
          }
        } else {
          if (selectedOptions?.value === option.value) {
            return 'rounded-pill border selected'
          } else {
            return 'rounded-pill border border-secondary-subtle'
          }
        }
      } else if (selectedOptions?.value === option.value) {
        return 'rounded-pill border selected'
      } else {
        return 'rounded-pill'
      }
    }

    const containerClass = () => {
      if (
        (multiple &&
          selectedOptions?.length > 0 &&
          selectedOptions.every((option) =>
            newOptions.some((item) => item.value === option.value)
          )) ||
        (selectedOptions &&
          newOptions.some((option) => option.value === selectedOptions.value))
      ) {
        return 'has-value-select'
      } else {
        return ''
      }
    }

    const displayOption = () => {
      if (multiple && selectedOptions?.length > 0) {
        return selectedOptions
          .filter((option) =>
            newOptions.some((item) => item.value === option.value)
          )
          .map((option, optionIndex) => (
            <span
              key={optionIndex}
              className={`select-option ${displayClass()}`}
            >
              {option.value}
            </span>
          ))
      } else if (
        selectedOptions &&
        newOptions.some((option) => option.value === selectedOptions.value)
      ) {
        return (
          <span className={`select-option ${displayClass()}`}>
            {selectedOptions.value}
          </span>
        )
      }
    }

    const displayClass = () => {
      if (multiple && selectedOptions?.length > 0) {
        return 'border border-primary rounded-pill me-1 px-1'
      } else if (!!selectedOptions.value) {
        return ''
      }
    }

    const labelClass = () => {
      if (multiple && selectedOptions?.length > 0) {
        if (
          selectedOptions.every((option) =>
            newOptions.some((item) => item.value === option.value)
          )
        ) {
          return 'filled'
        }
      } else if (
        selectedOptions &&
        newOptions.some((option) => option.value === selectedOptions.value)
      ) {
        return 'filled'
      } else {
        return ''
      }
    }

    const content = (
      <div
        className={`dropdown ${size ?? 'col-sm'} ${
          className ? `${className}` : ''
        }`}
        ref={parentRef}
      >
        <button
          ref={buttonRef}
          className={`btn dropdown-toggle focus-ring align-items-center w-100 justify-content-between ${containerClass()} ${classText}`}
          data-bs-toggle='dropdown'
          aria-expanded='false'
          type='button'
          id='selectButton'
        >
          <div className='select-container'>{displayOption()}</div>
          <label className={`select-label ${labelClass()}`}>
            {placeholder || 'Select an option'}
          </label>
        </button>
        <ul
          className='dropdown-menu select-menu my-2 px-1 pb-0'
          id='selectDropdown'
          ref={dropdownRef}
        >
          {newOptions.map((option, optionIndex) => (
            <li
              tabIndex='0'
              className={`dropdown-item mb-2 py-0 px-2 ${selectClass(option)}`}
              key={optionIndex}
              onClick={(e) => {
                handleOptionClick(option)
                multiple && e.stopPropagation()
              }}
              ref={(el) => (dropdownChildren.current[optionIndex] = el)}
            >
              {option.value}
            </li>
          ))}
        </ul>
      </div>
    )

    useImperativeHandle(ref, () => ({
      getValue() {
        return updatedOptions
      },
      setClass(valid) {
        setClassText(valid)
      },
    }))

    return content
  }
)

export default Select
