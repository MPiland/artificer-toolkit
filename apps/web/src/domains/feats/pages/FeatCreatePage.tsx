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
  useActivateFeatMutation,
  useSaveFeatDraftMutation
} from '#app/data/feats/mutations'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'
import {
  createEmptyFeat,
  normalizeFeatForSubmit,
  resolveCreateFeatSystemId
} from '../featAuthoring.utils'
import { FeatAuthoringRenderer } from '../components/FeatAuthoringRenderer'

export function FeatCreatePage() {
  const route = getRouteApi('/_authed/feats/new')
  const { systems } = route.useLoaderData()
  const systemId = resolveCreateFeatSystemId(systems)

  if (!systemId) {
    return <FeatSystemRequiredState />
  }

  return (
    <AuthoringFormProvider>
      <FeatCreateAuthoring systemId={systemId} />
    </AuthoringFormProvider>
  )
}

function FeatCreateAuthoring({ systemId }: { systemId: string }) {
  const navigate = useNavigate()
  const activateMutation = useActivateFeatMutation()
  const draftMutation = useSaveFeatDraftMutation()
  const [feat] = useState(() => createEmptyFeat({ systemId }))

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/feats' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: ReturnType<typeof normalizeFeatForSubmit>) => {
    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Feat activated.' })

      if (response?.item?.id) {
        await navigate({
          params: buildFeatRouteParams(response.publicId, response.item.label),
          to: '/feats/$featPublicId/$featSlug'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that feat yet.' })
    }
  }, [
    activateMutation,
    navigate
  ])

  const form = useAppForm({
    defaultValues: feat,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeFeatForSubmit(value))
    }
  })

  const handleSaveDraft = useCallback(async () => {
    try {
      const draft = await draftMutation.mutateAsync(normalizeFeatForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Feat draft saved.' })
      await navigate({
        params: buildFeatRouteParams(draft.publicId, draft.label),
        to: '/feats/$featPublicId/$featSlug/edit'
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
    activateLabel: 'Activate Feat',
    canSaveDraft: true,
    hasActiveDraft: false,
    mapId: 'feat',
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Feat',
    subjectLabel: feat.label || 'Untitled Feat',
    systemId: feat.systemId
  }), [
    feat.label,
    feat.systemId
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
        <FeatAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

function FeatSystemRequiredState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>A system is required before creating feats.</Alert>
      <Button onClick={() => navigate({ to: '/feats' })}>Back to feats</Button>
    </Stack>
  )
}
