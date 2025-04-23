import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { useAddNewEquipmentMutation, useUpdateEquipmentMutation } from '../../apis/equipmentApi'
import { Step } from '../../types/types'
import { FormContext } from '../../components/Form/FormContext'
import { isEqual } from 'lodash'
import { Route } from '../../routes/_protected/equipment/$action/$_equipmentId'
import useEquipmentData from '../../hooks/useEquipmentData'

const EquipmentForm = () => {
  const { _equipmentId: equipmentId, action } = Route.useParams()
  const {
    equipment: { findEquipment },
  } = useEquipmentData()
  const equipment = findEquipment(equipmentId)
  const { steps, formStore } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'features', label: 'Features' },
  ] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      formStore.setSteps(stepsArray)
    }
    if (action === 'new' && equipment) {
      if (Object.keys(formStore.data).length === 0) {
        formStore.reinitState(equipment)
      }
    }
    if (action === 'edit' && equipment) {
      if (formStore.data?.id !== equipment.id) {
        formStore.reinitState(equipment)
      }
    }
  }, [stepsArray, steps, formStore, equipment, action])

  return <Form useUpdateItemMutation={useUpdateEquipmentMutation} useAddNewItemMutation={useAddNewEquipmentMutation} />
}

export default EquipmentForm
