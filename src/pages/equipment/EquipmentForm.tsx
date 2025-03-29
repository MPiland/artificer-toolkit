import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { useAddNewEquipmentMutation, useUpdateEquipmentMutation } from '../../apis/equipmentApi'
import { Step } from '../../types/form'
import { FormContext } from '../../components/Form/FormContext'
import { isEqual } from 'lodash'

const EquipmentForm = () => {
  const { setSteps, steps } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'features', label: 'Features' },
  ] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      setSteps(stepsArray)
    }
  }, [setSteps, stepsArray, steps])

  return <Form useUpdateItemMutation={useUpdateEquipmentMutation} useAddNewItemMutation={useAddNewEquipmentMutation} />
}

export default EquipmentForm
