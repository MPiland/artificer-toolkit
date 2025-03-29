
import { useEffect, use } from 'react'
import { useAddNewRaceMutation, useUpdateRaceMutation } from '../../apis/racesApi'
import Form from '../../components/Form/Form'
import { Step } from '../../types/form'
import { FormContext } from '../../components/Form/FormContext'
import { isEqual } from 'lodash'

const RaceForm = () => {
  const { setSteps, steps } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'traits', label: 'Traits' },
    { id: 'ancestry', label: 'Ancestry' },
    { id: 'features', label: 'Features' },
  ] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      setSteps(stepsArray)
    }
  }, [setSteps, stepsArray, steps])

  return <Form useUpdateItemMutation={useUpdateRaceMutation} useAddNewItemMutation={useAddNewRaceMutation} />
}

export default RaceForm