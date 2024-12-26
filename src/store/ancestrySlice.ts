import { StateCreator } from 'zustand'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'
import { AncestryFeature } from '../../amplify/API'
import { DeepKeyOf } from '../types/form'
import { produce } from 'immer'

export interface AncestrySlice {
  ancestryData: AncestryFeature
  ancestryIndex: number
  initialAncestryData: AncestryFeature
  updateAncestryField: (arg: { path: DeepKeyOf<AncestryFeature>; value: any }) => void
  addAncestryField: (arg: { path: DeepKeyOf<AncestryFeature>; value?: any }) => void
  removeAncestryField: (arg: { path: DeepKeyOf<AncestryFeature> }) => void
  ancestryReset: (arg: { value: AncestryFeature }) => void
  initialAncestryReset: (arg: { value: AncestryFeature }) => void
  updateAncestryIndex: (arg: { value: number }) => void
}

export const ancestrySlice: StateCreator<CombinedSlice, [], [], AncestrySlice> = (set) => ({
  ancestryData: { id: undefined, value: undefined, label: undefined, __typename: undefined },

  initialAncestryData: { id: undefined, value: undefined, label: undefined, __typename: undefined },

  ancestryIndex: 0,

  addAncestryField: ({ path, value }) =>
    set((state) => addField({ path, value, selector: (state) => state.ancestryData })(state)),

  removeAncestryField: ({ path }) =>
    set((state) => removeField({ path, selector: (state) => state.ancestryData })(state)),

  updateAncestryField: ({ path, value }) =>
    set((state) => updateField({ path, value, selector: (state) => state.ancestryData })(state)),

  ancestryReset: ({ value }) => set((state) => reset({ value, selector: (state) => state.ancestryData })(state)),

  initialAncestryReset: ({ value }) =>
    set((state) => reset({ value, selector: (state) => state.initialSubfeatureData })(state)),

  updateAncestryIndex: ({ value }) =>
    set((state) =>
      produce(state, (draft) => {
        draft.ancestryIndex = value
      })
    ),
})
