import { useState, useEffect, FC, useCallback } from 'react'
import {
  input_wrapper,
  input_label,
  input_error_message,
  input_container,
  invalid,
  input_left_section,
  input_right_section,
  input,
} from './Input.css'
import { ReducerActionType } from '../../utils/types'
import clsx from 'clsx'
import { useDebounceCallback } from 'usehooks-ts'

const NUM_REGEX = /^(\d+)(, ?\d+)*(,)?$/
const CUR_REGEX = /^\d*\.?\d*$/

interface InputProps {
  label?: string | boolean
  name: string
  autoComplete?: string
  required?: boolean
  errorMsg?: string
  onChange: (arg: ReducerActionType) => void
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

const Input: FC<InputProps> = ({
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
  const [inputValue, setInputValue] = useState<string>('')
  const [debouncing, setDebouncing] = useState(false)
  const [errorState, setErrorState] = useState<boolean>(error || false)

  useEffect(() => {
    if (error && error !== errorState) {
      setErrorState(error)
    }
  }, [error, errorState])

  useEffect(() => {
    if (value !== inputValue && !debouncing) {
      setInputValue(value)
      setErrorState(false)
    }
  }, [inputValue, value, debouncing])

  const debounceSave = useDebounceCallback(
    useCallback(
      (target: React.ChangeEvent<HTMLInputElement>['target']) => {
        onChange({ target: { name: target.name, value: target.value } })
        setDebouncing(false)
      },
      [onChange]
    ),
    0.3 * 1000
  ) // every 3 seconds max

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      debounceSave.cancel()
      const target = e.target
      setErrorState(false)
      setInputValue(target.value)

      if (validation) {
        if (validation === 'num') {
          if (NUM_REGEX.test(target.value) === false && target.value !== '') {
            setErrorState(true)
          } else {
            setErrorState(false)
          }
        } else if (validation === 'cur') {
          if (CUR_REGEX.test(target.value) === false && target.value !== '') {
            setErrorState(true)
          } else {
            setErrorState(false)
          }
        }
      }
      setDebouncing(true)
      debounceSave(target)
    },
    [debounceSave, validation]
  )

  const content = (
    <div
      className={clsx(input_wrapper, {
        [`${className}`]: className,
      })}
    >
      {label && (
        <label className={clsx(input_label, { ['required']: required })}>
          {label}
        </label>
      )}
      <div
        className={clsx(input_container, { [invalid]: errorState === true })}
      >
        {leftSection && <div className={input_left_section}>{leftSection}</div>}
        <input
          placeholder={placeholder}
          name={name}
          type={type}
          className={input}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
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

export default Input
