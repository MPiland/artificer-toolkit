import { StateCreator } from 'zustand'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'
import { FeatureOption } from '../../amplify/gql/types'
import { DeepKeyOf } from '../types/form'
import { produce } from 'immer'

export interface OptionSlice {
  optionData: FeatureOption
  optionIndex: number
  initialOptionData: FeatureOption
  updateOptionField: (arg: { path: DeepKeyOf<FeatureOption>; value: any }) => void
  addOptionField: (arg: { path: DeepKeyOf<FeatureOption>; value?: any }) => void
  removeOptionField: (arg: { path: DeepKeyOf<FeatureOption> }) => void
  optionReset: (arg: { value: FeatureOption }) => void
  initialOptionReset: (arg: { value: FeatureOption }) => void
  updateOptionIndex: (arg: { value: number }) => void
  resetOption: () => void
}

export const optionSlice: StateCreator<CombinedSlice, [], [], OptionSlice> = (set) => {
  const defaultState: Pick<OptionSlice, 'optionData' | 'initialOptionData' | 'optionIndex'> = {
    optionData: { id: undefined, value: undefined, label: undefined, __typename: undefined },

    initialOptionData: { id: undefined, value: undefined, label: undefined, __typename: undefined },

    optionIndex: 0,
  }

  return {
    ...defaultState,

    addOptionField: ({ path, value }) =>
      set((state) => addField({ path, value, selector: (state) => state.optionData })(state)),

    removeOptionField: ({ path }) =>
      set((state) => removeField({ path, selector: (state) => state.optionData })(state)),

    updateOptionField: ({ path, value }) =>
      set((state) => updateField({ path, value, selector: (state) => state.optionData })(state)),

    optionReset: ({ value }) => set((state) => reset({ value, selector: (state) => state.optionData })(state)),

    initialOptionReset: ({ value }) =>
      set((state) => reset({ value, selector: (state) => state.initialOptionData })(state)),

    updateOptionIndex: ({ value }) =>
      set((state) =>
        produce(state, (draft) => {
          draft.optionIndex = value
        })
      ),

    resetOption: () =>
      set((state) => ({
        ...state,
        optionData: defaultState.optionData,
        initialOptionData: defaultState.initialOptionData,
        optionIndex: defaultState.optionIndex,
      })),
  }
}
