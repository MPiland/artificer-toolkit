import { useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import { useGetRace, useAddRace, useUpdateRace } from '~/apis'
import type { RaceInput } from '~/types'
import { Route } from '~/routes/_protected/races/$action/$_raceId'
import { useSystemPref } from '~/hooks'
import { RaceInputSchema } from '~/schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, { RaceDetails, Traits, Features, Ancestry } from '~/components/Form'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { convertTypenameToKindInput } from '~/utils'
import { Categories } from '~/enums'

const RaceForm = () => {
  const { _raceId: raceId, action } = Route.useParams()
  const raceData = useGetRace(raceId)
  const [systemPref] = useSystemPref()

  const { mutateAsync: addRace } = useAddRace()
  const { mutateAsync: updateRace } = useUpdateRace()

  const store = useTypedFormStore<RaceInput>()
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
    if (raceData) {
      const raceInput = convertTypenameToKindInput(raceData) as RaceInput
      if (raceInput) {
        if (action === 'new') {
          return RaceInputSchema.parse({
            ...raceInput,
            id: uuidv4(),
            label: '',
            masterId: undefined,
            systemId: systemPref,
            category: Categories.BASE,
          })
        } else {
          return RaceInputSchema.parse({ ...raceInput })
        }
      }
    }
    return RaceInputSchema.parse({
      __kind: 'RaceInput',
      id: uuidv4(),
      category: Categories.BASE,
      systemId: systemPref,
      label: '',
    })
  }, [action, systemPref, raceData])

  const handleSubmit = useCallback(async () => {
    if (action === 'new') {
      try {
        const result = await addRace(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    } else {
      try {
        const result = await updateRace(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    }
  }, [action, addRace, updateRace, data])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data)
    }
  }, [current, data, setCurrent])

  const raceSteps = useMemo(
    () => [
      { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
      { id: 'traits', label: 'Traits', fieldValidation: {}, defaultValues: {} },
      { id: 'ancestry', label: 'Ancestry', fieldValidation: {}, defaultValues: {} },
      { id: 'features', label: 'Features' },
    ],
    []
  )

  useLayoutEffect(() => {
    if (!steps.every((step) => raceSteps.some((s) => s.id === step.id)) || !steps?.length) {
      setSteps(raceSteps)
    }
  }, [steps, raceSteps, setSteps])

  useEffect(() => {
    if (!formSubmit) {
      registerForm(handleSubmit)
    }
  }, [registerForm, handleSubmit, formSubmit])

  const stepComponentMap = {
    details: <RaceDetails />,
    traits: <Traits />,
    ancestry: <Ancestry />,
    features: <Features />,
  }

  return <Form>{stepComponentMap[raceSteps[stepIndex].id as keyof typeof stepComponentMap] || null}</Form>
}

export default RaceForm
