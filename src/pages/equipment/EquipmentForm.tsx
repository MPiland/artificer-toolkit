import { useEffect, use } from 'react'
import { useAddNewEquipmentMutation, useUpdateEquipmentMutation } from '@/apis/equipment.api'
import { Step, type EquipmentInput } from '@/types'
import Form, { FormContext } from '@/components/Form'
import { isEqual } from 'lodash'
import { Route } from '@/routes/_protected/equipment/$action/$_equipmentId'
import { useEquipmentData } from '@/hooks'
import { EquipmentInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'

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
    if (action === 'new') {
      let dataObj: EquipmentInput
      if (equipment) {
        dataObj = EquipmentInputSchema.parse({
          ...equipment,
          id: uuidv4(),
          label: '',
          masterId: undefined,
        })
      } else {
        dataObj = EquipmentInputSchema.parse({
          __kind: 'EquipmentInput',
          id: uuidv4(),
        })
      }
      formStore.reinitState(dataObj)
    }
    if (action === 'edit' && equipment) {
      const dataObj = EquipmentInputSchema.parse(equipment)
      formStore.reinitState(dataObj)
    }
  }, [stepsArray, steps, formStore, equipment, action])

  return <Form useUpdateItemMutation={useUpdateEquipmentMutation} useAddNewItemMutation={useAddNewEquipmentMutation} />
}

export default EquipmentForm
