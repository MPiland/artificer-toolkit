import { useEffect, use } from 'react'
import { useAddNewRaceMutation, useUpdateRaceMutation } from '@/apis/races.api'
import Form, { FormContext } from '@/components/Form'
import { Step, type RaceInput } from '@/types'
import { isEqual } from 'lodash'
import { Route } from '@/routes/_protected/races/$action/$_raceId'
import { useRaceData } from '@/hooks'
import { RaceInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'

const RaceForm = () => {
  const { _raceId: raceId, action } = Route.useParams()
  const {
    races: { findRace },
  } = useRaceData()
  const race = findRace(raceId)
  const { formStore, steps } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'traits', label: 'Traits' },
    { id: 'ancestry', label: 'Ancestry' },
    { id: 'features', label: 'Features' },
  ] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      formStore.setSteps(stepsArray)
    }
    if (action === 'new') {
      let dataObj: RaceInput
      if (race) {
        dataObj = RaceInputSchema.parse({
          ...race,
          id: uuidv4(),
          label: '',
          masterId: undefined
        })
      } else {
        dataObj = RaceInputSchema.parse({
          __kind: 'RaceInput',
          id: uuidv4(),
        })
      }
      formStore.reinitState(dataObj)
    }
    if (action === 'edit' && race) {
      const dataObj = RaceInputSchema.parse(race)
      formStore.reinitState(dataObj)
    }
  }, [stepsArray, formStore, race, action, steps])

  return <Form useUpdateItemMutation={useUpdateRaceMutation} useAddNewItemMutation={useAddNewRaceMutation} />
}

export default RaceForm
