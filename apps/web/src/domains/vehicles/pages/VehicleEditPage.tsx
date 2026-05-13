import {
  useCallback,
  useMemo,
  useState } from 'react'
import { Alert,
  Button,
  Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { getRouteApi,
  useNavigate,
  useRouter } from '@tanstack/react-router'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import type {
  VehicleAuthoringInputDto,
  VehicleAuthoredDto
} from '@artificer-toolkit/schema/subjects/vehicle'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  InvalidDraftAlert,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import {
  useActivateVehicleMutation,
  useDiscardVehicleDraftMutation,
  useDuplicateVehicleMutation,
  useSaveVehicleDraftMutation
} from '#app/data/vehicles/mutations'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'
import {
  normalizeVehicleForSubmit,
  toVehicleFormValues
} from '../vehicleAuthoring.utils'
import { VehicleAuthoringRenderer } from '../components/VehicleAuthoringRenderer'

type ParsedVehicleDraft = {
  draft: AuthoredDraftDto | null
  isInvalid: boolean
  item: VehicleAuthoredDto | undefined
}

export function VehicleEditPage() {
  const route = getRouteApi('/_authed/vehicles/$vehiclePublicId/$vehicleSlug/edit')
  const { response, draft, vehicleId } = route.useLoaderData()
  const parsedDraft: ParsedVehicleDraft = parseAuthoredDraftPayload(draft ?? null, vehicleAuthoredDtoSchema)
  const draftVehicle = parsedDraft.item
  const activeVehicle = response?.item

  if (!response) {
    if (!draftVehicle) {
      return <VehicleNotFoundState />
    }
    if (parsedDraft.isInvalid && vehicleId) {
      return <InvalidVehicleDraftOnlyState vehicleId={vehicleId} />
    }
  }

  const vehicle = draftVehicle ?? activeVehicle ?? null

  if (!vehicle) {
    return <VehicleNotFoundState />
  }

  if (!vehicle.systemId) {
    return <VehicleMissingSystemState />
  }

  const formKey = `edit:${vehicleId}:${draft?.updatedAt ?? vehicleId ?? 'missing'}:${draft ? 'draft' : 'active'}`

  return (
    <AuthoringFormProvider>
      <VehicleEditAuthoring
        key={formKey}
        activeVehicle={activeVehicle}
        draft={parsedDraft.draft}
        hasInvalidDraft={Boolean(draft && parsedDraft.isInvalid)}
        permissions={response?.permissions}
        vehicle={vehicle}
        vehicleId={vehicleId}
      />
    </AuthoringFormProvider>
  )
}

function VehicleEditAuthoring({
  activeVehicle,
  draft,
  hasInvalidDraft,
  permissions,
  vehicle,
  vehicleId
}: {
  activeVehicle?: VehicleAuthoredDto
  draft: AuthoredDraftDto | null
  hasInvalidDraft: boolean
  permissions?: {
    canCopy: boolean
    canEdit: boolean
  }
  vehicle: VehicleAuthoredDto
  vehicleId: string
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const activateMutation = useActivateVehicleMutation()
  const discardDraftMutation = useDiscardVehicleDraftMutation(vehicleId)
  const draftMutation = useSaveVehicleDraftMutation()
  const duplicateMutation = useDuplicateVehicleMutation()
  const [formValues] = useState(() => toVehicleFormValues(vehicle))
  const readOnly = permissions?.canEdit === false && !draft
  const canCopy = Boolean(permissions?.canCopy && vehicleId)

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/vehicles' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: VehicleAuthoringInputDto) => {
    if (readOnly) return

    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Vehicle activated.' })

      if (response?.item.id && response.item.id !== vehicleId) {
        await navigate({
          params: buildVehicleRouteParams(response.publicId, response.item.label),
          to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit'
        })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that vehicle yet.' })
    }
  }, [
    activateMutation,
    navigate,
    readOnly,
    router,
    vehicleId
  ])

  const form = useAppForm({
    defaultValues: formValues,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeVehicleForSubmit(value))
    }
  })

  const handleDiscardDraft = useCallback(async () => {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale vehicle draft discarded.' })

      if (!activeVehicle) {
        await navigate({ to: '/vehicles' })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }, [
    activeVehicle,
    discardDraftMutation,
    navigate,
    router
  ])

  const handleCopy = useCallback(async () => {
    try {
      const copied = await duplicateMutation.mutateAsync(vehicleId)
      notifications.show({ color: 'green', message: 'Vehicle duplicated as an owned draft.' })

      if (copied?.subjectId) {
        await navigate({
          params: buildVehicleRouteParams(copied.publicId, copied.label),
          to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not duplicate that vehicle yet.' })
    }
  }, [
    duplicateMutation,
    navigate,
    vehicleId
  ])

  const handleSaveDraft = useCallback(async () => {
    if (readOnly) return

    try {
      await draftMutation.mutateAsync(normalizeVehicleForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Vehicle draft saved.' })
      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
    }
  }, [
    draftMutation,
    form,
    readOnly,
    router
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Vehicle',
    canCopy,
    canSaveDraft: !readOnly,
    hasActiveDraft: Boolean(draft && activeVehicle),
    mapId: 'vehicle',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Vehicle',
    subjectLabel: formValues.label || 'Untitled Vehicle',
    systemId: formValues.systemId
  }), [
    activeVehicle,
    canCopy,
    draft,
    formValues.label,
    formValues.systemId,
    readOnly
  ])

  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onCancel: handleCancel,
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: canCopy ? handleCopy : undefined,
    onSaveDraft: readOnly ? undefined : handleSaveDraft
  }), [
    canCopy,
    form,
    handleCancel,
    handleCopy,
    handleSaveDraft,
    readOnly
  ])

  useAuthoringFormRegistration(registration, actions)

  return (
    <form.AppForm>
      <Stack>
        {hasInvalidDraft
          ? (
              <InvalidDraftAlert
                domainLabel='vehicle'
                isDiscarding={discardDraftMutation.isPending}
                onDiscard={() => void handleDiscardDraft()}
              />
            )
          : null}
        <AuthoringFormLayout>
          <VehicleAuthoringRenderer form={form} />
        </AuthoringFormLayout>
      </Stack>
    </form.AppForm>
  )
}

function VehicleMissingSystemState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That vehicle is missing a system and cannot be edited.</Alert>
      <Button onClick={() => navigate({ to: '/vehicles' })}>Back to vehicles</Button>
    </Stack>
  )
}

function VehicleNotFoundState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That vehicle could not be found.</Alert>
      <Button onClick={() => navigate({ to: '/vehicles' })}>Back to vehicles</Button>
    </Stack>
  )
}

function InvalidVehicleDraftOnlyState({ vehicleId }: { vehicleId: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardVehicleDraftMutation(vehicleId)

  async function handleDiscardDraft() {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale vehicle draft discarded.' })
      await router.invalidate()
      await navigate({ to: '/vehicles' })
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }

  return (
    <Stack>
      <InvalidDraftAlert
        domainLabel='vehicle'
        isDiscarding={discardDraftMutation.isPending}
        onDiscard={() => void handleDiscardDraft()}
      />
      <Button onClick={() => navigate({ to: '/vehicles' })}>Back to vehicles</Button>
    </Stack>
  )
}
