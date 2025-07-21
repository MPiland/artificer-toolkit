import { use } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { UseMutationResult } from '@tanstack/react-query'
import { ModalContext } from '@/components/Modal'
import { useRouteNavigation, useStoreFunctions, useMutationFunctions, useSectionManager } from '@/hooks'
import {
  useAncestryOptionStore,
  useFeatureStore,
  useFormStore,
  useFeatureOptionStore,
  type FeatureStore,
  type FeatureOptionStore,
} from '@/store'
import { routeRoot } from '@/utils'
import type { FeatInput, FeatureInput, FeatureOptionInput, FormDataType, FormType, SourceDataType } from '@/types'

interface UseFooterLogicProps<T extends SourceDataType, V extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, V, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, V, unknown>
}

const useFooterLogic = <T extends SourceDataType, V extends FormDataType>({
  useAddNewItemMutation,
  useUpdateItemMutation,
}: UseFooterLogicProps<T, V>) => {
  const navigate = useNavigate()
  const { showModal } = use(ModalContext)

  const { features, form, options, ancestries } = useStoreFunctions()

  const { features: featureMutations, ancestries: ancestryMutations, options: optionMutations } = useMutationFunctions()

  // Use section manager for all section-related logic
  const { sectionMap, processSectionMutations } = useSectionManager()

  // Store subscriptions
  const formCurrent = useFormStore((state) => state.current)
  const stepIndex = useFormStore((state) => state.stepIndex)
  const steps = useFormStore((state) => state.steps)

  const featureCurrent = useFeatureStore((state) => state.current)
  const featureStep = useFeatureStore((state) => state.step)
  const featureAdded = useFeatureStore((state) => state.added)
  const featureEdited = useFeatureStore((state) => state.edited)
  const featureRemoved = useFeatureStore((state) => state.removed)

  const ancestryCurrent = useAncestryOptionStore((state) => state.current)
  const ancestryStep = useAncestryOptionStore((state) => state.step)
  const ancestryAdded = useAncestryOptionStore((state) => state.added)
  const ancestryEdited = useAncestryOptionStore((state) => state.edited)
  const ancestryRemoved = useAncestryOptionStore((state) => state.removed)

  const optionCurrent = useFeatureOptionStore((state) => state.current)
  const optionAdded = useFeatureOptionStore((state) => state.added)
  const optionEdited = useFeatureOptionStore((state) => state.edited)
  const optionRemoved = useFeatureOptionStore((state) => state.removed)

  const type = routeRoot(formCurrent?.__kind) as FormType
  const routeNav = useRouteNavigation(type)

  const { mutateAsync: addNewItem } = useAddNewItemMutation()
  const { mutateAsync: updateItem } = useUpdateItemMutation()

  // Helper function to process entity mutations (features, options, ancestries)
  const processEntityMutations = async <T>(
    added: Map<string, T>,
    edited: Map<string, T>,
    removed: Set<string>,
    mutations: {
      add: (item: T) => unknown
      update: (item: T) => unknown
      delete: (item: string) => Promise<string>
    }
  ) => {
    // Process added items
    if (added.size > 0) {
      await Promise.all(
        Array.from(added.values()).map(async (item) => {
          try {
            await mutations.add(item)
          } catch (error: unknown) {
            console.error('Error adding item:', error)
          }
        })
      )
    }

    // Process edited items
    if (edited.size > 0) {
      await Promise.all(
        Array.from(edited.values()).map(async (item) => {
          try {
            await mutations.update(item)
          } catch (error: unknown) {
            console.error('Error updating item:', error)
          }
        })
      )
    }

    // Process removed items
    if (removed.size > 0) {
      await Promise.all(
        Array.from(removed).map(async (itemId) => {
          try {
            await mutations.delete(itemId)
          } catch (error: unknown) {
            console.error('Error deleting item:', error)
          }
        })
      )
    }
  }

  // Computed state
  const isLastStep = stepIndex === steps?.length - 1

  const forwardLabel =
    isLastStep ?
      featureStep ? 'Finish'
      : formCurrent?.id != null ? 'Update'
      : 'Create'
    : 'Next'

  const backLabel = isLastStep ? 'Cancel' : 'Back'

  // Handler functions will be added in the next step
  const handleConfirmBack = () => {
    if (stepIndex !== 0) {
      if (featureStep) {
        features.setCurrent(null)
        return navigate({ to: '..' })
      }
      form.setStepIndex(stepIndex - 1)
    }
  }

  const handleNavigateEdit = (item: SourceDataType) => {
    form.setStepIndex(0)
    form.setSaving(false)
    const itemNav = routeNav.forItem(item.id, item.label)
    return navigate({ to: itemNav.edit.to, params: itemNav.edit.params, mask: itemNav.edit.mask })
  }

  // Helper functions
  const checkExisting = (step: 'senses' | 'expertise' | 'proficiencies' | 'modifiers' | 'spells' | 'feats') => {
    let current: FeatureInput | FeatureOptionInput | FeatInput | null = null
    let updateField: FeatureStore['updateField'] | FeatureOptionStore['updateField'] | null = features.updateField
    let sectionIds: string[]
    if (optionCurrent != null && current == null) {
      current = optionCurrent
      updateField = options.updateField
    } else if (featureCurrent != null && current == null) {
      current = featureCurrent
      updateField = features.updateField
    } else if (formCurrent?.__kind === 'FeatInput' && current == null) {
      current = formCurrent as FeatInput
      updateField = form.updateField
    }
    if (current && sectionMap[step].current) {
      const sectionId = sectionMap[step].current?.id
      if (current.__kind === 'FeatInput') {
        sectionIds = current[step as Exclude<typeof step, 'feats'>] || []
      } else {
        sectionIds = current[step] || []
      }
      if (sectionId != null) {
        if (!sectionIds.includes(sectionId)) {
          sectionMap[step].functions.upsertAdded(sectionMap[step].current as never)
          updateField({
            path: `${step}`,
            value: [...sectionIds, sectionId],
          })
        } else {
          sectionMap[step].functions.upsertEdited(sectionMap[step].current as never)
        }
      }
    }
  }

  const handleSaveSection = () => {
    if (featureStep) {
      if (featureStep !== 'options' && featureStep !== 'features') {
        checkExisting(featureStep)
        sectionMap[featureStep].functions.setCurrent(null)
      }
      if (optionCurrent !== null) {
        return features.setStep('options')
      }
      return features.setStep('features')
    }
  }

  const handleSaveOption = () => {
    if (!optionCurrent) return
    if (formCurrent?.__kind === 'FeatInput') {
      if (formCurrent?.options?.includes(optionCurrent?.id)) {
        options.upsertEdited(optionCurrent)
      }
      options.upsertAdded(optionCurrent)
      form.updateField({
        path: `options`,
        value: [...(formCurrent?.options || []), optionCurrent?.id],
      })
    } else {
      if (featureCurrent?.options?.includes(optionCurrent?.id)) {
        options.upsertEdited(optionCurrent)
      }
      options.upsertAdded(optionCurrent)
      features.updateField({
        path: `options`,
        value: [...(featureCurrent?.options || []), optionCurrent?.id],
      })
    }
    options.setCurrent(null)
    return features.setStep('features')
  }

  // Save feature hierarchy and clear states
  const handleSave = async () => {
    if (featureStep && featureStep !== 'options' && featureStep !== 'features') {
      return handleSaveSection()
    }
    if (featureStep === 'options') {
      return handleSaveOption()
    }
    if (
      featureStep &&
      featureCurrent &&
      formCurrent?.__kind !== 'CharacterInput' &&
      formCurrent?.__kind !== 'SpellInput'
    ) {
      if (formCurrent?.__kind === 'RaceInput' && ancestryStep === 'ancestryOption') {
        if (ancestryCurrent?.features?.includes(featureCurrent.id)) {
          features.upsertEdited(featureCurrent)
        }
        features.upsertAdded(featureCurrent)
        ancestries.updateField({
          path: `features`,
          value: [...(ancestryCurrent?.features || []), featureCurrent.id],
        })
        ancestries.setCurrent(null)
        return ancestries.setStep(null)
      } else if (formCurrent && formCurrent?.features) {
        if (formCurrent?.features?.includes(featureCurrent.id)) {
          features.upsertEdited(featureCurrent)
        }
        features.upsertAdded(featureCurrent)
        form.updateField({
          path: `features`,
          value: [...(formCurrent?.features || []), featureCurrent.id],
        })
      }
      features.setCurrent(null)
      return features.setStep(null)
    }
    if (formCurrent?.__kind === 'RaceInput' && ancestryCurrent && steps[stepIndex].id === 'ancestry') {
      if (formCurrent?.ancestry?.options?.includes(ancestryCurrent.id)) {
        ancestries.upsertEdited(ancestryCurrent)
      }
      ancestries.upsertAdded(ancestryCurrent)
      form.updateField({
        path: 'ancestry.options',
        value: [...(formCurrent?.ancestry?.options || []), ancestryCurrent.id],
      })
    }
  }

  const handleForward = async () => {
    if ((!isLastStep || (isLastStep && (featureStep || ancestryStep))) && formCurrent?.__kind !== 'FeatInput') {
      if (featureStep) {
        return handleSave()
      }
      return form.setStepIndex(stepIndex + 1)
    }
    if ((isLastStep || formCurrent?.__kind === 'FeatInput') && !featureStep && !ancestryStep) {
      if (
        !steps?.every((step) => step.fieldValidation && Object.values(step.fieldValidation).every((isValid) => isValid))
      ) {
        return showModal({
          type: 'alert',
          props: {
            message: 'There are errors that need to be corrected before the current form can be saved.',
          },
        })
      }
      form.setSaving(true)
      try {
        const payload = await addNewItem(formCurrent as V)
        if (payload) {
          return handleNavigateEdit(payload)
        }
      } catch (error: unknown) {
        return console.log(error)
      }
    }
  }

  const handleBack = () => {
    if (stepIndex === 0) {
      return showModal({
        type: 'alert',
        props: {
          message: `${formCurrent?.__kind.replace(/Input$/, '')} has not been created/updated. Press 'Cancel' and then 'Create' at end of form to save. Otherwise, press 'Continue'.`,
          onConfirm: handleConfirmBack,
        },
      })
    }
    if (featureStep || ancestryStep) {
      return handleSave()
    }
    if (stepIndex <= 0) {
      return form.setStepIndex(stepIndex)
    } else {
      return form.setStepIndex(stepIndex - 1)
    }
  }

  const handleUpdate = async () => {
    form.setAddClass(false)
    form.setChangeRace(false)
    if (
      steps?.every((step) => {
        if (step.fieldValidation) {
          return Object.values(step.fieldValidation).every((isValid) => isValid)
        }
        return true
      })
    ) {
      if (featureStep === 'options' || (featureStep === 'features' && formCurrent?.__kind !== 'FeatInput')) {
        await handleSave()
      }
      // Process all section mutations using the section manager
      try {
        await processSectionMutations()
      } catch (error: unknown) {
        console.error('Error processing section mutations:', error)
      }
      // Process feature mutations
      await processEntityMutations(featureAdded, featureEdited, featureRemoved, featureMutations)

      // Process option mutations
      await processEntityMutations(optionAdded, optionEdited, optionRemoved, optionMutations)

      // Process ancestry mutations
      await processEntityMutations(ancestryAdded, ancestryEdited, ancestryRemoved, ancestryMutations)
      try {
        await updateItem(formCurrent as V)
      } catch (error: unknown) {
        console.log(error)
      }
    } else {
      return showModal({
        type: 'alert',
        props: {
          message: 'There are missing fields are required. Please review each step.',
        },
      })
    }
  }

  const checkSectionMaps = (item: string) => {
    Object.values(sectionMap).forEach(({ added, edited, removed }) => {
      if (added.has(item)) {
        added.delete(item)
      }
      if (edited.has(item)) {
        edited.delete(item)
      }
      if (removed.has(item)) {
        removed.delete(item)
      }
    })
  }

  const handleReset = () => {
    const sectionKeys = Array.from(Object.keys(sectionMap)) as (keyof typeof sectionMap)[]
    if (featureStep) {
      if (featureStep !== 'features' && featureStep !== 'options') {
        sectionMap[featureStep].functions.resetFormFields()
      }
      if (featureStep === 'features' && formCurrent?.__kind !== 'FeatInput') {
        sectionKeys.forEach((key) => {
          if (featureCurrent?.[key]?.length) {
            featureCurrent[key].forEach((item) => {
              checkSectionMaps(item)
            })
          }
          if (featureCurrent?.options?.length) {
            featureCurrent?.options?.forEach((item) => {
              if (optionAdded.has(item)) {
                optionAdded.delete(item)
              }
              if (optionEdited.has(item)) {
                optionEdited.delete(item)
              }
              if (optionRemoved.has(item)) {
                optionRemoved.delete(item)
              }
            })
          }
        })
        return features.resetFormFields()
      }
      if (featureStep === 'options') {
        sectionKeys.forEach((key) => {
          if (optionCurrent?.[key]?.length) {
            optionCurrent[key].forEach((item) => {
              checkSectionMaps(item)
            })
          }
        })
        return options.resetFormFields()
      }
    } else if (ancestryStep) {
      if (ancestryStep) {
        if (ancestryCurrent?.features?.length) {
          ancestryCurrent.features.forEach((item) => {
            if (featureAdded.has(item)) {
              featureAdded.delete(item)
            }
            if (featureEdited.has(item)) {
              featureEdited.delete(item)
            }
            if (featureRemoved.has(item)) {
              featureRemoved.delete(item)
            }
          })
        }
        return ancestries.resetFormFields()
      }
    } else {
      if (formCurrent?.__kind !== 'SpellInput' && formCurrent?.__kind !== 'CharacterInput') {
        if (formCurrent?.__kind === 'RaceInput' && steps[stepIndex].id === 'ancestry') {
          if (formCurrent?.ancestry?.options?.length) {
            formCurrent.ancestry.options.forEach((item) => {
              if (ancestryRemoved.has(item)) {
                ancestryRemoved.delete(item)
              }
              if (ancestryEdited.has(item)) {
                ancestryEdited.delete(item)
              }
              if (ancestryAdded.has(item)) {
                ancestryAdded.delete(item)
              }
            })
          }
        }
        if (formCurrent?.features?.length && steps[stepIndex].id === 'features') {
          formCurrent.features.forEach((item) => {
            if (featureAdded.has(item)) {
              featureAdded.delete(item)
            }
            if (featureEdited.has(item)) {
              featureEdited.delete(item)
            }
            if (featureRemoved.has(item)) {
              featureRemoved.delete(item)
            }
          })
        }
        if (formCurrent?.__kind === 'FeatInput' && formCurrent?.options?.length) {
          formCurrent.options.forEach((item) => {
            if (optionAdded.has(item)) {
              optionAdded.delete(item)
            }
            if (optionEdited.has(item)) {
              optionEdited.delete(item)
            }
            if (optionRemoved.has(item)) {
              optionRemoved.delete(item)
            }
          })
        }
        return form.resetStepFields()
      }
    }
  }

  return {
    // State
    state: {
      isLastStep,
      forwardLabel,
      backLabel,
      formCurrent,
      stepIndex,
      steps,
      featureStep,
      ancestryStep,
    },
    // Handlers
    handlers: {
      handleForward,
      handleBack,
      handleUpdate,
      handleReset,
    },
    // Internal utilities (for progressive migration)
    internal: {
      sectionMap,
      handleConfirmBack,
      handleNavigateEdit,
      showModal,
      addNewItem,
      updateItem,
      // Store state for complex handlers
      featureCurrent,
      ancestryCurrent,
      optionCurrent,
      featureAdded,
      featureEdited,
      featureRemoved,
      optionAdded,
      optionEdited,
      optionRemoved,
      ancestryAdded,
      ancestryEdited,
      ancestryRemoved,
    },
  }
}

export default useFooterLogic
