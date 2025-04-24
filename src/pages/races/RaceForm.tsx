import { useEffect, use } from 'react'
import { useAddNewRaceMutation, useUpdateRaceMutation } from '@/apis/racesApi'
import Form, { FormContext } from '@/components/Form'
import { Step } from '@/types'
import { isEqual } from 'lodash'
import { Route } from '@/routes/_protected/races/$action/$_raceId'
import { useRaceData } from '@/hooks'

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
    if (action === 'new' && race) {
      if (Object.keys(formStore.data).length === 0) {
        formStore.reinitState(race)
      }
    }
    if (action === 'edit' && race) {
      if (formStore.data?.id !== race.id) {
        formStore.reinitState(race)
      }
    }
  }, [stepsArray, formStore, race, action, steps])

  return <Form useUpdateItemMutation={useUpdateRaceMutation} useAddNewItemMutation={useAddNewRaceMutation} />
}

export default RaceForm
