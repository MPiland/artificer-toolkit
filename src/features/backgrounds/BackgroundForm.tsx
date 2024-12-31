import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { useAddNewBackgroundMutation, useUpdateBackgroundMutation } from './backgroundsApi'
import { Step } from '../../types/form'
import { FormContext } from '../../components/Form/FormContext'

const BackgroundForm = () => {
  const { setSteps } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'proficiencies', label: 'Proficiencies' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'features', label: 'Features' },
  ] satisfies Step[]

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return (
    <Form useAddNewItemMutation={useAddNewBackgroundMutation} useUpdateItemMutation={useUpdateBackgroundMutation} />
  )
}
export default BackgroundForm
