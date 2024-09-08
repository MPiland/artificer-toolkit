import Form from '../../components/Form/Form'
import { useAddNewEquipmentMutation, useUpdateEquipmentMutation } from './equipmentApi'
import { StepType } from '../../utils/types'
import { useForm } from '../../hooks/UseForm'
import { useEffect, useMemo } from 'react'

const ItemForm = () => {
  const { setSteps } = useForm()

  const stepsArray: StepType[] = useMemo(
    () => [
      { id: 'details', name: 'Details' },
      { id: 'attributes', name: 'Attributes' },
      { id: 'features', name: 'Features' },
    ],
    []
  )

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return <Form useUpdateItem={useUpdateEquipmentMutation} useAddNewItem={useAddNewEquipmentMutation} />
}
export default ItemForm
