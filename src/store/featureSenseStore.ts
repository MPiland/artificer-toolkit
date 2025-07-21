import { create } from 'zustand'
import type { FeatureSenseInput } from '@/types'
import { persist, type StorageValue } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'
import { set as lSet } from 'lodash'

export interface FeatureSenseStore {
  current: FeatureSenseInput | null
  added: Map<string, FeatureSenseInput>
  edited: Map<string, FeatureSenseInput>
  valid: Map<string, boolean>
  removed: Set<string>
  fieldValidation?: Record<string, boolean>
  defaultValues?: Partial<FeatureSenseInput>
  formReset: (values?: Partial<FeatureSenseInput>) => void
  resetFormFields: () => void
  registerForm: (reset: () => void) => void
  updateDefaultValues: ({ path, value }: { path: string; value: unknown }) => void
  setFieldValidation: (args: { fieldName: string; isValid: boolean }) => void
  setCurrent: (arg: FeatureSenseInput | null) => void
  upsertAdded: (arg: FeatureSenseInput) => void
  upsertEdited: (arg: FeatureSenseInput) => void
  upsertValid: (arg: string, isValid: boolean) => void
  removeSense: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
  reset: () => void
}

export const useFeatureSenseStore = create<FeatureSenseStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureSenseInput>(),
        edited: new Map<string, FeatureSenseInput>(),
        valid: new Map<string, boolean>(),
        removed: new Set<string>(),
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
              current: newCurrentState as FeatureSenseInput,
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
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        registerForm: (reset) => set((state) => ({ ...state, formReset: reset })),
        upsertAdded: (sense) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(sense.id, sense)
            return { added: newMap }
          }),
        upsertEdited: (sense) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(sense.id, sense)
            return { edited: newMap }
          }),
        upsertValid: (id: string, isValid: boolean) =>
          set((state) => {
            const newMap = new Map(state.valid)
            newMap.set(id, isValid)
            return { valid: newMap }
          }),
        removeSense: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        updateField: ({ path, value }) =>
          set((state: FeatureSenseStore) =>
            updateField<FeatureSenseStore, FeatureSenseInput>({
              path,
              value,
              selector: (state) => state.current as FeatureSenseInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: FeatureSenseStore) =>
            removeField<FeatureSenseStore, FeatureSenseInput>({
              path,
              selector: (state) => state.current as FeatureSenseInput,
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
      name: 'atapp-feature-sense-store',
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
        setItem: (name, newValue: StorageValue<FeatureSenseStore>) => {
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
