import { StateCreator } from 'zustand'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'
import { DeepKeyOf, SectionDataType, SectionName } from '../types/form'
import { produce } from 'immer'

export interface SectionSlice {
  // Core section data
  sectionData: SectionDataType
  initialSectionData: SectionDataType

  // Section UI state
  sectionIndex: number
  sectionStep: SectionName | null

  updateSectionField: (arg: { path: DeepKeyOf<SectionDataType>; value: any }) => void
  addSectionField: (arg: { path: DeepKeyOf<SectionDataType>; value?: any }) => void
  removeSectionField: (arg: { path: DeepKeyOf<SectionDataType> }) => void
  sectionReset: (arg: { value: SectionDataType }) => void
  initialSectionReset: (arg: { value: SectionDataType }) => void
  updateSectionIndex: (arg: { value: number }) => void
  setSectionStep: (arg: SectionName | null) => void
  resetSection: () => void
}

export const sectionSlice: StateCreator<CombinedSlice, [], [], SectionSlice> = (set) => {
  const defaultState: Pick<SectionSlice, 'sectionData' | 'initialSectionData' | 'sectionIndex' | 'sectionStep'> = {
    sectionData: { id: '', __typename: 'FeatureSense' },
    initialSectionData: { id: '', __typename: 'FeatureSense' },
    sectionIndex: 0,
    sectionStep: null,
  }

  return {
    ...defaultState,

    addSectionField: ({ path, value }) =>
      set((state) => addField({ path, value, selector: (state) => state.sectionData })(state)),

    removeSectionField: ({ path }) =>
      set((state) => removeField({ path, selector: (state) => state.sectionData })(state)),

    updateSectionField: ({ path, value }) =>
      set((state) => updateField({ path, value, selector: (state) => state.sectionData })(state)),

    sectionReset: ({ value }) => set((state) => reset({ value, selector: (state) => state.sectionData })(state)),

    initialSectionReset: ({ value }) =>
      set((state) => reset({ value, selector: (state) => state.initialSectionData })(state)),

    updateSectionIndex: ({ value }) =>
      set((state) =>
        produce(state, (draft) => {
          draft.sectionIndex = value
        })
      ),

    setSectionStep: (value) =>
      set((state) =>
        produce(state, (draft) => {
          draft.sectionStep = value
        })
      ),

    resetSection: () =>
      set(() => ({
        sectionData: defaultState.sectionData,
        initialSectionData: defaultState.initialSectionData,
        sectionIndex: defaultState.sectionIndex,
        sectionStep: defaultState.sectionStep,
      })),
  }
}
