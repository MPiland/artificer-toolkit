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
  useActivateEquipmentMutation,
  useSaveEquipmentDraftMutation
} from '#app/data/equipment/mutations'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'
import {
  createEmptyEquipment,
  normalizeEquipmentForSubmit,
  resolveCreateEquipmentSystemId
} from '../equipmentAuthoring.utils'
import { EquipmentAuthoringRenderer } from '../components/EquipmentAuthoringRenderer'

export function EquipmentCreatePage() {
  const route = getRouteApi('/_authed/equipment/new')
  const { systems } = route.useLoaderData()
  const systemId = resolveCreateEquipmentSystemId(systems)

  if (!systemId) {
    return <EquipmentSystemRequiredState />
  }

  return (
    <AuthoringFormProvider>
      <EquipmentCreateAuthoring systemId={systemId} />
    </AuthoringFormProvider>
  )
}

function EquipmentCreateAuthoring({
  systemId
}: {
  systemId: string
}) {
  const navigate = useNavigate()
  const activateMutation = useActivateEquipmentMutation()
  const draftMutation = useSaveEquipmentDraftMutation()
  const [equipment] = useState(() => createEmptyEquipment({ systemId }))

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/equipment' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: ReturnType<typeof normalizeEquipmentForSubmit>) => {
    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Equipment activated.' })

      if (response?.item?.id) {
        await navigate({
          params: buildEquipmentRouteParams(response.publicId, response.item.label),
          to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that equipment yet.' })
    }
  }, [
    activateMutation,
    navigate
  ])

  const form = useAppForm({
    defaultValues: equipment,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeEquipmentForSubmit(value))
    }
  })

  const handleSaveDraft = useCallback(async () => {
    try {
      const draft = await draftMutation.mutateAsync(normalizeEquipmentForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Equipment draft saved.' })
      await navigate({
        params: buildEquipmentRouteParams(draft.publicId, draft.label),
        to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
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
    activateLabel: 'Activate Equipment',
    canSaveDraft: true,
    hasActiveDraft: false,
    mapId: 'equipment',
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Equipment',
    subjectLabel: equipment.label || 'Untitled Equipment',
    systemId: equipment.systemId
  }), [
    equipment.label,
    equipment.systemId
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
        <EquipmentAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

function EquipmentSystemRequiredState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>A system is required before creating equipment.</Alert>
      <Button onClick={() => navigate({ to: '/equipment' })}>Back to equipment</Button>
    </Stack>
  )
}
