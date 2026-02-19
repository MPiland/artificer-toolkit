import { useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import { useGetRace, useUpsertRace } from '@data/races'
import type { RaceInput } from '@types'
import { Route } from '@routes/_authed/races/$action/$_raceId'
import { v4 as uuidv4 } from 'uuid'
import Form, { RaceDetails, Traits, Features, Ancestry } from '@components/Form'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import { Categories } from '@types'

const RaceForm = () => {
  const { _raceId: raceId, action } = Route.useParams()
  const raceData = useGetRace(raceId)

  const { mutateAsync: upsertRace } = useUpsertRace()

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
      formSubmit: state.formSubmit
    })
  )

  const data: RaceInput = useMemo(() => {
    if (!raceData) {
      return {
        id: uuidv4(),
        __kind: 'RaceInput',
        label: '',
        category: Categories.BASE
      }
    }

    if (action === 'new') {
      return {
        ...raceData,
        id: uuidv4(),
        __kind: 'RaceInput',
        label: ''
      }
    }
    return { ...raceData, __kind: 'RaceInput' }
  }, [action, raceData])

  const handleSubmit = useCallback(async () => {
    if (current) {
      try {
        const result = await upsertRace(current)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    }
  }, [upsertRace, current])

  useLayoutEffect(() => {
    if (!current && data) {
      setCurrent(data)
    }
  }, [current, data, setCurrent])

  const raceSteps = useMemo(
    () => [
      { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
      { id: 'traits', label: 'Traits', fieldValidation: {}, defaultValues: {} },
      { id: 'ancestry', label: 'Ancestry', fieldValidation: {}, defaultValues: {} },
      { id: 'features', label: 'Features' }
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
    features: <Features />
  }

  return <Form>{stepComponentMap[raceSteps[stepIndex].id as keyof typeof stepComponentMap] || null}</Form>
}

export default RaceForm
