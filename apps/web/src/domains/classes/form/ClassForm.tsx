import { useUpsertClass } from '@data/classes'
import type { ClassInput } from '@types'
import { Route } from '@routes/_authed/classes/$action/$_classId'
import { v4 as uuidv4 } from 'uuid'
import Form, { Attributes, Details, Proficiencies, StartingEquipment, Features } from './steps'
import { Categories } from '@types'
import { useDomainForm } from '@hooks'
import type { Class } from '@artificer-toolkit/shared'

const ClassForm = () => {
  const { action } = Route.useParams()
  const { class: class_ } = Route.useLoaderData()
  const { mutateAsync: upsertClass } = useUpsertClass()

  const { steps, stepIndex } = useDomainForm<ClassInput, Class>({
    action,
    source: class_,
    routeId: Route.id,
    createInitial: ({ action, source }) => {
      if (!source) {
        return {
          __kind: 'ClassInput',
          id: uuidv4(),
          category: Categories.BASE,
          label: ''
        }
      }
      if (action === 'new') {
        return {
          ...source,
          __kind: 'ClassInput',
          id: uuidv4(),
          label: '',
          category: Categories.BASE
        }
      }
      return { ...source, __kind: 'ClassInput' }
    },
    buildSteps: (data) => {
      if (data?.categoryId === Categories.SUBCLASS) {
        return [
          { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
          { id: 'proficiencies', label: 'Proficiencies', fieldValidation: {}, defaultValues: {} },
          { id: 'attributes', label: 'Attributes', fieldValidation: {}, defaultValues: {} },
          { id: 'features', label: 'Features', fieldValidation: {}, defaultValues: {} }
        ]
      } else {
        return [
          { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
          { id: 'proficiencies', label: 'Proficiencies', fieldValidation: {}, defaultValues: {} },
          { id: 'startingEquipment', label: 'Equipment', fieldValidation: {}, defaultValues: {} },
          { id: 'attributes', label: 'Attributes', fieldValidation: {}, defaultValues: {} },
          { id: 'features', label: 'Features' }
        ]
      }
    },
    submit: async (payload) => {
      await upsertClass(payload)
    }
  })

  const stepComponentMap = {
    details: <Details />,
    proficiencies: <Proficiencies />,
    startingEquipment: <StartingEquipment />,
    attributes: <Attributes />,
    features: <Features />
  }

  return <Form>{stepComponentMap[steps[stepIndex]?.id as keyof typeof stepComponentMap] || null}</Form>
}
export default ClassForm
