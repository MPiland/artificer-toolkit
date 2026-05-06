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
  AuthoringFormLayout,
  AuthoringFormProvider,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import {
  useActivateBackgroundMutation,
  useSaveBackgroundDraftMutation
} from '#app/data/backgrounds/mutations'
import {
  createEmptyBackground,
  normalizeBackgroundForSubmit,
  resolveCreateBackgroundSystemId
} from '../backgroundAuthoring.utils'
import { BackgroundAuthoringRenderer } from '../components/BackgroundAuthoringRenderer'

export function BackgroundCreatePage() {
  const route = getRouteApi('/_authed/backgrounds/new')
  const { systems } = route.useLoaderData()
  const systemId = resolveCreateBackgroundSystemId(systems)

  if (!systemId) {
    return <BackgroundSystemRequiredState />
  }

  return (
    <AuthoringFormProvider>
      <BackgroundCreateAuthoring systemId={systemId} />
    </AuthoringFormProvider>
  )
}

function BackgroundCreateAuthoring({ systemId }: { systemId: string }) {
  const navigate = useNavigate()
  const activateMutation = useActivateBackgroundMutation()
  const draftMutation = useSaveBackgroundDraftMutation()
  const [background] = useState(() => createEmptyBackground({ systemId }))

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/backgrounds' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: ReturnType<typeof normalizeBackgroundForSubmit>) => {
    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Background activated.' })

      if (response?.item.id) {
        await navigate({ to: '/backgrounds/$backgroundId', params: { backgroundId: response.item.id } })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that background yet.' })
    }
  }, [
    activateMutation,
    navigate
  ])

  const form = useAppForm({
    defaultValues: background,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeBackgroundForSubmit(value))
    }
  })

  const handleSaveDraft = useCallback(async () => {
    try {
      const draft = await draftMutation.mutateAsync(normalizeBackgroundForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Background draft saved.' })
      await navigate({ to: '/backgrounds/$backgroundId/edit', params: { backgroundId: draft.subjectId } })
    } catch {
      notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
    }
  }, [
    draftMutation,
    form,
    navigate
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Background',
    canSaveDraft: true,
    hasActiveDraft: false,
    mapId: 'background',
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Background',
    subjectLabel: background.label || 'Untitled Background',
    systemId: background.systemId
  }), [
    background.label,
    background.systemId
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
      <AuthoringFormLayout>
        <BackgroundAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

function BackgroundSystemRequiredState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>A system is required before creating backgrounds.</Alert>
      <Button onClick={() => navigate({ to: '/backgrounds' })}>Back to backgrounds</Button>
    </Stack>
  )
}
