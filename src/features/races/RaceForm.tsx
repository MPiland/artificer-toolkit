import { useAddNewRaceMutation, useUpdateRaceMutation } from './racesApi'
import Form from '../../components/Form/Form'
import { StepType } from '../../utils/types'
import { useEffect, useMemo } from 'react'
import { useForm } from '../../hooks/UseForm'

const RaceForm = () => {
  const { setSteps } = useForm()

  const stepsArray: StepType[] = useMemo(
    () => [
      { id: 'details', name: 'Details' },
      { id: 'traits', name: 'Traits' },
      { id: 'ancestry', name: 'Ancestry' },
      { id: 'features', name: 'Features' },
    ],
    []
  )

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return <Form useUpdateItem={useUpdateRaceMutation} useAddNewItem={useAddNewRaceMutation} />
}
export default RaceForm
