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
  useActivateVehicleMutation,
  useSaveVehicleDraftMutation
} from '#app/data/vehicles/mutations'
import {
  createEmptyVehicle,
  normalizeVehicleForSubmit,
  resolveCreateVehicleSystemId
} from '../vehicleAuthoring.utils'
import { VehicleAuthoringRenderer } from '../components/VehicleAuthoringRenderer'

export function VehicleCreatePage() {
  const route = getRouteApi('/_authed/vehicles/new')
  const { systems } = route.useLoaderData()
  const systemId = resolveCreateVehicleSystemId(systems)

  if (!systemId) {
    return <VehicleSystemRequiredState />
  }

  return (
    <AuthoringFormProvider>
      <VehicleCreateAuthoring systemId={systemId} />
    </AuthoringFormProvider>
  )
}

function VehicleCreateAuthoring({
  systemId
}: {
  systemId: string
}) {
  const navigate = useNavigate()
  const activateMutation = useActivateVehicleMutation()
  const draftMutation = useSaveVehicleDraftMutation()
  const [vehicle] = useState(() => createEmptyVehicle({ systemId }))

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/vehicles' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: ReturnType<typeof normalizeVehicleForSubmit>) => {
    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Vehicle activated.' })

      if (response?.item.id) {
        await navigate({ to: '/vehicles/$vehicleId/edit', params: { vehicleId: response.item.id } })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that vehicle yet.' })
    }
  }, [
    activateMutation,
    navigate
  ])

  const form = useAppForm({
    defaultValues: vehicle,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeVehicleForSubmit(value))
    }
  })

  const handleSaveDraft = useCallback(async () => {
    try {
      const draft = await draftMutation.mutateAsync(normalizeVehicleForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Vehicle draft saved.' })
      await navigate({ to: '/vehicles/$vehicleId/edit', params: { vehicleId: draft.subjectId } })
    } catch {
      notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
    }
  }, [
    draftMutation,
    form,
    navigate
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Vehicle',
    canSaveDraft: true,
    hasActiveDraft: false,
    mapId: 'vehicle',
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Vehicle',
    subjectLabel: vehicle.label || 'Untitled Vehicle',
    systemId: vehicle.systemId
  }), [
    vehicle.label,
    vehicle.systemId
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
        <VehicleAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

function VehicleSystemRequiredState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>A system is required before creating a vehicle.</Alert>
      <Button onClick={() => navigate({ to: '/vehicles' })}>Back to vehicles</Button>
    </Stack>
  )
}
