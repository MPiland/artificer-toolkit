import { create } from 'zustand'
import type { AncestryOptionInput } from '@/types'
import { persist, type StorageValue } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'
import { set as lSet } from 'lodash'

export interface AncestryOptionStore {
  current: AncestryOptionInput | null
  added: Map<string, AncestryOptionInput>
  edited: Map<string, AncestryOptionInput>
  removed: Set<string>
  valid: Map<string, boolean>
  optionIndex: number
  step: 'ancestryOption' | null
  fieldValidation?: Record<string, boolean>
  defaultValues?: Partial<AncestryOptionInput>
  formReset: (values?: Partial<AncestryOptionInput>) => void
  resetFormFields: () => void
  registerForm: (reset: () => void) => void
  updateDefaultValues: ({ path, value }: { path: string; value: unknown }) => void
  setFieldValidation: (args: { fieldName: string; isValid: boolean }) => void
  setStep: (arg: 'ancestryOption' | null) => void
  setOptionIndex: (arg: number) => void
  setCurrent: (arg: AncestryOptionInput | null) => void
  upsertAdded: (arg: AncestryOptionInput) => void
  upsertEdited: (arg: AncestryOptionInput) => void
  upsertValid: (arg: string, isValid: boolean) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
  reset: () => void
}

export const useAncestryOptionStore = create<AncestryOptionStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, AncestryOptionInput>(),
        edited: new Map<string, AncestryOptionInput>(),
        valid: new Map<string, boolean>(),
        removed: new Set<string>(),
        step: null,
        fieldValidation: undefined,
        defaultValues: undefined,
        formReset: () => undefined,
        resetFormFields: () =>
          set((state) => {
            const values = state.defaultValues
            const newCurrentState = { ...state.current, ...values }
            state.formReset(newCurrentState)
            return {
              ...state,
              current: newCurrentState as AncestryOptionInput,
            }
          }),
        setFieldValidation: ({ fieldName, isValid }) =>
          set((state) => ({
            ...state,
            fieldValidation: { ...state.fieldValidation, [fieldName]: isValid },
          })),
        updateDefaultValues: ({ path, value }) =>
          set((state) => {
            const defaultValues = { ...state.defaultValues }
            lSet(defaultValues, path, value)
            return { ...state, defaultValues }
          }),
        registerForm: (reset) => set((state) => ({ ...state, formReset: reset })),
        setStep: (value) => set((state) => ({ ...state, step: value })),
        optionIndex: 0,
        setOptionIndex: (value) => set((state) => ({ ...state, optionIndex: value })),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        upsertAdded: (feature) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(feature.id, feature)
            return { added: newMap }
          }),
        upsertEdited: (feature) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(feature.id, feature)
            return { edited: newMap }
          }),
        upsertValid: (id: string, isValid: boolean) =>
          set((state) => {
            const newMap = new Map(state.valid)
            newMap.set(id, isValid)
            return { valid: newMap }
          }),
        remove: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        updateField: ({ path, value }) =>
          set((state: AncestryOptionStore) =>
            updateField<AncestryOptionStore, AncestryOptionInput>({
              path,
              value,
              selector: (state) => state.current as AncestryOptionInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: AncestryOptionStore) =>
            removeField<AncestryOptionStore, AncestryOptionInput>({
              path,
              selector: (state) => state.current as AncestryOptionInput,
            })(state)
          ),
        reset: () =>
          set((state) => ({
            ...state,
            current: null,
            step: null,
            added: new Map(),
            edited: new Map(),
            valid: new Map(),
            removed: new Set(),
            formReset: () => undefined,
          })),
      }
    },
    {
      name: 'atapp-ancestry-store',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const existingValue = JSON.parse(str)
          return {
            ...existingValue,
            state: {
              ...existingValue.state,
              added: new Map(existingValue.state.added),
              edited: new Map(existingValue.state.edited),
              valid: new Map(existingValue.state.valid),
              removed: new Set(existingValue.state.removed),
            },
          }
        },
        setItem: (name, newValue: StorageValue<AncestryOptionStore>) => {
          const str = JSON.stringify({
            ...newValue,
            state: {
              ...newValue.state,
              added: Array.from(newValue.state.added.entries()),
              edited: Array.from(newValue.state.edited.entries()),
              valid: Array.from(newValue.state.valid.entries()),
              removed: Array.from(newValue.state.removed.values()),
            },
          })
          localStorage.setItem(name, str)
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)
