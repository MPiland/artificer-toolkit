import { useState, useCallback, type ReactNode } from 'react'
import { FieldContext, TextField, DropdownField, RichTextField } from '@components/Form'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { Get, Paths } from 'type-fest'
import { get } from 'lodash-es'
import { ZodError, ZodString, ZodNumber } from 'zod/v4'
export type ArrayElement<T> = T extends Array<infer U> ? U : never

// Base context for all fields
interface BaseFieldContextValue<T> {
  state: {
    value: T
    meta: {
      isValid: boolean
      errors: string[] | null
      isTouched: boolean
    }
  }
  name: string
  handleChange: (value: T) => void
  handleBlur: () => void
  setValue: (value: T | undefined | null) => void
}

// Conditional type based on mode
export interface FieldContextValue<T, TMode extends 'array' | undefined = undefined> extends BaseFieldContextValue<T> {
  insertValue: TMode extends 'array' ? (index: number, item: ArrayElement<T>) => void : never
  pushValue: TMode extends 'array' ? (item: ArrayElement<T>) => void : never
  removeValue: TMode extends 'array' ? (index: number) => void : never
  replaceValue: TMode extends 'array' ? (index: number, item: ArrayElement<T>) => void : never
}

type Validator<T> = (arg: { value: T | undefined | null }) =>
  | ZodString
  | ZodNumber
  | string
  | ZodError
  | null
  | undefined
type Listener<T> = (arg: { value: T | undefined | null; name: string }) => void

const inputFields = {
  TextField,
  DropdownField,
  RichTextField,
}

export function useFormField<TFormState extends { current: Record<string, unknown> | null } | undefined = undefined>({
  store,
}: {
  store?: UseBoundStore<StoreApi<TFormState>>
} = {}) {
  type HasStore = TFormState extends { current: unknown } ? true : false
  type TForm = HasStore extends true
    ? TFormState extends { current: infer T }
      ? T
      : never
    : Record<string, unknown>
  type TField = HasStore extends true
    ? Extract<Paths<TForm, { maxRecursionDepth: 14; bracketNotation: true }>, string>
    : string

  type FieldValue<TName extends TField> = HasStore extends true ? Get<TForm, TName> : unknown

  const AppField = <TName extends TField, TMode extends 'array' | undefined = undefined>(props: {
    name: TFormState extends undefined ? string : TName
    mode?: TMode
    validators?: {
      onBlur?: Validator<FieldValue<TName>>
      onChange?: Validator<FieldValue<TName>>
      onSubmit?: Validator<FieldValue<TName>>
    }
    listeners?: {
      onChange?: Listener<FieldValue<TName>>
      onBlur?: Listener<FieldValue<TName>>
    }
    children: (fields: typeof inputFields & FieldContextValue<FieldValue<TName> | undefined | null, TMode>) => ReactNode
  }) => {
    const { name, validators, listeners, children, mode } = props
    type TFieldValue = FieldValue<TName>

    const [value, setValue] = useState<TFieldValue | undefined | null>(() => {
      if (!store) return undefined
      return store((state) => get(state?.current, name)) as TFieldValue | undefined | null
    })
    const [error, setError] = useState<string[] | null>(null)
    const [touched, setTouched] = useState(false)

    const arrayHelpers = {
      insertValue: (index: number, item: ArrayElement<TFieldValue>) => {
        const copy = [...(value as ArrayElement<TFieldValue>[])]
        copy.splice(index, 0, item)
        setValue(copy as TFieldValue)
      },
      pushValue: (item: ArrayElement<TFieldValue>) => {
        setValue([...(value as ArrayElement<TFieldValue>[]), item] as TFieldValue)
      },
      removeValue: (index: number) => {
        const copy = [...(value as ArrayElement<TFieldValue>[])]
        copy.splice(index, 1)
        setValue(copy as TFieldValue)
      },
      replaceValue: (index: number, item: ArrayElement<TFieldValue>) => {
        const copy = [...(value as ArrayElement<TFieldValue>[])]
        copy[index] = item
        setValue(copy as TFieldValue)
      },
    }

    const fieldHelpers = {
      setValue: (value: TFieldValue | undefined | null) => {
        setValue(value)
      },
    }

    const runValidator = useCallback(
      ({ eventType, val }: { eventType: 'onBlur' | 'onChange'; val: TFieldValue | undefined | null }) => {
        const validator = eventType === 'onBlur' ? validators?.onBlur : validators?.onChange
        if (!validator) return null
        const result = validator({ value: val })
        if (typeof result === 'string') return result
        if (result instanceof ZodError) {
          // Join all error messages from the issues array
          return result.issues.map((issue) => issue.message)
        }
        return null
      },
      [validators]
    )

    const handleChange = useCallback(
      (newVal: TFieldValue | undefined | null) => {
        const err = runValidator({ eventType: 'onChange', val: newVal })
        if (err) {
          if (Array.isArray(err)) {
            setError((prev) => [...(prev || []), ...err])
          } else {
            setError((prev) => [...(prev || []), err])
          }
        }
        setValue(newVal)
        listeners?.onChange?.({
          value: newVal,
          name,
        })
      },
      [listeners, runValidator, name]
    )

    const handleBlur = useCallback(() => {
      setTouched(true)
      const err = runValidator({ eventType: 'onBlur', val: value })
      if (err) {
        if (Array.isArray(err)) {
          setError((prev) => [...(prev || []), ...err])
        } else {
          setError((prev) => [...(prev || []), err])
        }
      }
      listeners?.onBlur?.({
        value,
        name,
      })
    }, [listeners, runValidator, value, name])

    const contextValue = {
      name: name as string,
      state: {
        value,
        meta: {
          isValid: !error,
          errors: error,
          isTouched: touched,
        },
      },
      handleChange,
      handleBlur,
      setValue: fieldHelpers.setValue,
      // Conditionally add array helpers only when mode is 'array'
      ...(mode === 'array' ? arrayHelpers : {}),
    } as FieldContextValue<TFieldValue | undefined | null, typeof mode>

    return <FieldContext value={contextValue}>{children({ ...contextValue, ...inputFields })}</FieldContext>
  }

  return { AppField }
}
