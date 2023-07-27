import { useState, useEffect, useRef } from 'react'
import '../css/select.css'

const Select = ({
  name,
  multiple,
  placeholder,
  options,
  action,
  state,
  onChange,
}) => {
  const [selectedOptions, setSelectedOptions] = useState(multiple ? [] : null)
  const [menuOpen, setMenuOpen] = useState(false)
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)

  let newOptions

  if (options?.length) {
    newOptions = options?.map(({ name, value, _id }) => ({ name, value, _id }))
  } else {
    newOptions = []
  }

  if (multiple) {
    newOptions.unshift(
      { name: 'all', value: 'All' },
      { name: 'clear', value: 'Clear' }
    )
  }
  
  useEffect(() => {
    // Set the initial selectedOptions based on the state prop
    if (state && Array.isArray(state)) {
      if (state.some((item) => item.name === 'all')) {
        setSelectedOptions(
          options?.map(({ name, value, _id }) => ({ name, value, _id }))
        )
      } else {
        setSelectedOptions(state)
      }
    } else if (state && !Array.isArray(state)) {
      setSelectedOptions(state)
    } else {
      setSelectedOptions(multiple ? [] : null)
    }
  }, [state, multiple, options])

  const handleOptionClick = (option) => {
    let updatedOptions
    if (multiple) {
      // Clear all options
      if (option.name === 'clear') {
        updatedOptions = []
        // Add all options
      } else if (option.name === 'all') {
        updatedOptions = [
          { name: option.name, id: option._id, value: option.value },
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
            { name: option.name, id: option._id, value: option.value },
          ]
        }
      } else {
        updatedOptions = [
          { name: option.name, id: option._id, value: option.value },
        ]
      }
    } else {
      updatedOptions = {
        name: option.name,
        id: option._id,
        value: option.value,
      }
      handleToggleClick()
    }

    if (option.value !== 'All') {
      setSelectedOptions(updatedOptions)
    } else {
      const fullOptions = options.map((item) => ({ ...item }))
      setSelectedOptions(fullOptions)
    }

    onChange({
      type: !!action ? action : null,
      payload: { target: { name: name, value: updatedOptions } },
    })
  }

  const handleToggleClick = () => {
    if (menuOpen) {
      setMenuOpen(false)
    } else {
      setMenuOpen(true)
    }
  }

  const selectClass = (option) => {
    if (multiple) {
      if (selectedOptions?.length > 0) {
        if (selectedOptions?.some((item) => item.value === option.value)) {
          return 'rounded-pill border border-primary'
        } else {
          return 'rounded-pill border border-secondary-subtle'
        }
      } else {
        if (selectedOptions?.value === option.value) {
          return 'rounded-pill border border-primary'
        } else {
          return 'rounded-pill border border-secondary-subtle'
        }
      }
    } else if (selectedOptions?.value === option.value) {
      return 'rounded-pill border border-primary'
    } else {
      return ''
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
        .map((option) => (
          <span key={option.name} className={`select-option ${displayClass()}`}>
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
      return 'border border-primary rounded-3 me-1 px-1'
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

  return (
    <div className='dropdown'>
      <button
        className={`dropdown-toggle-select w-100`}
        type='button'
        id='selectDropdownButton'
        data-bs-toggle='dropdown'
        data-bs-target='#selectDropdown'
        data-bs-boundary='#main-container'
        aria-expanded='false'
        ref={buttonRef}
        disabled={!!options ? false : true}
      >
        <div className={`select-container ${containerClass()}`}>
          <div>
            <i
              className={`bi bi-caret-down-fill select-caret ${
                menuOpen ? 'menu-open-select' : ''
              }`}
            />
          </div>
          <div className='select-div'>{displayOption()}</div>
          <label className={`select-label ${labelClass()}`}>
            {placeholder || 'Select an option'}
          </label>
        </div>
      </button>
      <ul
        className='dropdown-menu select-menu position-absolute px-2'
        id='selectDropdown'
        ref={dropdownRef}
      >
        {newOptions.map((option) => (
          <li
            className={`mb-2 dropdown-item py-0 px-2 ${selectClass(option)}`}
            key={option.value}
            onClick={(e) => {
              multiple && e.stopPropagation()
              handleOptionClick(option)
            }}
          >
            {option.value}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Select
