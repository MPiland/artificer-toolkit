import { StateCreator } from 'zustand'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'
import { DeepKeyOf, SectionDataType } from '../types/form'
import { produce } from 'immer'

export interface SectionSlice {
  sectionData: SectionDataType
  sectionIndex: number
  initialSectionData: SectionDataType
  updateSectionField: (arg: { path: DeepKeyOf<SectionDataType>; value: any }) => void
  addSectionField: (arg: { path: DeepKeyOf<SectionDataType>; value?: any }) => void
  removeSectionField: (arg: { path: DeepKeyOf<SectionDataType> }) => void
  sectionReset: (arg: { value: SectionDataType }) => void
  initialSectionReset: (arg: { value: SectionDataType }) => void
  updateSectionIndex: (arg: { value: number }) => void
}

export const sectionSlice: StateCreator<CombinedSlice, [], [], SectionSlice> = (set) => ({
  sectionData: { id: undefined, value: undefined, label: undefined, __typename: undefined },

  initialSectionData: { id: undefined, value: undefined, label: undefined, __typename: undefined },

  sectionIndex: 0,

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
})
