import { useState, useCallback, type ReactNode } from 'react'
import { FieldContext, TextField, DropdownField, RichTextField } from '~/components/Form'
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

type Validator<T> = (arg: { value: T | undefined | null }) => ZodString | ZodNumber | string | undefined
type Listener<T> = (arg: { value: T | undefined | null; name: string }) => void

const inputFields = {
  TextField,
  DropdownField,
  RichTextField,
}

const useFormField = <TFormState extends { current: Record<string, unknown> | null }>({
  store,
}: {
  store: UseBoundStore<StoreApi<TFormState>>
}) => {
  type TForm = TFormState['current']
  type TField = Extract<Paths<TForm, { maxRecursionDepth: 14; bracketNotation: true }>, string>

  // Generic field component props for intellisense
  interface FieldComponentProps<TName extends TField, TMode extends 'array' | undefined = undefined> {
    name: TName
    mode?: TMode
    validators?: {
      onBlur?: Validator<Get<TForm, TName>>
      onChange?: Validator<Get<TForm, TName>>
    }
    listeners?: {
      onChange?: Listener<Get<TForm, TName>>
      onBlur?: Listener<Get<TForm, TName>>
    }
    children: (fields: typeof inputFields & FieldContextValue<Get<TForm, TName> | undefined | null, TMode>) => ReactNode
  }

  // Generic field component type alias
  type FieldComponent = <TName extends TField, TMode extends 'array' | undefined = undefined>(
    props: FieldComponentProps<TName, TMode>
  ) => ReactNode

  const AppField: FieldComponent = (props) => {
    const { name, validators, listeners, children, mode } = props
    type TFieldValue = Get<TForm, typeof name>

    const [value, setValue] = useState<TFieldValue | undefined | null>(
      store((state) => get(state.current, name)) as TFieldValue | undefined | null
    )
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

export default useFormField
