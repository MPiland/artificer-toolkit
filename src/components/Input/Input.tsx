import { useState, useEffect, memo, FC } from 'react'
import useDebounce, { UseDebounceCallback } from '../../hooks/useDebounce'
import {
  input_wrapper,
  input_label,
  input_label_required,
  input_error_message,
  input_container,
  invalid,
  input_left_section,
  input_right_section,
  input,
} from './Input.css'
import { Action } from '../../utils/types'
import clsx from 'clsx'

const NUM_REGEX = /^(\d+)(, ?\d+)*(,)?$/
const CUR_REGEX = /^\d*\.?\d*$/

interface InputProps {
  label?: string | boolean
  name: string
  autoComplete?: string
  required?: boolean
  errorMsg?: string
  onChange: (arg: Action) => void
  value: any | null
  readOnly?: boolean
  validation?: string
  autoFocus?: boolean
  className?: string | number | symbol | any
  type?: string
  placeholder?: string
  leftSection?: any
  rightSection?: any
  error?: boolean
}

const Input: FC<InputProps> = memo(
  ({
    label,
    placeholder,
    name,
    autoComplete,
    required,
    onChange,
    error,
    errorMsg,
    value,
    readOnly,
    validation,
    autoFocus,
    className,
    type,
    leftSection,
    rightSection,
  }) => {
    const [inputValue, setInputValue] = useState<string>(value)
    const [debouncing, setDebouncing] = useState(false)
    const [errorState, setErrorState] = useState<boolean>(error || false)

    useEffect(() => {
      if (error && error !== errorState) {
        setErrorState(error)
      }
    }, [error, errorState])

    const debounceSave = useDebounce(
      ((target: React.ChangeEvent<HTMLInputElement>['target']) => {
        onChange({ payload: { target: target } })
        setDebouncing(false)
      }) as UseDebounceCallback,
      0.3 * 1000
    ) // every 3 seconds max

    useEffect(() => {
      if (value !== inputValue && !debouncing) {
        setInputValue(value)
        setErrorState(false)
      }
    }, [debouncing, debounceSave, inputValue, value, name])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setErrorState(false)
      setInputValue(e.target.value)

      if (validation) {
        if (validation === 'num') {
          if (
            NUM_REGEX.test(e.target.value) === false &&
            e.target.value !== ''
          ) {
            setErrorState(true)
          } else {
            setErrorState(false)
          }
        } else if (validation === 'cur') {
          if (
            CUR_REGEX.test(e.target.value) === false &&
            e.target.value !== ''
          ) {
            setErrorState(true)
          } else {
            setErrorState(false)
          }
        }
      }
      setDebouncing(true)
      debounceSave(e.target)
    }

    const content = (
      <div
        className={clsx(input_wrapper, {
          [`${className}`]: className,
        })}
      >
        {label && (
          <label className={input_label}>
            {label}
            {required && <span className={input_label_required}>*</span>}
          </label>
        )}
        <div
          className={clsx(input_container, { [invalid]: errorState === true })}
        >
          {leftSection && (
            <div className={input_left_section}>{leftSection}</div>
          )}
          <input
            placeholder={placeholder}
            name={name}
            type={type}
            className={input}
            required={required}
            autoFocus={autoFocus}
            autoComplete={autoComplete ?? 'off'}
            readOnly={readOnly}
            value={inputValue ?? ''}
            onChange={(e: any) => handleChange(e)}
            tabIndex={0}
          />
          {rightSection && (
            <div className={input_right_section}>{rightSection}</div>
          )}
        </div>
        {errorState && <p className={input_error_message}>{errorMsg}</p>}
      </div>
    )

    return content
  }
)

Input.displayName = 'Input'

export default Input
