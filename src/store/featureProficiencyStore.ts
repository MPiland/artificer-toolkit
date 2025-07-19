import { create } from 'zustand'
import type { FeatureProficiencyInput } from '@/types'
import { persist, type StorageValue } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface FeatureProficiencyStore {
  current: FeatureProficiencyInput | null
  added: Map<string, FeatureProficiencyInput>
  edited: Map<string, FeatureProficiencyInput>
  valid: Map<string, boolean>
  removed: Set<string>
  formReset: (() => void) | null
  registerFormReset: (reset: () => void) => void
  setCurrent: (arg: FeatureProficiencyInput | null) => void
  upsertAdded: (arg: FeatureProficiencyInput) => void
  upsertEdited: (arg: FeatureProficiencyInput) => void
  upsertValid: (arg: string, isValid: boolean) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
  reset: () => void
}

export const useFeatureProficiencyStore = create<FeatureProficiencyStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureProficiencyInput>(),
        edited: new Map<string, FeatureProficiencyInput>(),
        valid: new Map<string, boolean>(),
        removed: new Set<string>(),
        formReset: null,
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        registerFormReset: (value) => set((state) => ({ ...state, formReset: value })),
        upsertAdded: (proficiency) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(proficiency.id, proficiency)
            return { added: newMap }
          }),
        upsertEdited: (proficiency) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(proficiency.id, proficiency)
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
          set((state: FeatureProficiencyStore) =>
            updateField<FeatureProficiencyStore, FeatureProficiencyInput>({
              path,
              value,
              selector: (state) => state.current as FeatureProficiencyInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: FeatureProficiencyStore) =>
            removeField<FeatureProficiencyStore, FeatureProficiencyInput>({
              path,
              selector: (state) => state.current as FeatureProficiencyInput,
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
      name: 'atapp-feature-proficiency-store',
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
        setItem: (name, newValue: StorageValue<FeatureProficiencyStore>) => {
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
