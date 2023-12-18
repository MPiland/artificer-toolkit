import { useRef, useState, useEffect } from 'react'
import useDebounce from '../hooks/useDebounce'

const NUM_REGEX = /^[0-9]+(, [0-9]+)*$/
const CUR_REGEX = /^\d*\.?\d*$/

const Input = ({
  label,
  type,
  name,
  autoComplete,
  required,
  onChange,
  invalidText,
  border,
  size,
  value,
  readOnly,
  validation,
  className,
  autoFocus,
  password,
}) => {
  const inputRef = useRef(null)
  const [inputValue, setInputValue] = useState(value)

  useEffect(() => {
    if (autoFocus === true) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleChange = (e) => {
    if (inputRef.current.classList.contains('is-invalid')) {
      inputRef.current.classList.remove('is-invalid')
    }
    setInputValue(e.target.value)

    if (validation) {
      if (validation === 'num') {
        if (
          NUM_REGEX.test(e.target.value) === false &&
          e.target.value !== '' &&
          !e.target.classList.contains('is-invalid')
        ) {
          e.target.classList.add('is-invalid')
        } else {
          e.target.classList.remove('is-invalid')
        }
      } else if (validation === 'cur') {
        if (
          CUR_REGEX.test(e.target.value) === false &&
          e.target.value !== '' &&
          !e.target.classList.contains('is-invalid')
        ) {
          e.target.classList.add('is-invalid')
        } else {
          e.target.classList.remove('is-invalid')
        }
      }
    }
    debounceSave(e.target)
  }

  const debounceSave = useDebounce(function (target) {
    onChange({ payload: { target: target } })
  }, 0.5 * 1000) // every 3 seconds max

  const content = (
    <div
      className={`${validation ? 'position-relative' : ''} ${
        size ? `${size}` : 'col'
      }`}
    >
      {label && (
        <label
          className={`form-input-label ${required ? 'required' : ''}`}
          htmlFor={name}
        >
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        className={`form-control${readOnly ? '-plaintext' : ''} ${
          border === false ? 'border-0' : ''
        } ${className ? className : ''}`}
        type={type ?? 'text'}
        name={name}
        id={name}
        required={required}
        autoFocus={autoFocus}
        autoComplete={autoComplete ?? 'off'}
        readOnly={readOnly}
        value={inputValue ?? ''}
        validation={validation}
        onChange={(e) => handleChange(e)}
      />
      {invalidText && (
        <div id={`${name}Tooltip`} className='invalid-tooltip'>
          {invalidText}
        </div>
      )}
    </div>
  )

  return content
}

export default Input
