import { StateCreator } from 'zustand'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'
import { AncestryOption } from '../../amplify/gql/types'
import { DeepKeyOf } from '../types/form'
import { produce } from 'immer'

export interface AncestrySlice {
  ancestryData: AncestryOption
  ancestryIndex: number
  initialAncestryData: AncestryOption
  updateAncestryField: (arg: { path: DeepKeyOf<AncestryOption>; value: any }) => void
  addAncestryField: (arg: { path: DeepKeyOf<AncestryOption>; value?: any }) => void
  removeAncestryField: (arg: { path: DeepKeyOf<AncestryOption> }) => void
  ancestryReset: (arg: { value: AncestryOption }) => void
  initialAncestryReset: (arg: { value: AncestryOption }) => void
  updateAncestryIndex: (arg: { value: number }) => void
  resetAncestry: () => void
}

export const ancestrySlice: StateCreator<CombinedSlice, [], [], AncestrySlice> = (set) => {
  const defaultState: Pick<AncestrySlice, 'ancestryData' | 'initialAncestryData' | 'ancestryIndex'> = {
    ancestryData: { id: undefined, value: undefined, label: undefined, __typename: 'AncestryOption' },

    initialAncestryData: { id: undefined, value: undefined, label: undefined, __typename: 'AncestryOption' },

    ancestryIndex: 0,
  }
  return {
    ...defaultState,

    addAncestryField: ({ path, value }) =>
      set((state) => addField({ path, value, selector: (state) => state.ancestryData })(state)),

    removeAncestryField: ({ path }) =>
      set((state) => removeField({ path, selector: (state) => state.ancestryData })(state)),

    updateAncestryField: ({ path, value }) =>
      set((state) => updateField({ path, value, selector: (state) => state.ancestryData })(state)),

    ancestryReset: ({ value }) => set((state) => reset({ value, selector: (state) => state.ancestryData })(state)),

    initialAncestryReset: ({ value }) =>
      set((state) => reset({ value, selector: (state) => state.initialAncestryData })(state)),

    updateAncestryIndex: ({ value }) =>
      set((state) =>
        produce(state, (draft) => {
          draft.ancestryIndex = value
        })
      ),

    resetAncestry: () =>
      set((state) => ({
        ...state,
        ancestryData: { ...defaultState.ancestryData },
        initialAncestryData: {
          ...defaultState.initialAncestryData,
        },
        ancestryIndex: defaultState.ancestryIndex,
      })),
  }
}
