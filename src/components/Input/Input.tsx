import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  memo,
} from 'react'
import {
  input_wrapper,
  input_label,
  input_container,
  input_left_section,
  input_right_section,
  input,
} from './Input.css'
import { ReducerActionType } from '../../utils/types'
import clsx from 'clsx'
import { useDebounceCallback } from 'usehooks-ts'
import Tooltip from '../Tooltip/Tooltip'

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
  id?: string
}

const Input = memo(
  ({
    label,
    placeholder,
    name,
    autoComplete,
    required,
    onChange,
    errorMsg,
    value,
    readOnly,
    validation,
    autoFocus,
    className,
    type,
    leftSection,
    rightSection,
    id,
  }: InputProps) => {
    const [inputValue, setInputValue] = useState<string>(value ?? '')
    const [debouncing, setDebouncing] = useState(false)
    const [error, setError] = useState<boolean>(false)

    const inputRef = useRef<HTMLInputElement | null>(null)
    useEffect(() => {
      const input = inputRef.current
      if (input) {
        input.addEventListener('setErrorState', (e: any) => setError(e.detail))

        return () =>
          input.removeEventListener('setErrorState', (e: any) =>
            setError(e.detail)
          )
      }
    }, [])

    useLayoutEffect(() => {
      if (value !== inputValue && !debouncing) {
        setError(false)
        setInputValue(value)
      }
    }, [inputValue, value, debouncing])

    const debounceSave = useDebounceCallback(
      useCallback(
        (target: React.ChangeEvent<HTMLInputElement>['target']) => {
          onChange({ target: { name: name, value: target.value } })
          setDebouncing(false)
        },
        [onChange, name]
      ),
      0.3 * 1000
    ) // every 3 seconds max

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        debounceSave.cancel()
        const target = e.target
        setInputValue(target.value)

        if (validation) {
          if (validation === 'num') {
            if (NUM_REGEX.test(target.value) === false && target.value !== '') {
              setError(true)
            } else {
              setError(false)
            }
          } else if (validation === 'cur') {
            if (CUR_REGEX.test(target.value) === false && target.value !== '') {
              setError(true)
            } else {
              setError(false)
            }
          }
        }
        setError(false)
        setDebouncing(true)
        debounceSave(target)
      },
      [debounceSave, validation]
    )

    useEffect(() => {
      if (value === '' && inputValue === '' && !debouncing) {
        onChange({ type: 'removed', target: { name: name } })
        onChange({ type: 'removed', target: { name: 'name' } })
      }
    }, [inputValue, value, name, onChange, debouncing])

    const content = (
      <Tooltip
        className={clsx(input_wrapper, {
          [`${className}`]: className,
        })}
        error={error}
        errorMsg={errorMsg}
      >
        {label && (
          <label
            className={clsx(input_label, { ['required']: required })}
            htmlFor={id ?? name}
          >
            {label}
          </label>
        )}
        <div className={clsx(input_container)}>
          {leftSection && (
            <div className={input_left_section}>{leftSection}</div>
          )}
          <input
            placeholder={placeholder}
            name={name}
            type={type}
            className={clsx(input, { ['invalid']: error })}
            required={required}
            autoFocus={autoFocus}
            autoComplete={autoComplete ?? 'off'}
            readOnly={readOnly}
            value={inputValue ?? ''}
            onChange={(e: any) => handleChange(e)}
            tabIndex={0}
            ref={inputRef}
            id={id ?? name}
            data-atapp-validation={validation}
          />
          {rightSection && (
            <div className={input_right_section}>{rightSection}</div>
          )}
        </div>
      </Tooltip>
    )
    return content
  }
)

Input.displayName = 'Input'

export default Input
