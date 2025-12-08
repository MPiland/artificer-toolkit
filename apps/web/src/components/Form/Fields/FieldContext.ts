import { createContext, useContext } from 'react'
import type { FieldContextValue } from 'src/hooks/useFormField'

// Store-agnostic context
const FieldContext = createContext<unknown>(undefined)

function useFieldContext<T>(): FieldContextValue<T> {
  const ctx = useContext(FieldContext)
  if (!ctx) throw new Error('useFieldContext must be used inside a FieldContext provider')
  return ctx as FieldContextValue<T>
}

export { FieldContext, useFieldContext }
