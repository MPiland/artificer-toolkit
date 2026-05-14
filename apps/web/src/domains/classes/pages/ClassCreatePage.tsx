import { useCallback, useMemo, useState } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
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
  useActivateClassMutation,
  useSaveClassDraftMutation
} from '#app/data/classes/mutations'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import {
  createEmptyClass,
  normalizeClassForSubmit,
  resolveCreateClassSystemId
} from '../classAuthoring.utils'
import { ClassAuthoringRenderer } from '../components/ClassAuthoringRenderer'

export function ClassCreatePage() {
  const route = getRouteApi('/_authed/classes/new')
  const { systems } = route.useLoaderData()
  const systemId = resolveCreateClassSystemId(systems)

  if (!systemId) {
    return <ClassSystemRequiredState />
  }

  return (
    <AuthoringFormProvider>
      <ClassCreateAuthoring systemId={systemId} />
    </AuthoringFormProvider>
  )
}

function ClassCreateAuthoring({
  systemId
}: {
  systemId: string
}) {
  const navigate = useNavigate()
  const activateMutation = useActivateClassMutation()
  const draftMutation = useSaveClassDraftMutation()
  const [classRecord] = useState(() => createEmptyClass({ systemId }))

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/classes' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: ReturnType<typeof normalizeClassForSubmit>) => {
    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Class activated.' })

      if (response?.item?.id) {
        await navigate({
          params: buildClassRouteParams(response.publicId, response.item.label),
          to: '/classes/$classPublicId/$classSlug/edit'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that class yet.' })
    }
  }, [
    activateMutation,
    navigate
  ])

  const form = useAppForm({
    defaultValues: classRecord,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeClassForSubmit(value))
    }
  })

  const handleSaveDraft = useCallback(async () => {
    try {
      const draft = await draftMutation.mutateAsync(normalizeClassForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Class draft saved.' })
      await navigate({
        params: buildClassRouteParams(draft.publicId, draft.label),
        to: '/classes/$classPublicId/$classSlug/edit'
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
    activateLabel: 'Activate Class',
    canSaveDraft: true,
    hasActiveDraft: false,
    mapId: 'class',
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Class',
    subjectLabel: classRecord.label || 'Untitled Class',
    systemId: classRecord.systemId
  }), [
    classRecord.label,
    classRecord.systemId
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
        <ClassAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

function ClassSystemRequiredState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>A system is required before creating a class.</Alert>
      <Button onClick={() => navigate({ to: '/classes' })}>Back to classes</Button>
    </Stack>
  )
}
