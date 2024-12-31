import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { useAddNewFeatMutation, useUpdateFeatMutation } from './featsApi'
import { Step } from '../../types/form'
import { FormContext } from '../../components/Form/FormContext'

const FeatForm = () => {
  const { setSteps } = use(FormContext)

  const stepsArray = [{ id: 'features', label: 'Features' }] satisfies Step[]

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return <Form useAddNewItemMutation={useAddNewFeatMutation} useUpdateItemMutation={useUpdateFeatMutation} />
}
export default FeatForm
