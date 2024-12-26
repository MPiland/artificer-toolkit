import { useEffect, use } from 'react'
import { useAddNewRaceMutation, useUpdateRaceMutation } from './racesApi'
import Form from '../../components/Form/Form'
import { Step } from '../../types/form'
import FormContext from '../../components/Form/FormContext'

const RaceForm = () => {
  const { setSteps } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'traits', label: 'Traits' },
    { id: 'ancestry', label: 'Ancestry' },
    { id: 'features', label: 'Features' },
  ] satisfies Step[]

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return <Form useUpdateItemMutation={useUpdateRaceMutation} useAddNewItemMutation={useAddNewRaceMutation} />
}
export default RaceForm
