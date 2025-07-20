import { useEffect, useMemo, useCallback, useLayoutEffect } from 'react'
import { useAddNewEquipmentMutation, useUpdateEquipmentMutation } from '@/apis/equipment.api'
import { v4 as uuidv4 } from 'uuid'
import { Route } from '@/routes/_protected/equipment/$action/$_equipmentId'
import { useEquipmentData, useSystemPref } from '@/hooks'
import { EquipmentInputSchema } from '@/schemas'
import { useTypedFormStore } from '@/store'
import type { EquipmentInput } from '@/types'
import Form, { EquipmentDetails, EquipmentAttributes, Contains, Features, useAppForm } from '@/components/Form'
import { Attributes as AttributesEnum } from '@/enums'
import { convertTypenameToKindInput } from '@/utils'

const EquipmentForm = () => {
  const { _equipmentId: equipmentId, action } = Route.useParams()
  const {
    equipment: { findEquipment },
  } = useEquipmentData()
  const [systemPref] = useSystemPref()

  const equipmentData = findEquipment(equipmentId)

  const store = useTypedFormStore<EquipmentInput>()

  const current = store((state) => state.current)
  const steps = store((state) => state.steps)
  const setSteps = store((state) => state.setSteps)
  const setCurrent = store((state) => state.setCurrent)
  const stepIndex = store((state) => state.stepIndex)
  const registerForm = store((state) => state.registerForm)
  const attributes = store((state) => state.current?.attributes)
  const formReset = store((state) => state.formReset)

  const createDataObject = useCallback(() => {
    if (equipmentData) {
      const equipmentInput = convertTypenameToKindInput(equipmentData)
      if (equipmentInput) {
        if (action === 'new') {
          return EquipmentInputSchema.parse({
            ...equipmentInput,
            id: uuidv4(),
            label: '',
            masterId: undefined,
            category: '',
            systemId: systemPref,
          })
        } else {
          return EquipmentInputSchema.parse({ ...equipmentInput })
        }
      }
    }
    return EquipmentInputSchema.parse({
      __kind: 'EquipmentInput',
      id: uuidv4(),
      category: '',
      systemId: systemPref,
      label: '',
    })
  }, [action, systemPref, equipmentData])

  const data = useMemo(() => createDataObject(), [createDataObject])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data as EquipmentInput)
    }
  }, [current, data, setCurrent])

  const form = useAppForm({
    defaultValues: data,
  })

  const equipmentSteps = useMemo(() => {
    if (attributes?.includes(AttributesEnum.CONTAINS_EQUIPMENT)) {
      return [
        { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
        { id: 'attributes', label: 'Attributes', fieldValidation: {}, defaultValues: {} },
        { id: 'contains', label: 'Contains', fieldValidation: {}, defaultValues: {} },
        { id: 'features', label: 'Features', fieldValidation: {}, defaultValues: {} },
      ]
    } else {
      return [
        { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
        { id: 'attributes', label: 'Attributes', fieldValidation: {}, defaultValues: {} },
        { id: 'features', label: 'Features', fieldValidation: {}, defaultValues: {} },
      ]
    }
  }, [attributes])

  useLayoutEffect(() => {
    if (!steps.every((step) => equipmentSteps.some((s) => s.id === step.id)) || !steps?.length) {
      setSteps(equipmentSteps)
    }
  }, [steps, equipmentSteps, setSteps])

  useEffect(() => {
    if (!formReset) {
      registerForm(form.reset)
    }
  }, [formReset, registerForm, form.reset])

  const stepComponentMap = {
    details: <EquipmentDetails form={form} />,
    attributes: <EquipmentAttributes form={form} />,
    features: <Features />,
    contains: <Contains form={form} />,
  }

  return (
    <Form useUpdateItemMutation={useUpdateEquipmentMutation} useAddNewItemMutation={useAddNewEquipmentMutation}>
      {stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}

export default EquipmentForm
