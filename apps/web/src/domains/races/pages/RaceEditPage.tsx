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
import {
  getRouteApi,
  useNavigate,
  useRouter
} from '@tanstack/react-router'
import {
  raceAuthoringInputDtoSchema,
  type RaceAuthoringInputDto,
  type RaceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import {
  AuthoringFormProvider,
  AuthoringWorkspaceLayout,
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
  useActivateRaceMutation,
  useDiscardRaceDraftMutation,
  useDuplicateRaceMutation,
  useSaveRaceDraftMutation
} from '#app/data/races/mutations'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'
import {
  normalizeRaceForSubmit,
  toRaceFormValues,
  type RaceFormValues
} from '../raceAuthoring.utils'
import { RaceAuthoringRenderer } from '../components/RaceAuthoringRenderer'
import { RaceAuthoringPreview } from '../components/RaceAuthoringPreview'

type ParsedRaceDraft = {
  draft: AuthoredDraftDto | null
  isInvalid: boolean
  item: RaceAuthoringInputDto | undefined
}

export function RaceEditPage() {
  const route = getRouteApi('/_authed/races/$racePublicId/$raceSlug')
  const { draft, raceId, response } = route.useLoaderData()
  const parsedDraft: ParsedRaceDraft = parseAuthoredDraftPayload(draft ?? null, raceAuthoringInputDtoSchema)
  const draftRace = parsedDraft.item
  const activeRace = response?.item ?? undefined

  if (!response) {
    if (parsedDraft.isInvalid) {
      return <InvalidRaceDraftOnlyState raceId={raceId} />
    }
    if (!draftRace) {
      return <RaceNotFoundState />
    }
  }

  const race = draftRace ?? activeRace ?? null

  if (!race) {
    return <RaceNotFoundState />
  }

  const formKey = `edit:${raceId}:${draft?.updatedAt ?? raceId}:${draftRace ? 'draft' : 'active'}`

  return (
    <AuthoringFormProvider>
      <RaceEditAuthoring
        key={formKey}
        activeRace={activeRace}
        draft={parsedDraft.draft}
        hasInvalidDraft={Boolean(draft && parsedDraft.isInvalid)}
        permissions={response?.permissions}
        race={toRaceFormValues(race)}
        raceId={raceId}
      />
    </AuthoringFormProvider>
  )
}

function RaceEditAuthoring({
  activeRace,
  draft,
  hasInvalidDraft,
  permissions,
  race,
  raceId
}: {
  activeRace?: RaceAuthoredDto
  draft: AuthoredDraftDto | null
  hasInvalidDraft: boolean
  permissions?: {
    canCopy: boolean
    canDelete: boolean
    canEdit: boolean
  }
  race: RaceFormValues
  raceId: string
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const activateMutation = useActivateRaceMutation()
  const discardDraftMutation = useDiscardRaceDraftMutation(raceId)
  const draftMutation = useSaveRaceDraftMutation()
  const duplicateMutation = useDuplicateRaceMutation()
  const [formValues] = useState(() => race)
  const readOnly = Boolean(activeRace && permissions?.canEdit === false)
  const canCopy = Boolean(permissions?.canCopy && raceId)
  const canDelete = !readOnly && Boolean(draft || permissions?.canDelete)
  const {
    confirmation: deleteConfirmation,
    isDeleting,
    requestDelete
  } = useAuthoredDeleteAction({
    deleteActive: api.content.races.deleteActive,
    deleteDraft: api.content.races.discardDraft,
    detailSubjectQueryKey: queryKeys.content.races.detailRoot(raceId),
    domainLabel: 'Race',
    domainQueryKey: queryKeys.content.races.all(),
    draftQueryKey: queryKeys.content.races.draft(raceId),
    onDeleted: async () => navigate({ to: '/races' })
  })

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/races' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: RaceAuthoringInputDto) => {
    if (readOnly) return

    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Race activated.' })

      if (response?.item?.id && response.item.id !== raceId) {
        await navigate({
          params: buildRaceRouteParams(response.publicId, response.item.label),
          to: '/races/$racePublicId/$raceSlug'
        })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that race yet.' })
    }
  }, [
    activateMutation,
    navigate,
    raceId,
    readOnly,
    router
  ])

  const form = useAppForm({
    defaultValues: formValues,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeRaceForSubmit(value))
    }
  })

  const handleDiscardDraft = useCallback(async () => {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale race draft discarded.' })

      if (!activeRace) {
        await navigate({ to: '/races' })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }, [
    activeRace,
    discardDraftMutation,
    navigate,
    router
  ])

  const handleCopy = useCallback(async () => {
    try {
      const copied = await duplicateMutation.mutateAsync(raceId)
      notifications.show({ color: 'green', message: 'Race duplicated as an owned draft.' })

      if (copied?.subjectId) {
        await navigate({
          params: buildRaceRouteParams(copied.publicId, copied.label),
          to: '/races/$racePublicId/$raceSlug/edit'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not duplicate that race yet.' })
    }
  }, [
    duplicateMutation,
    navigate,
    raceId
  ])

  const handleSaveDraft = useCallback(async () => {
    if (readOnly) return

    try {
      await draftMutation.mutateAsync(normalizeRaceForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Race draft saved.' })
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
      id: raceId,
      kind: draft ? 'draft' : 'active',
      label: formValues.label || 'Untitled Race'
    })
  }, [
    draft,
    formValues.label,
    raceId,
    requestDelete
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Race',
    canDelete,
    canCopy,
    canSaveDraft: !readOnly,
    hasActiveDraft: Boolean(draft && activeRace),
    isDraft: Boolean(draft),
    mapId: 'race',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Race',
    subjectLabel: formValues.label || 'Untitled Race',
    systemId: formValues.systemId,
    isDeleting
  }), [
    activeRace,
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
      <>
        <AuthoringWorkspaceLayout
          preview={(
            <form.Subscribe selector={(state) => state.values}>
              {(values) => <RaceAuthoringPreview values={values} />}
            </form.Subscribe>
          )}
          previewLabel='Race preview'
        >
          {hasInvalidDraft
            ? (
                <InvalidDraftAlert
                  domainLabel='race'
                  isDiscarding={discardDraftMutation.isPending}
                  onDiscard={() => void handleDiscardDraft()}
                />
              )
            : null}
          <RaceAuthoringRenderer form={form} />
        </AuthoringWorkspaceLayout>
        {deleteConfirmation}
      </>
    </form.AppForm>
  )
}

function RaceNotFoundState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That race could not be found.</Alert>
      <Button onClick={() => navigate({ to: '/races' })}>Back to races</Button>
    </Stack>
  )
}

function InvalidRaceDraftOnlyState({ raceId }: { raceId: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardRaceDraftMutation(raceId)

  async function handleDiscardDraft() {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale race draft discarded.' })
      await router.invalidate()
      await navigate({ to: '/races' })
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }

  return (
    <Stack>
      <InvalidDraftAlert
        domainLabel='race'
        isDiscarding={discardDraftMutation.isPending}
        onDiscard={() => void handleDiscardDraft()}
      />
      <Button onClick={() => navigate({ to: '/races' })}>Back to races</Button>
    </Stack>
  )
}
