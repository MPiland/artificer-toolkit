import { create } from 'zustand'
import { persist, type StorageValue } from 'zustand/middleware'
import type { FeatureInput } from '@/types'
import type { DeepKeys } from '@tanstack/react-form'
import { updateField, removeField } from './utils'
import { SECTION_STEPS } from '@/components/Form'

export interface FeatureStore {
  current: FeatureInput | null
  step: (typeof SECTION_STEPS)[number] | 'options' | 'features' | null
  added: Map<string, FeatureInput>
  edited: Map<string, FeatureInput>
  valid: Map<string, boolean>
  removed: Set<string>
  formReset: () => void
  registerFormReset: (reset: () => void) => void
  setCurrent: (arg: FeatureInput | null) => void
  upsertAdded: (arg: FeatureInput) => void
  upsertEdited: (arg: FeatureInput) => void
  upsertValid: (arg: string, isValid: boolean) => void
  remove: (id: string) => void
  setStep: (arg: (typeof SECTION_STEPS)[number] | 'options' | 'features' | null) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
  reset: () => void
}

export const useFeatureStore = create<FeatureStore>()(
  persist(
    (set) => {
      return {
        current: null,
        step: null,
        added: new Map<string, FeatureInput>(),
        edited: new Map<string, FeatureInput>(),
        valid: new Map<string, boolean>(),
        removed: new Set<string>(),
        formReset: () => undefined,
        registerFormReset: (reset) => set((state) => ({ ...state, formReset: reset })),
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
        setStep: (value) =>
          set((state) => ({
            ...state,
            step: value,
          })),
        updateField: ({ path, value }) =>
          set((state: FeatureStore) =>
            updateField<FeatureStore, FeatureInput>({
              path,
              value,
              selector: (state) => state.current as FeatureInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: FeatureStore) =>
            removeField<FeatureStore, FeatureInput>({
              path,
              selector: (state) => state.current as FeatureInput,
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
      name: 'atapp-Feature-store',
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
        setItem: (name, newValue: StorageValue<FeatureStore>) => {
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
