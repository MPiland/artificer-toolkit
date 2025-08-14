import { useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { useGetFeat, useAddFeat, useUpdateFeat } from '~/apis'
import type { FeatInput } from '~/types'
import { Route } from '~/routes/_protected/feats/$action/$_featId'
import { FeatInputSchema } from '~/schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, { Features } from '~/components/Form'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { isEqual } from 'lodash-es'
import { useSystemPref } from '~/hooks'
import { convertTypenameToKindInput } from '~/utils'
import { z } from 'zod/v4'

const FeatForm = () => {
  const { _featId: featId, action } = Route.useParams()
  const { data: featData } = useGetFeat(featId)
  const [systemPref] = useSystemPref()

  const { mutateAsync: addFeat } = useAddFeat()
  const { mutateAsync: updateFeat } = useUpdateFeat()

  const store = useTypedFormStore<FeatInput>()
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
    if (featData) {
      const featInput = convertTypenameToKindInput(featData) as z.input<typeof FeatInputSchema>
      if (featInput) {
        if (action === 'new') {
          return FeatInputSchema.parse({
            ...featInput,
            id: uuidv4(),
            label: '',
            masterId: undefined,
            category: '',
            systemId: systemPref,
          })
        } else {
          return FeatInputSchema.parse({ ...featInput })
        }
      }
    }
    return FeatInputSchema.parse({
      __kind: 'FeatInput',
      id: uuidv4(),
      category: '',
      systemId: systemPref,
      label: '',
    })
  }, [action, systemPref, featData])

  const handleSubmit = useCallback(async () => {
    if (action === 'new') {
      try {
        const result = await addFeat(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    } else {
      try {
        const result = await updateFeat(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    }
  }, [action, addFeat, updateFeat, data])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data)
    }
  }, [current, data, setCurrent])

  const featSteps = useMemo(
    () => [
      {
        id: 'features',
        label: 'Features',
      },
    ],
    []
  )

  useEffect(() => {
    if (!isEqual(featSteps, featSteps)) setSteps(featSteps)
  }, [featSteps, setSteps])

  useEffect(() => {
    if (!formSubmit) {
      registerForm(handleSubmit)
    }
  }, [formSubmit, handleSubmit, registerForm])

  const stepComponentMap = {
    features: <Features />,
  }

  return <Form>{stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}</Form>
}

export default FeatForm
