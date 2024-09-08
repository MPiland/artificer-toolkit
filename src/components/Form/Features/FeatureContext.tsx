import { createContext, ReactElement } from 'react'
import { FeatureStepType, ReducerActionType, SectionNameType } from '../../../utils/types'

export interface FeatureContextProps {
  featureStateReset: () => Promise<void>
  subContext: FeatureStepType
  setSubContext: (arg: FeatureStepType) => void
  featureState: any
  setFeatureState: (arg: ReducerActionType) => void
  oldFeatureState: any
  setOldFeatureState: (arg: any) => void
  featureIndex: number
  setFeatureIndex: (arg: number) => void
  featureSteps: { [K in FeatureStepType]?: ReactElement }
  optionStateReset: () => Promise<void>
  optionState: any
  setOptionState: (arg: ReducerActionType) => void
  oldOptionState: any
  setOldOptionState: (arg: any) => void
  optionIndex: number
  setOptionIndex: (arg: number) => void
  sectionStateReset: () => Promise<void>
  sectionSteps: { [K in SectionNameType]?: ReactElement }
  sectionNames: SectionNameType[]
  sectionName: SectionNameType
  setSectionName: (arg: SectionNameType) => void
  sectionState: any
  setSectionState: (arg: ReducerActionType) => void
  oldSectionState: any
  setOldSectionState: (arg: any) => void
  sectionIndex: number
  setSectionIndex: (arg: number) => void
  subfeatureStateReset: () => Promise<void>
  subfeatureState: any
  setSubfeatureState: (arg: ReducerActionType) => void
  oldSubfeatureState: any
  setOldSubfeatureState: (arg: any) => void
  subfeatureIndex: number
  setSubfeatureIndex: (arg: number) => void
  handleSaveFeatures: (arg: { type: FeatureStepType; state: any }) => Promise<any>
}

export const FeatureContext = createContext<FeatureContextProps | undefined>(undefined)
