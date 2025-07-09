import { z } from 'zod/v4'
import { useEffect, useMemo, useState } from 'react'
import { useAddNewRaceMutation, useUpdateRaceMutation } from '@/apis/races.api'
import type { RaceInput } from '@/types'
import { Route } from '@/routes/_protected/races/$action/$_raceId'
import { useRaceData } from '@/hooks'
import { RaceInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, { RaceDetails, Traits, Features, Ancestries } from '@/components/Form'
import { useFormStore } from '@/store'
import { isEqual } from 'lodash'

const RaceForm = () => {
  const { _raceId: raceId, action } = Route.useParams()
  const {
    races: { findRace },
  } = useRaceData()
  const race = findRace(raceId)
  const formStore = useFormStore()

  const data: z.input<typeof RaceInputSchema> = useMemo(
    () =>
      race ?
        action === 'new' ?
          RaceInputSchema.parse({
            ...race,
            id: uuidv4(),
            label: '',
            masterId: undefined,
          })
        : RaceInputSchema.parse(race)
      : RaceInputSchema.parse({
          __kind: 'RaceInput',
          id: uuidv4(),
        }),
    [race, action]
  )

  useEffect(() => {
    formStore.setCurrent(data as RaceInput)
  }, [formStore, data])

  const [steps] = useState([
    { id: 'details', label: 'Details', content: <RaceDetails /> },
    { id: 'traits', label: 'Traits', content: <Traits /> },
    { id: 'ancestry', label: 'Ancestry', content: <Ancestries /> },
    { id: 'features', label: 'Features', content: <Features /> },
  ])

  useEffect(() => {
    if (!isEqual(formStore.steps, steps)) formStore.setSteps(steps)
  }, [formStore, steps])

  return (
    <Form useUpdateItemMutation={useUpdateRaceMutation} useAddNewItemMutation={useAddNewRaceMutation}>
      {steps[formStore.stepIndex].content}
    </Form>
  )
}

export default RaceForm
