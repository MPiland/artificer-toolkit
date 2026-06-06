import {
  useCallback,
  useMemo,
  useState
} from 'react'
import {
  Alert,
  Button,
  Stack
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  AuthoringFormProvider,
  AuthoringWorkspaceLayout,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import {
  useActivateRaceMutation,
  useSaveRaceDraftMutation
} from '#app/data/races/mutations'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'
import {
  createEmptyRace,
  normalizeRaceForSubmit,
  resolveCreateRaceSystemId
} from '../raceAuthoring.utils'
import { RaceAuthoringRenderer } from '../components/RaceAuthoringRenderer'
import { RaceAuthoringPreview } from '../components/RaceAuthoringPreview'

export function RaceCreatePage() {
  const route = getRouteApi('/_authed/races/new')
  const { systems } = route.useLoaderData()
  const systemId = resolveCreateRaceSystemId(systems)

  if (!systemId) {
    return <RaceSystemRequiredState />
  }

  return (
    <AuthoringFormProvider>
      <RaceCreateAuthoring systemId={systemId} />
    </AuthoringFormProvider>
  )
}

function RaceCreateAuthoring({ systemId }: { systemId: string }) {
  const navigate = useNavigate()
  const activateMutation = useActivateRaceMutation()
  const draftMutation = useSaveRaceDraftMutation()
  const [race] = useState(() => createEmptyRace({ systemId }))

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/races' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: ReturnType<typeof normalizeRaceForSubmit>) => {
    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Race activated.' })

      if (response?.item?.id) {
        await navigate({
          params: buildRaceRouteParams(response.publicId, response.item.label),
          to: '/races/$racePublicId/$raceSlug'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that race yet.' })
    }
  }, [
    activateMutation,
    navigate
  ])

  const form = useAppForm({
    defaultValues: race,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeRaceForSubmit(value))
    }
  })

  const handleSaveDraft = useCallback(async () => {
    try {
      const draft = await draftMutation.mutateAsync(normalizeRaceForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Race draft saved.' })
      await navigate({
        params: buildRaceRouteParams(draft.publicId, draft.label),
        to: '/races/$racePublicId/$raceSlug/edit'
      })
    } catch {
      notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
    }
  }, [
    draftMutation,
    form,
    navigate
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Race',
    canSaveDraft: true,
    hasActiveDraft: false,
    mapId: 'race',
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Race',
    subjectLabel: race.label || 'Untitled Race',
    systemId: race.systemId
  }), [
    race.label,
    race.systemId
  ])

  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onCancel: handleCancel,
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onSaveDraft: handleSaveDraft
  }), [
    form,
    handleCancel,
    handleSaveDraft
  ])

  useAuthoringFormRegistration(registration, actions)

  return (
    <form.AppForm>
      <AuthoringWorkspaceLayout
        preview={(
          <form.Subscribe selector={(state) => state.values}>
            {(values) => <RaceAuthoringPreview values={values} />}
          </form.Subscribe>
        )}
        previewLabel='Race preview'
      >
        <RaceAuthoringRenderer form={form} />
      </AuthoringWorkspaceLayout>
    </form.AppForm>
  )
}

function RaceSystemRequiredState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>A system is required before creating races.</Alert>
      <Button onClick={() => navigate({ to: '/races' })}>Back to races</Button>
    </Stack>
  )
}
