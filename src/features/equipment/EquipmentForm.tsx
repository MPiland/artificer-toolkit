import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { useAddNewEquipmentMutation, useUpdateEquipmentMutation } from './equipmentApi'
import { Step } from '../../types/form'
import FormContext from '../../components/Form/FormContext'

const EquipmentForm = () => {
  const { setSteps } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'features', label: 'Features' },
  ] satisfies Step[]

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return <Form useUpdateItemMutation={useUpdateEquipmentMutation} useAddNewItemMutation={useAddNewEquipmentMutation} />
}
export default EquipmentForm
