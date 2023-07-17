import React, { useRef } from 'react'

const Input = ({
  label,
  type,
  name,
  placeholder,
  autoComplete,
  required,
  className,
  disabled,
  onChange,
  invalidText,
}) => {
  const inputRef = useRef(null)

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div className={`position-relative ${!!label ? 'form-floating' : ''}`}>
      <input
        ref={inputRef}
        className={`form-control ${className ?? ''}`}
        type={type}
        name={name}
        id={name}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(e) => onChange({ payload: e })}
        onClick={handleFocus}
      />
      {!!label && <label htmlFor={name}>{placeholder}</label>}
      <div id={`${name}Tooltip`} className='invalid-tooltip'>
        {invalidText}
      </div>
    </div>
  )
}

export default Input
