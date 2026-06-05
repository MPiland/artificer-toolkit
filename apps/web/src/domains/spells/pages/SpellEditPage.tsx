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
  spellAuthoringInputDtoSchema,
  type SpellAuthoringInputDto,
  type SpellAuthoredDto
} from '@artificer-toolkit/schema/subjects/spell'
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
  useActivateSpellMutation,
  useDiscardSpellDraftMutation,
  useDuplicateSpellMutation,
  useSaveSpellDraftMutation
} from '#app/data/spells/mutations'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  normalizeSpellForSubmit
} from '../spellAuthoring.utils'
import { SpellAuthoringRenderer } from '../components/SpellAuthoringRenderer'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'

type ParsedSpellDraft = {
  draft: AuthoredDraftDto | null
  isInvalid: boolean
  item: SpellAuthoringInputDto | undefined
}

export function SpellEditPage() {
  const route = getRouteApi('/_authed/spells/$spellPublicId/$spellSlug')
  const { draft, response, spellId } = route.useLoaderData()
  const parsedDraft: ParsedSpellDraft = parseAuthoredDraftPayload(draft ?? null, spellAuthoringInputDtoSchema)
  const draftSpell = parsedDraft.item
  const activeSpell = response?.item ?? undefined

  if (!response) {
    if (parsedDraft.isInvalid) {
      return <InvalidSpellDraftOnlyState spellId={spellId} />
    }
    if (!draftSpell) {
      return <SpellNotFoundState />
    }
  }

  const spell = draftSpell ?? activeSpell ?? null

  if (!spell) {
    return <SpellNotFoundState />
  }

  const formKey = `edit:${spellId}:${draft?.updatedAt ?? spellId}:${draftSpell ? 'draft' : 'active'}`

  return (
    <AuthoringFormProvider>
      <SpellEditAuthoring
        key={formKey}
        activeSpell={activeSpell}
        draft={parsedDraft.draft}
        hasInvalidDraft={Boolean(draft && parsedDraft.isInvalid)}
        permissions={response?.permissions}
        spell={spell}
        spellId={spellId}
      />
    </AuthoringFormProvider>
  )
}

function SpellEditAuthoring({
  activeSpell,
  draft,
  hasInvalidDraft,
  permissions,
  spell,
  spellId
}: {
  activeSpell?: SpellAuthoredDto
  draft: AuthoredDraftDto | null
  hasInvalidDraft: boolean
  permissions?: {
    canCopy: boolean
    canDelete: boolean
    canEdit: boolean
  }
  spell: SpellAuthoringInputDto | SpellAuthoredDto
  spellId: string
}) {
  const route = getRouteApi('/_authed/spells/$spellPublicId/$spellSlug/edit')
  const spellReferences = route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const activateMutation = useActivateSpellMutation()
  const discardDraftMutation = useDiscardSpellDraftMutation(spellId)
  const draftMutation = useSaveSpellDraftMutation()
  const duplicateMutation = useDuplicateSpellMutation()
  const [formValues] = useState(() => spell)
  const readOnly = Boolean(activeSpell && permissions?.canEdit === false)
  const canCopy = Boolean(permissions?.canCopy && spellId)
  const canDelete = !readOnly && Boolean(draft || permissions?.canDelete)
  const {
    confirmation: deleteConfirmation,
    isDeleting,
    requestDelete
  } = useAuthoredDeleteAction({
    deleteActive: api.content.spells.deleteActive,
    deleteDraft: api.content.spells.discardDraft,
    detailSubjectQueryKey: queryKeys.content.spells.detailRoot(spellId),
    domainLabel: 'Spell',
    domainQueryKey: queryKeys.content.spells.all(),
    draftQueryKey: queryKeys.content.spells.draft(spellId),
    onDeleted: async () => navigate({ to: '/spells' })
  })

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/spells' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: SpellAuthoringInputDto) => {
    if (readOnly) return

    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Spell activated.' })

      if (response?.item?.id && response.item.id !== spellId) {
        await navigate({
          params: buildSpellRouteParams(response.publicId, response.item.label),
          to: '/spells/$spellPublicId/$spellSlug'
        })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that spell yet.' })
    }
  }, [
    activateMutation,
    navigate,
    readOnly,
    router,
    spellId
  ])

  const form = useAppForm({
    defaultValues: formValues,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeSpellForSubmit(value, spellReferences))
    }
  })

  const handleDiscardDraft = useCallback(async () => {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale spell draft discarded.' })

      if (!activeSpell) {
        await navigate({ to: '/spells' })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }, [
    activeSpell,
    discardDraftMutation,
    navigate,
    router
  ])

  const handleCopy = useCallback(async () => {
    try {
      const copied = await duplicateMutation.mutateAsync(spellId)
      notifications.show({ color: 'green', message: 'Spell duplicated as an owned draft.' })

      if (copied?.subjectId) {
        await navigate({
          params: buildSpellRouteParams(copied.publicId, copied.label),
          to: '/spells/$spellPublicId/$spellSlug/edit'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not duplicate that spell yet.' })
    }
  }, [
    duplicateMutation,
    navigate,
    spellId
  ])

  const handleSaveDraft = useCallback(async () => {
    if (readOnly) return

    try {
      await draftMutation.mutateAsync(normalizeSpellForSubmit(form.state.values, spellReferences))
      notifications.show({ color: 'green', message: 'Spell draft saved.' })
      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
    }
  }, [
    draftMutation,
    form,
    readOnly,
    router,
    spellReferences
  ])

  const handleDelete = useCallback(() => {
    requestDelete({
      id: spellId,
      kind: draft ? 'draft' : 'active',
      label: formValues.label || 'Untitled Spell'
    })
  }, [
    draft,
    formValues.label,
    requestDelete,
    spellId
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Spell',
    canDelete,
    canCopy,
    canSaveDraft: !readOnly,
    hasActiveDraft: Boolean(draft && activeSpell),
    isDraft: Boolean(draft),
    mapId: 'spell',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Spell',
    subjectLabel: formValues.label || 'Untitled Spell',
    systemId: formValues.systemId,
    isDeleting
  }), [
    activeSpell,
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
        {hasInvalidDraft
          ? (
              <InvalidDraftAlert
                domainLabel='spell'
                isDiscarding={discardDraftMutation.isPending}
                onDiscard={() => void handleDiscardDraft()}
              />
            )
          : null}
        <AuthoringWorkspaceLayout>
          <SpellAuthoringRenderer form={form} />
        </AuthoringWorkspaceLayout>
        {deleteConfirmation}
      </>
    </form.AppForm>
  )
}

function SpellNotFoundState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That spell could not be found.</Alert>
      <Button onClick={() => navigate({ to: '/spells' })}>Back to spells</Button>
    </Stack>
  )
}

function InvalidSpellDraftOnlyState({ spellId }: { spellId: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardSpellDraftMutation(spellId)

  async function handleDiscardDraft() {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale spell draft discarded.' })
      await router.invalidate()
      await navigate({ to: '/spells' })
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }

  return (
    <Stack>
      <InvalidDraftAlert
        domainLabel='spell'
        isDiscarding={discardDraftMutation.isPending}
        onDiscard={() => void handleDiscardDraft()}
      />
      <Button onClick={() => navigate({ to: '/spells' })}>Back to spells</Button>
    </Stack>
  )
}
