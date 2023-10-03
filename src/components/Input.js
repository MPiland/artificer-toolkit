import { useRef, useState, useEffect } from 'react'
import useDebounce from '../hooks/useDebounce'

const NUM_REGEX = /^[0-9]+$/
const CUR_REGEX = /^\d*\.?\d*$/

const Input = ({
  label,
  type,
  name,
  placeholder,
  autoComplete,
  required,
  onChange,
  invalidText,
  border,
  size,
  value,
  readOnly,
  onClick,
  validation,
  className,
}) => {
  const inputRef = useRef(null)
  const [inputValue, setInputValue] = useState(value)
  const [classText, setClassText] = useState('')

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  useEffect(() => {
    setInputValue(value)
  }, [setInputValue, value])

  const handleChange = (e) => {
    setInputValue(e.target.value)

    if (validation) {
      if (validation === 'num') {
        if (NUM_REGEX.test(e.target.value) === false && e.target.value !== '') {
          setClassText('is-invalid')
        } else {
          setClassText('')
        }
      } else if (validation === 'cur') {
        if (CUR_REGEX.test(e.target.value) === false && e.target.value !== '') {
          setClassText('is-invalid')
        } else {
          setClassText('')
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
      <div className={`${label ? 'form-floating' : ''}`}>
        <input
          ref={inputRef}
          className={`form-control${readOnly ? '-plaintext' : ''} ${
            border === false ? 'border-0' : ''
          } ${classText} ${className ?? ''}`}
          type={type ?? 'text'}
          name={name}
          id={name}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete ?? 'off'}
          readOnly={readOnly}
          value={inputValue ?? ''}
          validation={validation}
          onChange={(e) => handleChange(e)}
          onKeyUp={(e) => e.preventDefault()}
          onClick={(e) => {
            onClick && onClick(e)
            handleFocus()
          }}
        />
        {!!label && <label htmlFor={name}>{placeholder}</label>}
        {invalidText && (
          <div id={`${name}Tooltip`} className='invalid-tooltip'>
            {invalidText}
          </div>
        )}
      </div>
    </div>
  )

  return content
}

export default Input
