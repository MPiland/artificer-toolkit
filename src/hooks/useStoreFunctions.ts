import {
  useFormStore,
  useFeatureStore,
  useAncestryOptionStore,
  useFeatureOptionStore,
  useFeatureExpertiseStore,
  useFeatureSenseStore,
  useFeatureProficiencyStore,
  useFeatureModifierStore,
  useFeatureSpellStore,
  useFeatureFeatStore,
} from '@/store'

/**
 * Hook that returns all store functions without subscribing to state changes.
 * This prevents unnecessary re-renders while providing access to all store actions.
 */
export const useStoreFunctions = () => {
  // Form store functions
  const formFunctions = useFormStore((state) => ({
    setStepIndex: state.setStepIndex,
    setSaving: state.setSaving,
    updateField: state.updateField,
    setAddClass: state.setAddClass,
    setChangeRace: state.setChangeRace,
    resetStepFields: state.resetStepFields,
    setFieldValidation: state.setFieldValidation,
    updateDefaultValues: state.updateDefaultValues,
  }))

  // Feature store functions
  const featureFunctions = useFeatureStore((state) => ({
    setCurrent: state.setCurrent,
    upsertAdded: state.upsertAdded,
    upsertEdited: state.upsertEdited,
    setStep: state.setStep,
    updateField: state.updateField,
    resetFormFields: state.resetFormFields,
    setFieldValidation: state.setFieldValidation,
    updateDefaultValues: state.updateDefaultValues,
  }))

  // Ancestry option store functions
  const ancestryFunctions = useAncestryOptionStore((state) => ({
    setCurrent: state.setCurrent,
    upsertAdded: state.upsertAdded,
    upsertEdited: state.upsertEdited,
    setStep: state.setStep,
    updateField: state.updateField,
    upsertValid: state.upsertValid,
    resetFormFields: state.resetFormFields,
    setFieldValidation: state.setFieldValidation,
    updateDefaultValues: state.updateDefaultValues,
  }))

  // Feature option store functions
  const optionFunctions = useFeatureOptionStore((state) => ({
    setCurrent: state.setCurrent,
    upsertAdded: state.upsertAdded,
    upsertEdited: state.upsertEdited,
    updateField: state.updateField,
    upsertValid: state.upsertValid,
    resetFormFields: state.resetFormFields,
    setFieldValidation: state.setFieldValidation,
    updateDefaultValues: state.updateDefaultValues,
  }))

  // Feature expertise store functions
  const expertiseFunctions = useFeatureExpertiseStore((state) => ({
    setCurrent: state.setCurrent,
    updateField: state.updateField,
    upsertAdded: state.upsertAdded,
    upsertEdited: state.upsertEdited,
    upsertValid: state.upsertValid,
    resetFormFields: state.resetFormFields,
    setFieldValidation: state.setFieldValidation,
    updateDefaultValues: state.updateDefaultValues,
  }))

  // Feature sense store functions
  const senseFunctions = useFeatureSenseStore((state) => ({
    setCurrent: state.setCurrent,
    updateField: state.updateField,
    upsertAdded: state.upsertAdded,
    upsertEdited: state.upsertEdited,
    upsertValid: state.upsertValid,
    resetFormFields: state.resetFormFields,
    setFieldValidation: state.setFieldValidation,
    updateDefaultValues: state.updateDefaultValues,
  }))

  // Feature proficiency store functions
  const proficiencyFunctions = useFeatureProficiencyStore((state) => ({
    setCurrent: state.setCurrent,
    updateField: state.updateField,
    upsertAdded: state.upsertAdded,
    upsertEdited: state.upsertEdited,
    upsertValid: state.upsertValid,
    resetFormFields: state.resetFormFields,
    setFieldValidation: state.setFieldValidation,
    updateDefaultValues: state.updateDefaultValues,
  }))

  // Feature modifier store functions
  const modifierFunctions = useFeatureModifierStore((state) => ({
    setCurrent: state.setCurrent,
    updateField: state.updateField,
    upsertAdded: state.upsertAdded,
    upsertEdited: state.upsertEdited,
    upsertValid: state.upsertValid,
    resetFormFields: state.resetFormFields,
    setFieldValidation: state.setFieldValidation,
    updateDefaultValues: state.updateDefaultValues,
  }))

  // Feature spell store functions
  const spellFunctions = useFeatureSpellStore((state) => ({
    setCurrent: state.setCurrent,
    updateField: state.updateField,
    upsertAdded: state.upsertAdded,
    upsertEdited: state.upsertEdited,
    upsertValid: state.upsertValid,
    resetFormFields: state.resetFormFields,
    setFieldValidation: state.setFieldValidation,
    updateDefaultValues: state.updateDefaultValues,
  }))

  // Feature feat store functions
  const featFunctions = useFeatureFeatStore((state) => ({
    setCurrent: state.setCurrent,
    updateField: state.updateField,
    upsertAdded: state.upsertAdded,
    upsertEdited: state.upsertEdited,
    upsertValid: state.upsertValid,
    resetFormFields: state.resetFormFields,
    setFieldValidation: state.setFieldValidation,
    updateDefaultValues: state.updateDefaultValues,
  }))

  return {
    form: formFunctions,
    features: featureFunctions,
    ancestries: ancestryFunctions,
    options: optionFunctions,
    expertise: expertiseFunctions,
    senses: senseFunctions,
    proficiencies: proficiencyFunctions,
    modifiers: modifierFunctions,
    spells: spellFunctions,
    feats: featFunctions,
  }
}

export default useStoreFunctions
