import { useEffect, use } from 'react'
import Form from '@/components/Form/Form'
import { useAddBackground, useUpdateBackground } from '@/apis/backgroundsApi'
import { Step } from '@/types/form'
import { FormContext } from '@/components/Form/FormContext'
import { isEqual } from 'lodash'
import { Route } from '@/routes/_protected/backgrounds/$action/$_backgroundId'
import useBackgroundData from '@/hooks/useBackgroundData'

const BackgroundForm = () => {
  const { _backgroundId: backgroundId, action } = Route.useParams()
  const {
    backgrounds: { findBackground },
  } = useBackgroundData()
  const background = findBackground(backgroundId)
  const { steps, formStore } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'startingEquipment', label: 'Starting Equipment' },
    { id: 'features', label: 'Features' },
  ] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      formStore.setSteps(stepsArray)
    }
    if (action === 'new' && background) {
      if (Object.keys(formStore.data).length === 0) {
        formStore.reinitState(background)
      }
    }
    if (action === 'edit' && background) {
      if (formStore.data?.id !== background.id) {
        formStore.reinitState(background)
      }
    }
  }, [stepsArray, steps, formStore, background, action])

  return <Form useAddNewItemMutation={useAddBackground} useUpdateItemMutation={useUpdateBackground} />
}

export default BackgroundForm
