import { useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import { useGetBackground, useAddBackground, useUpdateBackground } from '~/apis'
import type { BackgroundInput } from '~/types'
import { Route } from '~/routes/_protected/backgrounds/$action/$_backgroundId'
import { useSystemPref } from '~/hooks'
import { BackgroundInputSchema } from '~/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import Form, { BackgroundDetails, Features } from '~/components/Form'
import { convertTypenameToKindInput } from '~/utils'
import { isEqual } from 'lodash-es'

const BackgroundForm = () => {
  const { _backgroundId: backgroundId, action } = Route.useParams()
  const [systemPref] = useSystemPref()

  const { mutateAsync: addBackground } = useAddBackground()
  const { mutateAsync: updateBackground } = useUpdateBackground()

  const backgroundData = useGetBackground(backgroundId)

  const store = useTypedFormStore<BackgroundInput>()

  const { current, steps, setSteps, setCurrent, stepIndex, registerForm, formSubmit } = useOptimizedSelector(
    store,
    (state) => ({
      current: state.current,
      steps: state.meta.steps,
      setSteps: state.setSteps,
      setCurrent: state.setCurrent,
      stepIndex: state.meta.stepIndex,
      registerForm: state.registerForm,
      formSubmit: state.formSubmit,
    })
  )

  const data = useMemo(() => {
    if (backgroundData) {
      const backgroundInput = convertTypenameToKindInput(backgroundData) as BackgroundInput
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

  const handleSubmit = useCallback(async () => {
    if (action === 'new') {
      try {
        const result = await addBackground(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    } else {
      try {
        const result = await updateBackground(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    }
  }, [action, addBackground, updateBackground, data])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data)
    }
  }, [current, data, setCurrent])

  const backgroundSteps = useMemo(
    () => [
      { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
      { id: 'features', label: 'Features' },
    ],
    []
  )

  useEffect(() => {
    if (!isEqual(backgroundSteps, backgroundSteps)) setSteps(backgroundSteps)
  }, [backgroundSteps, setSteps])

  useEffect(() => {
    if (!formSubmit) {
      registerForm(handleSubmit)
    }
  }, [formSubmit, handleSubmit, registerForm])

  const stepComponentMap = {
    details: <BackgroundDetails />,
    features: <Features />,
  }

  return <Form>{stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}</Form>
}

export default BackgroundForm
