import { useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import { useGetEquipment, useAddEquipment, useUpdateEquipment } from '~apis'
import { v4 as uuidv4 } from 'uuid'
import { Route } from '~routes/_authed/equipment/$action/$_equipmentId'
import { useSystemPref } from '~hooks'
import { EquipmentInputSchema } from '~schemas'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import type { EquipmentInput } from '~types'
import Form, { EquipmentDetails, EquipmentAttributes, Contains, Features } from '~components/Form'
import { Attributes as AttributesEnum } from '~enums'
import { convertTypenameToKindInput } from '~utils'

const EquipmentForm = () => {
  const { _equipmentId: equipmentId, action } = Route.useParams()

  const [systemPref] = useSystemPref()

  const { data: equipmentData } = useGetEquipment(equipmentId)

  const { mutateAsync: addEquipment } = useAddEquipment()
  const { mutateAsync: updateEquipment } = useUpdateEquipment()

  const store = useTypedFormStore<EquipmentInput>()

  const { current, steps, setSteps, setCurrent, stepIndex, registerForm, formSubmit, attributes } =
    useOptimizedSelector(store, (state) => ({
      current: state.current,
      steps: state.meta.steps,
      setSteps: state.setSteps,
      setCurrent: state.setCurrent,
      stepIndex: state.meta.stepIndex,
      registerForm: state.registerForm,
      attributes: state.current?.attributes,
      formSubmit: state.formSubmit,
    }))

  const data = useMemo(() => {
    if (equipmentData) {
      const equipmentInput = convertTypenameToKindInput(equipmentData) as EquipmentInput
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

  const handleSubmit = useCallback(async () => {
    if (action === 'new') {
      try {
        const result = await addEquipment(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    } else {
      try {
        const result = await updateEquipment(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    }
  }, [action, addEquipment, updateEquipment, data])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data)
    }
  }, [current, data, setCurrent])

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
    if (!formSubmit) {
      registerForm(handleSubmit)
    }
  }, [formSubmit, registerForm, handleSubmit])

  const stepComponentMap = {
    details: <EquipmentDetails />,
    attributes: <EquipmentAttributes />,
    features: <Features />,
    contains: <Contains />,
  }

  return <Form>{stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}</Form>
}

export default EquipmentForm
