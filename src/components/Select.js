import React, { useState, useEffect, useRef } from 'react'
import '../css/select.css'

const Select = ({ name, multiple, placeholder, options, action, onChange }) => {
  const [selectedOptions, setSelectedOptions] = useState(multiple ? [] : null)
  const [menuOpen, setMenuOpen] = useState(false)
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)

  let newOptions

  if (options?.length) {
    newOptions = options?.map((item) => ({ ...item }))
  } else {
    newOptions = []
  }

  if (multiple) {
    newOptions.unshift(
      { name: 'all', value: 'All' },
      { name: 'clear', value: 'Clear' }
    )
  }

  const handleOptionClick = (option) => {
    handleToggleClick()
    let updatedOptions
    if (multiple) {
      if (option.value === 'Clear') {
        updatedOptions = []
      } else if (
        Array.isArray(selectedOptions) &&
        selectedOptions.every((option) =>
          newOptions.some((item) => item.value === option.value)
        )
      ) {
        if (selectedOptions.some((item) => item.value === option.value)) {
          updatedOptions = selectedOptions.filter(
            (item) => item.value !== option.value
          )
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

      setMenuOpen(false)
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

  const handleClickOutside = (event) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target) &&
      !buttonRef.current &&
      event.target.id !== 'selectDropdownButton'
    ) {
      setMenuOpen(false)
    }
  }

  useEffect(() => {
    document.addEventListener('click', handleClickOutside)

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  return (
    <div className='dropdown'>
      <button
        className={`dropdown-toggle-select w-100`}
        type='button'
        id='selectDropdownButton'
        data-bs-toggle='dropdown'
        data-bs-boundary='#main-container'
        aria-expanded='false'
        onClick={handleToggleClick}
        ref={buttonRef}
        disabled={!!options ? false : true}
      >
        <div
          className={`select-container ${
            (multiple &&
              selectedOptions?.length > 0 &&
              selectedOptions.every((option) =>
                newOptions.some((item) => item.value === option.value)
              )) ||
            (selectedOptions &&
              newOptions.some(
                (option) => option.value === selectedOptions.value
              ))
              ? 'has-value-select'
              : ''
          }`}
        >
          <div>
            <i
              className={`bi bi-caret-down-fill select-caret ${
                menuOpen ? 'menu-open-select' : ''
              }`}
            />
          </div>
          <div className='select-div'>
            {multiple
              ? selectedOptions?.length > 0
                ? selectedOptions
                    .filter((option) =>
                      newOptions.some((item) => item.value === option.value)
                    )
                    .map((option) => (
                      <span
                        key={option.name}
                        className='border border-primary rounded-3 me-1 px-1 select-option'
                      >
                        {option.value}
                      </span>
                    ))
                : !!selectedOptions?.value && (
                    <span className='border border-primary rounded-3 me-1 px-1 select-option'>
                      {selectedOptions.value}
                    </span>
                  )
              : selectedOptions && (
                  <span className='select-option'>{selectedOptions.value}</span>
                )}
          </div>
          <label
            className={`select-label ${
              (selectedOptions?.length > 0 &&
                selectedOptions.every((option) =>
                  newOptions.some((item) => item.value === option.value)
                )) ||
              !!selectedOptions?.value
                ? 'filled'
                : ''
            }`}
          >
            {placeholder || 'Select an option'}
          </label>
        </div>
      </button>
      <ul
        className='dropdown-menu select-menu position-absolute'
        ref={dropdownRef}
      >
        {newOptions.map((option) => (
          <li className='mb-2 mx-1' key={option.value}>
            {multiple ? (
              selectedOptions?.length > 0 ? (
                <button
                  type='button'
                  className={`dropdown-item py-0 ${
                    selectedOptions?.some((item) => item.value === option.value)
                      ? 'rounded-pill border border-primary'
                      : 'rounded-pill border border-secondary-subtle'
                  }`}
                  onClick={() => handleOptionClick(option)}
                >
                  {option.value}
                </button>
              ) : (
                <button
                  type='button'
                  className={`dropdown-item py-0 ${
                    selectedOptions?.value === option.value
                      ? 'rounded-pill border border-primary'
                      : 'rounded-pill border border-secondary-subtle'
                  }`}
                  onClick={() => handleOptionClick(option)}
                >
                  {option.value}
                </button>
              )
            ) : (
              <button
                type='button'
                className={`dropdown-item py-0 ${
                  selectedOptions?.value === option.value
                    ? 'rounded-pill border border-primary'
                    : ''
                }`}
                onClick={() => handleOptionClick(option)}
              >
                {option.value}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Select
