import { useEffect, use } from 'react'
import { useAddBackground, useUpdateBackground } from '@/apis/backgrounds.api'
import { Step, type BackgroundInput } from '@/types'
import Form, { FormContext } from '@/components/Form'
import { isEqual } from 'lodash'
import { Route } from '@/routes/_protected/backgrounds/$action/$_backgroundId'
import { useBackgroundData } from '@/hooks'
import { BackgroundInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'

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
    if (action === 'new') {
      let dataObj: BackgroundInput
      if (background) {
        dataObj = BackgroundInputSchema.parse({
          ...background,
          id: uuidv4(),
          label: '',
          masterId: undefined,
        })
      } else {
        dataObj = BackgroundInputSchema.parse({
          __kind: 'BackgroundInput',
          id: uuidv4(),
        })
      }
      formStore.reinitState(dataObj)
    }
    if (action === 'edit' && background) {
      const dataObj = BackgroundInputSchema.parse(background)
      formStore.reinitState(dataObj)
    }
  }, [stepsArray, steps, formStore, background, action])

  return <Form useAddNewItemMutation={useAddBackground} useUpdateItemMutation={useUpdateBackground} />
}

export default BackgroundForm
