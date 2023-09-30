import {
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react'
import useDebounce from '../hooks/useDebounce'

const NUM_REGEX = /^[0-9\b]+$/
const CUR_REGEX = /^\d*\.?\d*$/
const PWD_REGEX =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/
const USER_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEL_REGEX = /^DELETE$/

const Input = forwardRef(
  (
    {
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
    },
    ref
  ) => {
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
          if (NUM_REGEX.test(e.target.value) === false) {
            setClassText('is-invalid')
          } else {
            setClassText('')
          }
        } else if (validation === 'cur') {
          if (CUR_REGEX.test(e.target.value) === false) {
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
          size ? `${size}` : 'col-sm'
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

    useImperativeHandle(ref, () => ({
      getValidation() {
        if (validation === 'pwd') {
          if (PWD_REGEX.test(inputRef.current.value) === false) {
            return false
          } else {
            return true
          }
        } else if (validation === 'user') {
          if (USER_REGEX.test(inputRef.current.value) === false) {
            return false
          } else {
            return true
          }
        } else if (validation === 'delete') {
          if (DEL_REGEX.test(inputRef.current.value) === false) {
            return false
          } else {
            return true
          }
        }
      },
      setClass(valid) {
        setClassText(valid)
      },
      resetState() {
        setInputValue(null)
      },
    }))

    return content
  }
)

export default Input
