import { useUpsertBackground } from '@data/backgrounds'
import { Route } from '@routes/_authed/backgrounds/$action/$_backgroundId'
import { v4 as uuidv4 } from 'uuid'
import Form, { BackgroundDetails, Features } from '@components/Form'
import type { BackgroundInput } from '@types'
import { useDomainForm } from '@hooks'
import type { Background } from '@artificer-toolkit/shared'

const BackgroundForm = () => {
  const { action } = Route.useParams()
  const { background } = Route.useLoaderData()
  const { mutateAsync: upsertBackground } = useUpsertBackground()

  const { steps, stepIndex } = useDomainForm<BackgroundInput, Background>({
    action,
    source: background,
    routeId: Route.id,
    createInitial: ({ action, source }) => {
      if (!source) {
        return {
          __kind: 'BackgroundInput',
          id: uuidv4(),
          label: ''
        }
      }

      if (action === 'new') {
        return {
          ...source,
          __kind: 'BackgroundInput',
          id: uuidv4(),
          label: ''
        }
      }
      return { ...source, __kind: 'BackgroundInput' }
    },
    buildSteps: () => [
      { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
      { id: 'features', label: 'Features' }
    ],
    submit: async (payload) => {
      await upsertBackground(payload)
    }
  })

  const stepComponentMap = {
    details: <BackgroundDetails />,
    features: <Features />
  }

  return <Form>{stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}</Form>
}

export default BackgroundForm
