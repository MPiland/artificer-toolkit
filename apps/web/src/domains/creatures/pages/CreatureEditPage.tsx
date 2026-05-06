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
  creatureAuthoringInputDtoSchema,
  type CreatureAuthoringInputDto,
  type CreatureAuthoredDto
} from '@artificer-toolkit/schema/subjects/creature'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
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
  useActivateCreatureMutation,
  useDiscardCreatureDraftMutation,
  useDuplicateCreatureMutation,
  useSaveCreatureDraftMutation
} from '#app/data/creatures/mutations'
import {
  normalizeCreatureForSubmit,
  toCreatureFormValues,
  type CreatureFormValues
} from '../creatureAuthoring.utils'
import { CreatureAuthoringRenderer } from '../components/CreatureAuthoringRenderer'

type ParsedCreatureDraft = {
  draft: AuthoredDraftDto | null
  isInvalid: boolean
  item: CreatureAuthoringInputDto | undefined
}

export function CreatureEditPage() {
  const route = getRouteApi('/_authed/creatures/$creatureId')
  const { draft, response } = route.useLoaderData()
  const { creatureId } = route.useParams()
  const parsedDraft: ParsedCreatureDraft = parseAuthoredDraftPayload(draft ?? null, creatureAuthoringInputDtoSchema)
  const draftCreature = parsedDraft.item
  const activeCreature = response?.item

  if (!response) {
    if (parsedDraft.isInvalid) {
      return <InvalidCreatureDraftOnlyState creatureId={creatureId} />
    }
    if (!draftCreature) {
      return <CreatureNotFoundState />
    }
  }

  const creature = draftCreature ?? activeCreature ?? null

  if (!creature) {
    return <CreatureNotFoundState />
  }

  const formKey = `edit:${creatureId}:${draft?.updatedAt ?? creatureId}:${draftCreature ? 'draft' : 'active'}`

  return (
    <AuthoringFormProvider>
      <CreatureEditAuthoring
        key={formKey}
        activeCreature={activeCreature}
        draft={parsedDraft.draft}
        hasInvalidDraft={Boolean(draft && parsedDraft.isInvalid)}
        permissions={response?.permissions}
        creature={toCreatureFormValues(creature)}
        creatureId={creatureId}
      />
    </AuthoringFormProvider>
  )
}

function CreatureEditAuthoring({
  activeCreature,
  draft,
  hasInvalidDraft,
  permissions,
  creature,
  creatureId
}: {
  activeCreature?: CreatureAuthoredDto
  draft: AuthoredDraftDto | null
  hasInvalidDraft: boolean
  permissions?: {
    canCopy: boolean
    canEdit: boolean
  }
  creature: CreatureFormValues
  creatureId: string
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const activateMutation = useActivateCreatureMutation()
  const discardDraftMutation = useDiscardCreatureDraftMutation(creatureId)
  const draftMutation = useSaveCreatureDraftMutation()
  const duplicateMutation = useDuplicateCreatureMutation()
  const [formValues] = useState(() => creature)
  const readOnly = Boolean(activeCreature && permissions?.canEdit === false)
  const canCopy = Boolean(permissions?.canCopy && creatureId)

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/creatures' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: CreatureAuthoringInputDto) => {
    if (readOnly) return

    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Creature activated.' })

      if (response?.item.id && response.item.id !== creatureId) {
        await navigate({ to: '/creatures/$creatureId', params: { creatureId: response.item.id } })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that creature yet.' })
    }
  }, [
    activateMutation,
    creatureId,
    navigate,
    readOnly,
    router
  ])

  const form = useAppForm({
    defaultValues: formValues,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeCreatureForSubmit(value))
    }
  })

  const handleDiscardDraft = useCallback(async () => {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale creature draft discarded.' })

      if (!activeCreature) {
        await navigate({ to: '/creatures' })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }, [
    activeCreature,
    discardDraftMutation,
    navigate,
    router
  ])

  const handleCopy = useCallback(async () => {
    try {
      const copied = await duplicateMutation.mutateAsync(creatureId)
      notifications.show({ color: 'green', message: 'Creature duplicated as an owned draft.' })

      if (copied?.subjectId) {
        await navigate({ to: '/creatures/$creatureId/edit', params: { creatureId: copied.subjectId } })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not duplicate that creature yet.' })
    }
  }, [
    creatureId,
    duplicateMutation,
    navigate
  ])

  const handleSaveDraft = useCallback(async () => {
    if (readOnly) return

    try {
      await draftMutation.mutateAsync(normalizeCreatureForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Creature draft saved.' })
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
    activateLabel: 'Activate Creature',
    canCopy,
    canSaveDraft: !readOnly,
    hasActiveDraft: Boolean(draft && activeCreature),
    mapId: 'creature',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Creature',
    subjectLabel: formValues.label || 'Untitled Creature',
    systemId: formValues.systemId
  }), [
    activeCreature,
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
                domainLabel='creature'
                isDiscarding={discardDraftMutation.isPending}
                onDiscard={() => void handleDiscardDraft()}
              />
            )
          : null}
        <AuthoringFormLayout>
          <CreatureAuthoringRenderer form={form} />
        </AuthoringFormLayout>
      </Stack>
    </form.AppForm>
  )
}

function CreatureNotFoundState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That creature could not be found.</Alert>
      <Button onClick={() => navigate({ to: '/creatures' })}>Back to creatures</Button>
    </Stack>
  )
}

function InvalidCreatureDraftOnlyState({ creatureId }: { creatureId: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardCreatureDraftMutation(creatureId)

  async function handleDiscardDraft() {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale creature draft discarded.' })
      await router.invalidate()
      await navigate({ to: '/creatures' })
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }

  return (
    <Stack>
      <InvalidDraftAlert
        domainLabel='creature'
        isDiscarding={discardDraftMutation.isPending}
        onDiscard={() => void handleDiscardDraft()}
      />
      <Button onClick={() => navigate({ to: '/creatures' })}>Back to creatures</Button>
    </Stack>
  )
}
