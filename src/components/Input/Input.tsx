import { useState, useEffect, useCallback, useRef, useLayoutEffect, RefObject } from 'react'
import {
  input_wrapper,
  input_label,
  input_container,
  input_endAdornment,
  input,
  input_height,
  input_border,
  input_textAlign,
} from './Input.css'
import clsx from 'clsx'
import { useDebounceCallback, useEventListener } from 'usehooks-ts'
import Floating from '../Floating/Floating'
import { DeepKeyOf, UpdateState } from '../../types/form'

const NUM_REGEX = /^(\d+)(, ?\d+)*(,)?$/
const CUR_REGEX = /^\d*\.?\d*$/
const DIE_REGEX = /^(\d+)d(4|6|8|10|12|20|100)?$/
const ROLL_CONFIG_REGEX = /^(\d+)d(4|6|8|10|12|20|100)(?:(kh|kl)(\d+))?(dh|dl)?(\d+)?(?:(r|ro)([><=])?(\d+))?$/

interface InputProps<T> {
  label?: string | boolean
  autoComplete?: string
  required?: boolean
  errorMsg?: string
  onChange?: (state: UpdateState<T>) => void
  value: any | null
  readOnly?: boolean
  validation?: 'num' | 'cur' | 'die' | 'user' | 'pwd' | 'roll' | 'dmg'
  autoFocus?: boolean
  className?: string | number | symbol | any
  type?: string
  placeholder?: string
  endAdornment?: any
  id?: string
  disabled?: boolean
  height?: 'full' | 'auto' | 'default'
  border?: 'none' | 'default'
  textAlign?: 'center'
  name: DeepKeyOf<T>
  ref?: RefObject<HTMLDivElement>
}

const Input = <T,>({
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
  endAdornment,
  id,
  disabled = false,
  height = 'default',
  border = 'default',
  textAlign,
  ref,
}: InputProps<T>) => {
  const [inputValue, setInputValue] = useState<string | number>(((value != null || value == 0) && value) || '')
  const [debouncing, setDebouncing] = useState(false)
  const [width, setWidth] = useState<number>(0)
  const [error, setError] = useState<boolean>(false)
  const [open, setOpen] = useState<boolean>(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const documentRef = useRef<Document>(document)

  useEffect(() => {
    const input = inputRef.current
    if (input) {
      setWidth(input.getBoundingClientRect().width)
    }
  }, [inputValue])

  useEffect(() => {
    const input = inputRef.current
    if (input) {
      input.addEventListener('setErrorState', (e: any) => {
        setError(e.detail)
        setOpen(e.detail)
      })

      return () => input.removeEventListener('setErrorState', (e: any) => setError(e.detail))
    }
  }, [])

  useLayoutEffect(() => {
    if (value !== inputValue && !debouncing) {
      setError(false)
      setInputValue(value)
    }
  }, [inputValue, value, debouncing])

  useEventListener('click', () => setOpen(false), documentRef)

  const debounceSave = useDebounceCallback(
    useCallback(
      (target: React.ChangeEvent<HTMLInputElement>['target']) => {
        onChange({ type: 'update', path: name, value: target.value })
        setDebouncing(false)
      },
      [name, onChange]
    ),
    0.3 * 1000
  ) // every 3 seconds max

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setOpen(false)
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
        } else if (validation === 'die') {
          if (DIE_REGEX.test(target.value) === false && target.value !== '') {
            setError(true)
          } else {
            setError(false)
          }
        } else if (validation === 'roll') {
          if (ROLL_CONFIG_REGEX.test(target.value) === false && target.value !== '') {
            setError(true)
          } else {
            setError(false)
          }
        } else {
          setError(false)
        }
      }
      setDebouncing(true)
      debounceSave(target)
    },
    [debounceSave, validation]
  )

  const content = (
    <Floating>
      <Floating.Anchor
        className={clsx(input_wrapper, {
          [`${className}`]: className,
        })}
      >
        {label && (
          <label className={clsx(input_label, { ['required']: required })} htmlFor={id || name}>
            {label}
          </label>
        )}
        <div
          className={clsx(
            input_container,
            input_height[height],
            input_border[border],
            { [input_textAlign[textAlign]]: textAlign != null },
            {
              ['invalid']: error,
            }
          )}
        >
          <input
            placeholder={placeholder}
            name={name}
            type={type}
            className={clsx(input, className)}
            required={required}
            autoFocus={autoFocus}
            autoComplete={autoComplete || 'off'}
            readOnly={readOnly}
            value={inputValue}
            onChange={(e: any) => handleChange(e)}
            tabIndex={0}
            ref={(el) => {
              inputRef.current = el
              if (ref) {
                ref.current = el
              }
            }}
            id={id || name}
            data-atapp-validation={validation}
            disabled={disabled}
          />
          {endAdornment && <div className={input_endAdornment}>{endAdornment}</div>}
        </div>
      </Floating.Anchor>
      {errorMsg && (
        <Floating.Tooltip
          className={'invalid'}
          boundary='form'
          open={open}
          onOpenChange={setOpen}
          showArrow={true}
          role='tooltip'
          style={{ width }}
        >
          {errorMsg}
        </Floating.Tooltip>
      )}
    </Floating>
  )
  return content
}

export default Input
