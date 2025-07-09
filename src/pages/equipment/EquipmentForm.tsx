import { z } from 'zod/v4'
import { useEffect, useMemo, useState } from 'react'
import { useAddNewEquipmentMutation, useUpdateEquipmentMutation } from '@/apis/equipment.api'
import { v4 as uuidv4 } from 'uuid'
import { Route } from '@/routes/_protected/equipment/$action/$_equipmentId'
import { useEquipmentData } from '@/hooks'
import { ContainsInputSchema, EquipmentInputSchema } from '@/schemas'
import { useFormStore } from '@/store'
import type { EquipmentInput } from '@/types'
import Form, { EquipmentDetails, EquipmentAttributes, Contains, Features } from '@/components/Form'
import { Attributes as AttributesEnum } from '@/enums'
import { isEqual } from 'lodash'

const EquipmentForm = () => {
  const { _equipmentId: equipmentId, action } = Route.useParams()
  const {
    equipment: { findEquipment },
  } = useEquipmentData()
  const equipment = findEquipment(equipmentId)
  const formStore = useFormStore((state) => state)

  const data: z.input<typeof EquipmentInputSchema> = useMemo(
    () =>
      equipment ?
        action === 'new' ?
          EquipmentInputSchema.parse({
            ...equipment,
            id: uuidv4(),
            label: '',
            masterId: undefined,
          })
        : EquipmentInputSchema.parse(equipment)
      : EquipmentInputSchema.parse({
          __kind: 'EquipmentInput',
          id: uuidv4(),
        }),
    [equipment, action]
  )

  useEffect(() => {
    formStore.setCurrent(data as EquipmentInput)
  }, [formStore, data])

  const [steps, setSteps] = useState([
    { id: 'details', label: 'Details' },
    { id: 'attributes', label: 'Attributes' },
    {
      id: 'features',
      label: 'Features',
      content: <Features />,
    },
  ])

  useEffect(() => {
    if ((formStore.current as EquipmentInput)?.attributes?.includes(AttributesEnum.CONTAINS_EQUIPMENT)) {
      if (!steps.includes({ id: 'contains', label: 'Contains' })) {
        const updatedSteps = [...steps]
        updatedSteps.push({ id: 'contains', label: 'Contains' })
        formStore.updateField({ path: 'contains[0]', value: ContainsInputSchema.parse({ id: uuidv4() }) })
        setSteps(updatedSteps)
      }
    } else {
      const updatedSteps = steps.filter((step) => step.id !== 'contains')
      setSteps(updatedSteps)
      if ((formStore.current as EquipmentInput)?.contains?.length) {
        formStore.removeField({ path: 'contains' })
      }
    }
  }, [steps, formStore])

  useEffect(() => {
    if (!isEqual(formStore.steps, steps)) formStore.setSteps(steps)
  }, [formStore, steps])

  const stepComponentMap = {
    details: <EquipmentDetails />,
    attributes: <EquipmentAttributes />,
    features: <Features />,
    contains: <Contains />,
  }

  return (
    <Form useUpdateItemMutation={useUpdateEquipmentMutation} useAddNewItemMutation={useAddNewEquipmentMutation}>
      {stepComponentMap[formStore.steps[formStore.stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}

export default EquipmentForm
