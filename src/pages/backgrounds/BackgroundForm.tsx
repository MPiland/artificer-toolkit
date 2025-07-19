import { useEffect, useMemo, useCallback, useLayoutEffect } from 'react'
import { useAddNewBackgroundMutation, useUpdateBackgroundMutation } from '@/apis/backgrounds.api'
import type { BackgroundInput } from '@/types'
import { Route } from '@/routes/_protected/backgrounds/$action/$_backgroundId'
import { useBackgroundData, useSystemPref } from '@/hooks'
import { BackgroundInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useFormStore } from '@/store'
import Form, { BackgroundDetails, Features, useAppForm } from '@/components/Form'
import { convertTypenameToKindInput } from '@/utils'

const BackgroundForm = () => {
  const { _backgroundId: backgroundId, action } = Route.useParams()
  const {
    backgrounds: { findBackground },
  } = useBackgroundData()
  const [systemPref] = useSystemPref()

  const backgroundData = findBackground(backgroundId)

  const current = useFormStore((state) => state.current)
  const steps = useFormStore((state) => state.steps)
  const setSteps = useFormStore((state) => state.setSteps)
  const setCurrent = useFormStore((state) => state.setCurrent)
  const stepIndex = useFormStore((state) => state.stepIndex)
  const registerForm = useFormStore((state) => state.registerForm)

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
    if (!steps[stepIndex].reset) {
      registerForm(form.reset)
    }
  }, [form.reset, steps, stepIndex, registerForm])

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
