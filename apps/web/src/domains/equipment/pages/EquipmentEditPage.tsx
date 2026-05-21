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
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import type {
  EquipmentAuthoringInputDto,
  EquipmentAuthoredDto
} from '@artificer-toolkit/schema/subjects/equipment'
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
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import {
  useActivateEquipmentMutation,
  useDiscardEquipmentDraftMutation,
  useDuplicateEquipmentMutation,
  useSaveEquipmentDraftMutation
} from '#app/data/equipment/mutations'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'
import {
  normalizeEquipmentForSubmit,
  toEquipmentFormValues
} from '../equipmentAuthoring.utils'
import { EquipmentAuthoringRenderer } from '../components/EquipmentAuthoringRenderer'

type ParsedEquipmentDraft = {
  draft: AuthoredDraftDto | null
  isInvalid: boolean
  item: EquipmentAuthoredDto | undefined
}

export function EquipmentEditPage() {
  const route = getRouteApi('/_authed/equipment/$equipmentPublicId/$equipmentSlug/edit')
  const { equipmentId, response, draft } = route.useLoaderData()
  const parsedDraft: ParsedEquipmentDraft = parseAuthoredDraftPayload(draft ?? null, equipmentAuthoredDtoSchema)
  const draftEquipment = parsedDraft.item
  const activeEquipment = response?.item ?? undefined

  if (!response) {
    if (!draftEquipment) {
      return <EquipmentNotFoundState />
    }
    if (parsedDraft.isInvalid && equipmentId) {
      return <InvalidEquipmentDraftOnlyState equipmentId={equipmentId} />
    }
  }

  const equipment = draftEquipment ?? activeEquipment ?? null

  if (!equipment) {
    return <EquipmentNotFoundState />
  }

  if (!equipment.systemId) {
    return <EquipmentMissingSystemState />
  }

  const formKey = `edit:${equipmentId}:${draft?.updatedAt ?? equipmentId ?? 'missing'}:${draft ? 'draft' : 'active'}`

  return (
    <AuthoringFormProvider>
      <EquipmentEditAuthoring
        key={formKey}
        activeEquipment={activeEquipment}
        draft={parsedDraft.draft}
        equipment={equipment}
        equipmentId={equipmentId}
        hasInvalidDraft={Boolean(draft && parsedDraft.isInvalid)}
        permissions={response?.permissions}
      />
    </AuthoringFormProvider>
  )
}

function EquipmentEditAuthoring({
  activeEquipment,
  draft,
  equipment,
  equipmentId,
  hasInvalidDraft,
  permissions
}: {
  activeEquipment?: EquipmentAuthoredDto
  draft: AuthoredDraftDto | null
  equipment: EquipmentAuthoredDto
  equipmentId: string
  hasInvalidDraft: boolean
  permissions?: {
    canCopy: boolean
    canDelete: boolean
    canEdit: boolean
  }
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const activateMutation = useActivateEquipmentMutation()
  const discardDraftMutation = useDiscardEquipmentDraftMutation(equipmentId)
  const draftMutation = useSaveEquipmentDraftMutation()
  const duplicateMutation = useDuplicateEquipmentMutation()
  const [formValues] = useState(() => toEquipmentFormValues(equipment))
  const readOnly = permissions?.canEdit === false && !draft
  const canCopy = Boolean(permissions?.canCopy && equipmentId)
  const canDelete = !readOnly && Boolean(draft || permissions?.canDelete)
  const {
    confirmation: deleteConfirmation,
    isDeleting,
    requestDelete
  } = useAuthoredDeleteAction({
    deleteActive: api.content.equipment.deleteActive,
    deleteDraft: api.content.equipment.discardDraft,
    detailSubjectQueryKey: queryKeys.content.equipment.detailRoot(equipmentId),
    domainLabel: 'Equipment',
    domainQueryKey: queryKeys.content.equipment.all(),
    draftQueryKey: queryKeys.content.equipment.draft(equipmentId),
    onDeleted: async () => navigate({ to: '/equipment' })
  })

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/equipment' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: EquipmentAuthoringInputDto) => {
    if (readOnly) return

    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Equipment activated.' })

      if (response?.item?.id && response.item.id !== equipmentId) {
        await navigate({
          params: buildEquipmentRouteParams(response.publicId, response.item.label),
          to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
        })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that equipment yet.' })
    }
  }, [
    activateMutation,
    equipmentId,
    navigate,
    readOnly,
    router
  ])

  const form = useAppForm({
    defaultValues: formValues,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeEquipmentForSubmit(value))
    }
  })

  const handleDiscardDraft = useCallback(async () => {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale equipment draft discarded.' })

      if (!activeEquipment) {
        await navigate({ to: '/equipment' })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }, [
    activeEquipment,
    discardDraftMutation,
    navigate,
    router
  ])

  const handleCopy = useCallback(async () => {
    try {
      const copied = await duplicateMutation.mutateAsync(equipmentId)
      notifications.show({ color: 'green', message: 'Equipment duplicated as an owned draft.' })

      if (copied?.subjectId) {
        await navigate({
          params: buildEquipmentRouteParams(copied.publicId, copied.label),
          to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not duplicate that equipment yet.' })
    }
  }, [
    duplicateMutation,
    equipmentId,
    navigate
  ])

  const handleSaveDraft = useCallback(async () => {
    if (readOnly) return

    try {
      await draftMutation.mutateAsync(normalizeEquipmentForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Equipment draft saved.' })
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

  const handleDelete = useCallback(() => {
    requestDelete({
      id: equipmentId,
      kind: draft ? 'draft' : 'active',
      label: formValues.label || 'Untitled Equipment'
    })
  }, [
    draft,
    equipmentId,
    formValues.label,
    requestDelete
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Equipment',
    canDelete,
    canCopy,
    canSaveDraft: !readOnly,
    hasActiveDraft: Boolean(draft && activeEquipment),
    isDraft: Boolean(draft),
    mapId: 'equipment',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Equipment',
    subjectLabel: formValues.label || 'Untitled Equipment',
    systemId: formValues.systemId,
    isDeleting
  }), [
    activeEquipment,
    canDelete,
    canCopy,
    draft,
    formValues.label,
    formValues.systemId,
    isDeleting,
    readOnly
  ])

  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onCancel: handleCancel,
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: canCopy ? handleCopy : undefined,
    onDelete: canDelete ? handleDelete : undefined,
    onSaveDraft: readOnly ? undefined : handleSaveDraft
  }), [
    canDelete,
    canCopy,
    form,
    handleCancel,
    handleCopy,
    handleDelete,
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
                domainLabel='equipment'
                isDiscarding={discardDraftMutation.isPending}
                onDiscard={() => void handleDiscardDraft()}
              />
            )
          : null}
        <AuthoringFormLayout>
          <EquipmentAuthoringRenderer form={form} />
        </AuthoringFormLayout>
        {deleteConfirmation}
      </Stack>
    </form.AppForm>
  )
}

function EquipmentMissingSystemState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That equipment is missing a system and cannot be edited.</Alert>
      <Button onClick={() => navigate({ to: '/equipment' })}>Back to equipment</Button>
    </Stack>
  )
}

function EquipmentNotFoundState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That equipment could not be found.</Alert>
      <Button onClick={() => navigate({ to: '/equipment' })}>Back to equipment</Button>
    </Stack>
  )
}

function InvalidEquipmentDraftOnlyState({ equipmentId }: { equipmentId: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardEquipmentDraftMutation(equipmentId)

  async function handleDiscardDraft() {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale equipment draft discarded.' })
      await router.invalidate()
      await navigate({ to: '/equipment' })
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }

  return (
    <Stack>
      <InvalidDraftAlert
        domainLabel='equipment'
        isDiscarding={discardDraftMutation.isPending}
        onDiscard={() => void handleDiscardDraft()}
      />
      <Button onClick={() => navigate({ to: '/equipment' })}>Back to equipment</Button>
    </Stack>
  )
}
