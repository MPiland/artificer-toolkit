import { createContext, Dispatch } from 'react'
import { FormContext, ReducerActionType } from '../../utils/types'

interface FormStepsContextProps {
  context: FormContext
  stepName: string
  setStepName: (arg: string) => void
  setContext: (arg: { title: string; type: string }) => void
  formState: any
  setFormState: (arg: ReducerActionType) => void
  oldFormState: any
  setOldFormState: (arg: any) => void
  saving: boolean
  setSaving: (arg: boolean) => void
  stepIndex: number
  setStepIndex: (arg: number) => void
  isFirstStep: boolean
  setIsFirstStep: (arg: boolean) => void
  isLastStep: boolean
  setIsLastStep: (arg: boolean) => void
  successMessage: string | null
  setSuccessMessage: (arg: string | null) => void
  errorMessage: string | null
  setErrorMessage: (arg: string | null) => void
  validForm: { [key: string]: boolean }
  setValidForm: (arg: { [key: string]: boolean }) => void
  selectedClass: []
  setSelectedClass: (arg: any[]) => void
  addClass: boolean
  setAddClass: (arg: boolean) => void
  selectedRace: any
  setSelectedRace: (arg: any) => void
  changeRace: boolean
  setChangeRace: (arg: boolean) => void
  handleSave: () => void
  handleUpdateFeature: () => void
  handleReset: () => void
  featureStepName: string
  setFeatureStepName: (arg: string) => void
  featureContext: string
  setFeatureContext: (arg: string) => void
  sectionName: string
  setSectionName: (arg: string) => void
  setSectionState: (arg: ReducerActionType) => void
  setOldSectionState: (arg: any) => void
  setSectionIndex: (arg: number) => void
  featureState: any
  setFeatureState: (arg: ReducerActionType) => void
  oldFeatureState: any
  setOldFeatureState: (arg: any) => void
  featureIndex: number
  setFeatureIndex: (arg: number) => void
  optionState: any
  setOptionState: (arg: ReducerActionType) => void
  oldOptionState: any
  setOldOptionState: (arg: any) => void
  optionIndex: number
  setOptionIndex: (arg: number) => void
  sectionState: any
  oldSectionState: any
  sectionIndex: number
  subFeatureState: any
  setSubFeatureState: (arg: ReducerActionType) => void
  oldSubFeatureState: any
  setOldSubFeatureState: (arg: any) => void
  subFeatureIndex: number
  setSubFeatureIndex: (arg: number) => void
  formSteps: any[]
  filteredSteps: any[]
}

export const FormStepsContext = createContext<FormStepsContextProps>({
  context: { title: undefined, type: undefined },
  stepName: '',
  setStepName: () => {},
  setContext: () => {},
  formState: {}, // Initial form state
  setFormState: (() => {}) as Dispatch<any>, // Placeholder function
  oldFormState: {}, // Initial old form state
  setOldFormState: () => {}, // Placeholder function
  saving: false, // Whether the form is currently saving
  setSaving: () => {}, // Placeholder function
  stepIndex: 0, // Initial step index
  setStepIndex: () => {}, // Placeholder function
  isFirstStep: false, // Whether the current step is the first step
  setIsFirstStep: () => {}, // Placeholder function
  isLastStep: false, // Whether the current step is the last step
  setIsLastStep: () => {}, // Placeholder function
  successMessage: '', // Success message, initially null
  setSuccessMessage: () => {}, // Placeholder function
  errorMessage: '', // Error message, initially null
  setErrorMessage: () => {}, // Placeholder function
  validForm: {}, // Initial form validation status
  setValidForm: () => {}, // Placeholder function
  selectedClass: [], // Initial selected class, empty array
  setSelectedClass: () => {}, // Placeholder function
  addClass: false, // Whether to add a class
  setAddClass: () => {}, // Placeholder function
  selectedRace: '', // Initial selected race, null
  setSelectedRace: () => {}, // Placeholder function
  changeRace: false, // Whether to change race
  setChangeRace: () => {}, // Placeholder function
  handleSave: () => {}, // Placeholder function for saving form
  handleUpdateFeature: () => {}, // Placeholder function for updating features
  handleReset: () => {}, // Placeholder function for resetting form
  featureStepName: '', // Initial feature step name
  setFeatureStepName: () => {}, // Placeholder function
  featureContext: '', // Initial feature context
  setFeatureContext: () => {}, // Placeholder function
  sectionName: '', // Initial section name
  setSectionName: () => {}, // Placeholder function
  setSectionState: (() => {}) as Dispatch<any>, // Placeholder function
  setOldSectionState: () => {}, // Placeholder function
  setSectionIndex: () => {}, // Placeholder function
  featureState: {}, // Initial feature state
  setFeatureState: (() => {}) as Dispatch<any>, // Placeholder function
  oldFeatureState: {}, // Initial old feature state
  setOldFeatureState: () => {}, // Placeholder function
  featureIndex: 0, // Initial feature index
  setFeatureIndex: () => {}, // Placeholder function
  optionState: {}, // Initial option state
  setOptionState: (() => {}) as Dispatch<any>, // Placeholder function
  oldOptionState: {}, // Initial old option state
  setOldOptionState: () => {}, // Placeholder function
  optionIndex: 0, // Initial option index
  setOptionIndex: () => {}, // Placeholder function
  sectionState: {}, // Initial section state
  oldSectionState: {}, // Initial old section state
  sectionIndex: 0, // Initial section index
  subFeatureState: (() => {}) as Dispatch<any>, // Initial sub-feature state
  setSubFeatureState: () => {}, // Placeholder function
  oldSubFeatureState: {}, // Initial old sub-feature state
  setOldSubFeatureState: () => {}, // Placeholder function
  subFeatureIndex: 0, // Initial sub-feature index
  setSubFeatureIndex: () => {},
  formSteps: [],
  filteredSteps: [],
})
