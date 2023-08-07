import { useRef } from 'react'

const Input = ({
  label,
  type,
  name,
  placeholder,
  autoComplete,
  required,
  className,
  onChange,
  invalidText,
  border,
  size,
  value,
  readOnly,
  onClick,
}) => {
  const inputRef = useRef(null)

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }
  
  const content = (
    <div
      className={`position-relative ${size ? `${size}` : 'col-sm'} ${
        !!label ? 'form-floating' : ''
      }`}
    >
      <input
        ref={inputRef}
        className={`form-control${readOnly ? '-plaintext' : ''} ${
          border === false ? 'border-0' : ''
        } ${className ?? ''}`}
        type={type ?? 'text'}
        name={name}
        id={name}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange(e.target)}
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
  )

  return content
}

export default Input
