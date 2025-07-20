import { useEffect, useMemo, useCallback, useLayoutEffect } from 'react'
import { useAddNewBackgroundMutation, useUpdateBackgroundMutation } from '@/apis/backgrounds.api'
import type { BackgroundInput } from '@/types'
import { Route } from '@/routes/_protected/backgrounds/$action/$_backgroundId'
import { useBackgroundData, useSystemPref } from '@/hooks'
import { BackgroundInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useTypedFormStore } from '@/store'
import Form, { BackgroundDetails, Features, useAppForm } from '@/components/Form'
import { convertTypenameToKindInput } from '@/utils'

const BackgroundForm = () => {
  const { _backgroundId: backgroundId, action } = Route.useParams()
  const {
    backgrounds: { findBackground },
  } = useBackgroundData()
  const [systemPref] = useSystemPref()

  const backgroundData = findBackground(backgroundId)

  const store = useTypedFormStore<BackgroundInput>()

  const current = store((state) => state.current)
  const steps = store((state) => state.steps)
  const setSteps = store((state) => state.setSteps)
  const setCurrent = store((state) => state.setCurrent)
  const stepIndex = store((state) => state.stepIndex)
  const registerForm = store((state) => state.registerForm)
  const formReset = store((state) => state.formReset)

  const createDataObject = useCallback(() => {
    if (backgroundData) {
      const backgroundInput = convertTypenameToKindInput(backgroundData)
      if (backgroundInput) {
        if (action === 'new') {
          return BackgroundInputSchema.parse({
            ...backgroundInput,
            id: uuidv4(),
            label: '',
            masterId: undefined,
            systemId: systemPref,
          })
        } else {
          return BackgroundInputSchema.parse({ ...backgroundInput })
        }
      }
    }
    return BackgroundInputSchema.parse({
      __kind: 'BackgroundInput',
      id: uuidv4(),
      label: '',
      systemId: systemPref,
    })
  }, [action, backgroundData, systemPref])

  const data = useMemo(() => createDataObject(), [createDataObject])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data as BackgroundInput)
    }
  }, [current, data, setCurrent])

  const form = useAppForm({
    defaultValues: data,
  })

  const backgroundSteps = useMemo(
    () => [
      { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
      { id: 'features', label: 'Features' },
    ],
    []
  )

  useLayoutEffect(() => {
    if (!steps.every((step) => backgroundSteps.some((s) => s.id === step.id)) || !steps?.length) {
      setSteps(backgroundSteps)
    }
  }, [steps, backgroundSteps, setSteps])

  useEffect(() => {
    if (!formReset) {
      registerForm(form.reset)
    }
  }, [formReset, registerForm, form.reset])

  const stepComponentMap = {
    details: <BackgroundDetails form={form} />,
    features: <Features />,
  }

  return (
    <Form useAddNewItemMutation={useAddNewBackgroundMutation} useUpdateItemMutation={useUpdateBackgroundMutation}>
      {stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}

export default BackgroundForm
