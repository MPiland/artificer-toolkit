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
}) => {
  const inputRef = useRef(null)

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div className={`${!!label ? 'form-floating' : ''}`}>
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
    </div>
  )
}

export default Input
