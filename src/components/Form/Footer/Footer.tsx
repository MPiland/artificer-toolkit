import { base } from './Footer.css'
import { Button } from '@mantine/core'
import { UseMutationResult } from '@tanstack/react-query'
import { use } from 'react'
import { routeRoot } from '@/utils'
import { sprinkles } from '@/css/sprinkles.css'
import { ModalContext } from '@/components/Modal'
import { useNavigate } from '@tanstack/react-router'
import type {
  FeatInput,
  FeatureExpertiseInput,
  FeatureFeatInput,
  FeatureInput,
  FeatureModifierInput,
  FeatureOptionInput,
  FeatureProficiencyInput,
  FeatureSenseInput,
  FeatureSpellInput,
  FormDataType,
  FormType,
  SectionFormDataType,
  SourceDataType,
} from '@/types'
import { useRouteNavigation } from '@/hooks'
import { Group } from '@mantine/core'
import {
  useAncestryOptionStore,
  useFeatureExpertiseStore,
  useFeatureStore,
  useFormStore,
  useFeatureModifierStore,
  useFeatureOptionStore,
  useFeatureProficiencyStore,
  useFeatureSenseStore,
  useFeatureSpellStore,
  type FeatureStore,
  type OptionStore,
} from '@/store'
import { useFeatureFeatStore } from '@/store/featureFeatStore'

interface FooterProps<T extends SourceDataType, V extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, V, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, V, unknown>
}

const Footer = <T extends SourceDataType, V extends FormDataType>({
  useAddNewItemMutation,
  useUpdateItemMutation,
}: FooterProps<T, V>) => {
  const navigate = useNavigate()
  const { showModal } = use(ModalContext)

  const formStore = useFormStore()
  const featureStore = useFeatureStore()
  const ancestryStore = useAncestryOptionStore()
  const optionStore = useFeatureOptionStore()
  const expertiseStore = useFeatureExpertiseStore()
  const senseStore = useFeatureSenseStore()
  const proficiencyStore = useFeatureProficiencyStore()
  const modifierStore = useFeatureModifierStore()
  const spellStore = useFeatureSpellStore()
  const featStore = useFeatureFeatStore()

  const type = routeRoot(formStore.current?.__kind) as FormType
  const routeNav = useRouteNavigation(type)

  const sectionStoreMap = {
    expertise: {
      store: expertiseStore,
      upsertAdd: (data: SectionFormDataType) => expertiseStore.upsertAdded(data as FeatureExpertiseInput),
      upsertEdit: (data: SectionFormDataType) => expertiseStore.upsertEdited(data as FeatureExpertiseInput),
    },
    senses: {
      store: senseStore,
      upsertAdd: (data: SectionFormDataType) => senseStore.upsertAdded(data as FeatureSenseInput),
      upsertEdit: (data: SectionFormDataType) => senseStore.upsertEdited(data as FeatureSenseInput),
    },
    proficiencies: {
      store: proficiencyStore,
      upsertAdd: (data: SectionFormDataType) => proficiencyStore.upsertAdded(data as FeatureProficiencyInput),
      upsertEdit: (data: SectionFormDataType) => proficiencyStore.upsertEdited(data as FeatureProficiencyInput),
    },
    modifiers: {
      store: modifierStore,
      upsertAdd: (data: SectionFormDataType) => modifierStore.upsertAdded(data as FeatureModifierInput),
      upsertEdit: (data: SectionFormDataType) => modifierStore.upsertEdited(data as FeatureModifierInput),
    },
    spells: {
      store: spellStore,
      upsertAdd: (data: SectionFormDataType) => spellStore.upsertAdded(data as FeatureSpellInput),
      upsertEdit: (data: SectionFormDataType) => spellStore.upsertEdited(data as FeatureSpellInput),
    },
    feats: {
      store: featStore,
      upsertAdd: (data: SectionFormDataType) => featStore.upsertAdded(data as FeatureFeatInput),
      upsertEdit: (data: SectionFormDataType) => featStore.upsertEdited(data as FeatureFeatInput),
    },
  } as const

  const { mutateAsync: addNewItem } = useAddNewItemMutation()

  const { mutateAsync: updateItem } = useUpdateItemMutation()

  const isLastStep = formStore.stepIndex === formStore.steps?.length - 1

  const forwardLabel =
    isLastStep ?
      featureStore.step != null ? 'Finish'
      : formStore.current?.id != null ? 'Update'
      : 'Create'
    : 'Next'

  const backLabel = isLastStep ? 'Cancel' : 'Back'

  const handleConfirmBack = () => {
    if (formStore.stepIndex !== 0) {
      if (featureStore.step != null) {
        formStore.setCurrent(null)
        return navigate({ to: '..' })
      }
      formStore.setStepIndex(formStore.stepIndex - 1)
    }
  }

  const handleConfirmForward = () => {
    if (!isLastStep) {
      if (featureStore.step != null) {
        return
      }
      formStore.setStepIndex(formStore.stepIndex + 1)
    }
  }

  const handleNavigateEdit = (item: SourceDataType) => {
    formStore.setStepIndex(0)
    formStore.setSaving(false)
    const itemNav = routeNav.forItem(item.id, item.label)
    return navigate({ to: itemNav.edit.to, params: itemNav.edit.params, mask: itemNav.edit.mask })
  }

  const checkExisting = (step: 'senses' | 'expertise' | 'proficiencies' | 'modifiers' | 'spells' | 'feats') => {
    let current: FeatureInput | FeatureOptionInput | FeatInput | null = featureStore.current
    let store: FeatureStore | OptionStore = featureStore
    let sectionIds: string[]
    if (optionStore.current != null) {
      current = optionStore.current
      store = optionStore
    }
    if (current == null) {
      current = formStore.current as FeatInput
    }
    const sectionStore = sectionStoreMap[step].store
    const upsertAddFn = sectionStoreMap[step].upsertAdd
    const upsertEditFn = sectionStoreMap[step].upsertEdit
    if (current != null && sectionStore.current != null) {
      const sectionId = sectionStore.current?.id
      if (current.__kind === 'FeatInput') {
        sectionIds = current[step as Exclude<typeof step, 'feats'>] || []
      } else {
        sectionIds = current[step] || []
      }
      if (sectionId != null) {
        if (!sectionIds.includes(sectionId)) {
          upsertAddFn(sectionStore.current)
          store.updateField({
            path: `${step}`,
            value: [...sectionIds, sectionId],
          })
        } else {
          upsertEditFn(sectionStore.current)
        }
      }
    }
  }

  const handleSaveSection = () => {
    if (featureStore?.step?.id != null) {
      if (featureStore?.step?.id !== 'options' && featureStore?.step?.id !== 'features') {
        checkExisting(featureStore?.step?.id)
        sectionStoreMap[featureStore?.step?.id].store.setCurrent(null)
      }
      if (optionStore.current !== null) {
        return featureStore.setStep('options')
      }
      return featureStore.setStep('features')
    }
  }

  const handleSaveOption = () => {
    if (!optionStore.current) return
    if (formStore.current?.__kind === 'FeatInput') {
      if (formStore.current?.options?.includes(optionStore.current?.id)) {
        optionStore.upsertEdited(optionStore.current)
      }
      optionStore.upsertAdded(optionStore.current)
      formStore.updateField({
        path: `options`,
        value: [...(formStore.current?.options || []), optionStore.current?.id],
      })
    } else {
      if (featureStore.current?.options?.includes(optionStore.current?.id)) {
        optionStore.upsertEdited(optionStore.current)
      }
      optionStore.upsertAdded(optionStore.current)
      featureStore.updateField({
        path: `options`,
        value: [...(featureStore.current?.options || []), optionStore.current?.id],
      })
    }
    optionStore.setCurrent(null)
    return featureStore.setStep('features')
  }

  // Save feature hierachy and clear states
  const handleSave = async () => {
    if (featureStore.step != null && featureStore.step !== 'options' && featureStore.step !== 'features') {
      return handleSaveSection()
    }
    if (featureStore.step === 'options') {
      return handleSaveOption()
    }
    if (featureStore.step != null && featureStore.current && formStore.current?.__kind !== 'CharacterInput') {
      if (formStore.current?.__kind === 'RaceInput' && ancestryStore.step === 'ancestryOption') {
        if (ancestryStore?.current?.features?.includes(featureStore.current?.id)) {
          featureStore.upsertEdited(featureStore.current)
        }
        featureStore.upsertAdded(featureStore.current)
        ancestryStore.updateField({
          path: `features`,
          value: [...(ancestryStore?.current?.features || []), featureStore.current?.id],
        })
        ancestryStore.setCurrent(null)
        return ancestryStore.setStep(null)
      } else if (formStore.current && 'features' in formStore.current) {
        if (formStore.current?.features?.includes(featureStore.current?.id)) {
          featureStore.upsertEdited(featureStore.current)
        }
        featureStore.upsertAdded(featureStore.current)
        formStore.updateField({
          path: `features`,
          value: [...(formStore.current?.features || []), featureStore.current?.id],
        })
      }
      featureStore.setCurrent(null)
      return featureStore.setStep(null)
    }
    if (
      formStore.current?.__kind === 'RaceInput' &&
      ancestryStore.current &&
      formStore.steps[formStore.stepIndex].id === 'ancestry'
    ) {
      if (formStore.current?.ancestry?.options?.includes(ancestryStore.current?.id)) {
        ancestryStore.upsertEdited(ancestryStore.current)
      }
      ancestryStore.upsertAdded(ancestryStore.current)
      formStore.updateField({
        path: 'ancestry.options',
        value: [...(formStore.current?.ancestry?.options || []), ancestryStore.current?.id],
      })
    }
  }

  const handleForward = async () => {
    if (!isLastStep) {
      formStore.setStepIndex(formStore.stepIndex + 1)
    }
    // if ((!isLastStep || (isLastStep && featureStore.step != null)) && formStore.current?.__kind !== 'FeatInput') {
    //   if (formStore.steps[formStore.stepIndex].isValid) {
    //     if (featureStore.step != null) {
    //       return handleSave()
    //     }
    //     return formStore.setStepIndex(formStore.stepIndex + 1)
    //   }
    //   if (featureStore.step != null) {
    //     return showModal({
    //       type: 'alert',
    //       props: {
    //         message: 'Some required fields are missing. Current form step will not be saved.',
    //         onConfirm: handleConfirmForward,
    //       },
    //     })
    //   }
    // }
    // if (
    //   (isLastStep && featureStore.step == null) ||
    //   (formStore.current?.__kind === 'FeatInput' && featureStore.step == null)
    // ) {
    //   if (!formStore.steps?.every((step) => step.isValid)) {
    //     return showModal({
    //       type: 'alert',
    //       props: {
    //         message: 'Some required fields are missing. Current form step will not be saved.',
    //         onConfirm: handleConfirmForward,
    //       },
    //     })
    //   }
    //   formStore.setSaving(true)
    //   try {
    //     const payload = await addNewItem(formStore.current as V)
    //     if (payload) {
    //       return handleNavigateEdit(payload)
    //     }
    //   } catch (error: unknown) {
    //     return console.log(error)
    //   }
    // }
  }

  const handleBack = () => {
    if (formStore.stepIndex === 0) {
      return showModal({
        type: 'alert',
        props: {
          message:
            formStore.current?.id != null ?
              `Changes have not been saved. Press 'Cancel' and then 'Update' to save changes. Otherwise, press 'Continue'`
            : `${formStore.current?.__kind.replace(/Input$/, '')} has not been created. Press 'Cancel' and then 'Create' at end of form to save. Otherwise, press 'Continue'.`,
          onConfirm: handleConfirmBack,
        },
      })
    }
    if (featureStore.step != null) {
      return handleSave()
    }
    if (featureStore.step != null) {
      return showModal({
        type: 'alert',
        props: {
          message: 'Some required fields are missing. Current form step will not be saved.',
          onConfirm: handleConfirmBack,
        },
      })
    }
    if (formStore.stepIndex <= 0) {
      return formStore.setStepIndex(formStore.stepIndex)
    } else {
      return formStore.setStepIndex(formStore.stepIndex - 1)
    }
  }

  const handleUpdate = async () => {
    formStore.setAddClass(false)
    formStore.setChangeRace(false)
    if (formStore.steps?.every((step) => step.isValid)) {
      if (
        featureStore.step === 'options' ||
        (featureStore.step === 'features' && formStore.current?.__kind !== 'FeatInput')
      ) {
        await handleSave()
      }
      try {
        await updateItem(formStore.current as V)
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
  
  return (
    <Group className={base} justify='space-between'>
      <Group>
        <Button color='main' type='button' onClick={handleBack} className={sprinkles({ marginRight: 'space-2' })}>
          {backLabel}
        </Button>
        <Button color='warning' type='button'>
          Reset
        </Button>
      </Group>
      <Group>
        {(!isLastStep || (isLastStep && featureStore.step != null)) && (
          <Button color='update' type='button' onClick={handleUpdate} className={sprinkles({ marginRight: 'space-2' })}>
            Update
          </Button>
        )}
        <Button
          color={forwardLabel === 'Update' ? 'update' : 'primary'}
          type='button'
          onClick={() => (isLastStep && featureStore.step == null ? handleUpdate() : handleForward())}
        >
          {forwardLabel}
        </Button>
      </Group>
    </Group>
  )
}

export default Footer
