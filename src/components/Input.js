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
  position,
  onClick,
  border,
  size,
  value,
}) => {
  const inputRef = useRef(null)

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div
      className={`position-${position ?? 'relative'} col-sm ${size ?? ''} ${
        !!label ? 'form-floating' : ''
      }`}
    >
      <input
        ref={inputRef}
        className={`form-control ${border === false ? 'border-0' : ''} ${
          className ?? ''
        }`}
        type={type ?? 'text'}
        name={name}
        id={name}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange({ payload: e })}
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
  )
}

export default Input
