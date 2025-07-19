import { useCallback, useEffect, useMemo, useLayoutEffect } from 'react'
import { useAddNewRaceMutation, useUpdateRaceMutation } from '@/apis/races.api'
import type { RaceInput } from '@/types'
import { Route } from '@/routes/_protected/races/$action/$_raceId'
import { useRaceData, useSystemPref } from '@/hooks'
import { RaceInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, { RaceDetails, Traits, Features, Ancestries, useAppForm } from '@/components/Form'
import { useFormStore } from '@/store'
import { convertTypenameToKindInput } from '@/utils'
import { Categories } from '@/enums'

const RaceForm = () => {
  const { _raceId: raceId, action } = Route.useParams()
  const {
    races: { findRace },
  } = useRaceData()
  const [systemPref] = useSystemPref()

  const raceData = findRace(raceId)

  const current = useFormStore((state) => state
  .current)
  const steps = useFormStore((state) => state.steps)
  const setSteps = useFormStore((state) => state.setSteps)
  const setCurrent = useFormStore((state) => state.setCurrent)
  const stepIndex = useFormStore((state) => state.stepIndex)
  const registerForm = useFormStore((state) => state.registerForm)

  const createDataObject = useCallback(() => {
    if (raceData) {
      const raceInput = convertTypenameToKindInput(raceData)
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

  const data = useMemo(() => createDataObject(), [createDataObject])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data as RaceInput)
    }
  }, [current, data, setCurrent])

  const form = useAppForm({
    defaultValues: data,
  })

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
    if (!steps[stepIndex].reset) {
      registerForm(form.reset)
    }
  }, [form.reset, steps, stepIndex, registerForm])

  const stepComponentMap = {
    details: <RaceDetails form={form} />,
    traits: <Traits form={form} />,
    ancestry: <Ancestries form={form} />,
    features: <Features />,
  }

  return (
    <Form useUpdateItemMutation={useUpdateRaceMutation} useAddNewItemMutation={useAddNewRaceMutation}>
      {stepComponentMap[raceSteps[stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}

export default RaceForm
