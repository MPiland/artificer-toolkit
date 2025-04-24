import { useEffect, use } from 'react'
import { useAddBackground, useUpdateBackground } from '@/apis/backgroundsApi'
import { Step } from '@/types'
import Form, { FormContext } from '@/components/Form'
import { isEqual } from 'lodash'
import { Route } from '@/routes/_protected/backgrounds/$action/$_backgroundId'
import { useBackgroundData } from '@/hooks'

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
