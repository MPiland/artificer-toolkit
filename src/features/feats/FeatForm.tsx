import Form from '../../components/Form/Form'
import { useAddNewFeatMutation, useUpdateFeatMutation } from './featsApi'
import { StepType } from '../../utils/types'
import { useEffect, useMemo } from 'react'
import { useForm } from '../../hooks/UseForm'

const FeatForm = () => {
  const { setSteps } = useForm()

  const stepsArray: StepType[] = useMemo(() => [{ id: 'features', name: 'Features' }], [])

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return <Form useAddNewItem={useAddNewFeatMutation} useUpdateItem={useUpdateFeatMutation} />
}
export default FeatForm
