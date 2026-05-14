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
  useActivateCreatureMutation,
  useSaveCreatureDraftMutation
} from '#app/data/creatures/mutations'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'
import {
  createEmptyCreature,
  normalizeCreatureForSubmit,
  resolveCreateCreatureSystemId
} from '../creatureAuthoring.utils'
import { CreatureAuthoringRenderer } from '../components/CreatureAuthoringRenderer'

export function CreatureCreatePage() {
  const route = getRouteApi('/_authed/creatures/new')
  const { systems } = route.useLoaderData()
  const systemId = resolveCreateCreatureSystemId(systems)

  if (!systemId) {
    return <CreatureSystemRequiredState />
  }

  return (
    <AuthoringFormProvider>
      <CreatureCreateAuthoring systemId={systemId} />
    </AuthoringFormProvider>
  )
}

function CreatureCreateAuthoring({ systemId }: { systemId: string }) {
  const navigate = useNavigate()
  const activateMutation = useActivateCreatureMutation()
  const draftMutation = useSaveCreatureDraftMutation()
  const [creature] = useState(() => createEmptyCreature({ systemId }))

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/creatures' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: ReturnType<typeof normalizeCreatureForSubmit>) => {
    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Creature activated.' })

      if (response?.item?.id) {
        await navigate({
          params: buildCreatureRouteParams(response.publicId, response.item.label),
          to: '/creatures/$creaturePublicId/$creatureSlug'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that creature yet.' })
    }
  }, [
    activateMutation,
    navigate
  ])

  const form = useAppForm({
    defaultValues: creature,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeCreatureForSubmit(value))
    }
  })

  const handleSaveDraft = useCallback(async () => {
    try {
      const draft = await draftMutation.mutateAsync(normalizeCreatureForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Creature draft saved.' })
      await navigate({
        params: buildCreatureRouteParams(draft.publicId, draft.label),
        to: '/creatures/$creaturePublicId/$creatureSlug/edit'
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
    activateLabel: 'Activate Creature',
    canSaveDraft: true,
    hasActiveDraft: false,
    mapId: 'creature',
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Creature',
    subjectLabel: creature.label || 'Untitled Creature',
    systemId: creature.systemId
  }), [
    creature.label,
    creature.systemId
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
        <CreatureAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

function CreatureSystemRequiredState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>A system is required before creating creatures.</Alert>
      <Button onClick={() => navigate({ to: '/creatures' })}>Back to creatures</Button>
    </Stack>
  )
}
