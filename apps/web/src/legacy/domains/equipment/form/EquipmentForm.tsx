import { useUpsertEquipment } from '@data/equipment'
import { v4 as uuidv4 } from 'uuid'
import { Route } from '@routes/_authed/equipment/$action/$_equipmentId'
import { useDomainForm } from '@hooks'
import type { EquipmentInput } from '@types'
import Form, { EquipmentDetails, EquipmentAttributes, Contains, Features } from '@components/Form'
import { Attributes as AttributesEnum } from '@types'
import type { Equipment } from '@artificer-toolkit/shared'

const EquipmentForm = () => {
  const { action } = Route.useParams()
  const { equipment } = Route.useLoaderData()
  const { mutateAsync: upsertEquipment } = useUpsertEquipment()

  const { steps, stepIndex } = useDomainForm<EquipmentInput, Equipment>({
    action,
    source: equipment,
    routeId: Route.id,
    createInitial: ({ action, source }) => {
      if (!source) {
        return {
          __kind: 'EquipmentInput',
          id: uuidv4(),
          category: '',
          label: ''
        }
      }

      if (action === 'new') {
        return {
          ...source,
          __kind: 'EquipmentInput',
          id: uuidv4(),
          label: '',
          category: ''
        }
      }

      return { ...source, __kind: 'EquipmentInput' }
    },
    buildSteps: (data) => {
      if (data?.attributeIds?.includes(AttributesEnum.CONTAINS_EQUIPMENT)) {
        return [
          { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
          { id: 'attributes', label: 'Attributes', fieldValidation: {}, defaultValues: {} },
          { id: 'contains', label: 'Contains', fieldValidation: {}, defaultValues: {} },
          { id: 'features', label: 'Features', fieldValidation: {}, defaultValues: {} }
        ]
      } else {
        return [
          { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
          { id: 'attributes', label: 'Attributes', fieldValidation: {}, defaultValues: {} },
          { id: 'features', label: 'Features', fieldValidation: {}, defaultValues: {} }
        ]
      }
    },
    submit: async (payload) => {
      await upsertEquipment(payload)
    }
  })

  const stepComponentMap = {
    details: <EquipmentDetails />,
    attributes: <EquipmentAttributes />,
    features: <Features />,
    contains: <Contains />
  }

  return <Form>{stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}</Form>
}

export default EquipmentForm
