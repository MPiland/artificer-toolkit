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
  featAuthoringInputDtoSchema,
  type FeatAuthoringInputDto,
  type FeatAuthoredDto
} from '@artificer-toolkit/schema/subjects/feat'
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
  useActivateFeatMutation,
  useDiscardFeatDraftMutation,
  useDuplicateFeatMutation,
  useSaveFeatDraftMutation
} from '#app/data/feats/mutations'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'
import { normalizeFeatForSubmit } from '../featAuthoring.utils'
import { FeatAuthoringRenderer } from '../components/FeatAuthoringRenderer'

type ParsedFeatDraft = {
  draft: AuthoredDraftDto | null
  isInvalid: boolean
  item: FeatAuthoringInputDto | undefined
}

export function FeatEditPage() {
  const route = getRouteApi('/_authed/feats/$featPublicId/$featSlug')
  const { draft, featId, response } = route.useLoaderData()
  const parsedDraft: ParsedFeatDraft = parseAuthoredDraftPayload(draft ?? null, featAuthoringInputDtoSchema)
  const draftFeat = parsedDraft.item
  const activeFeat = response?.item ?? undefined

  if (!response) {
    if (parsedDraft.isInvalid) {
      return <InvalidFeatDraftOnlyState featId={featId} />
    }
    if (!draftFeat) {
      return <FeatNotFoundState />
    }
  }

  const feat = draftFeat ?? activeFeat ?? null

  if (!feat) {
    return <FeatNotFoundState />
  }

  const formKey = `edit:${featId}:${draft?.updatedAt ?? featId}:${draftFeat ? 'draft' : 'active'}`

  return (
    <AuthoringFormProvider>
      <FeatEditAuthoring
        key={formKey}
        activeFeat={activeFeat}
        draft={parsedDraft.draft}
        hasInvalidDraft={Boolean(draft && parsedDraft.isInvalid)}
        permissions={response?.permissions}
        feat={feat}
        featId={featId}
      />
    </AuthoringFormProvider>
  )
}

function FeatEditAuthoring({
  activeFeat,
  draft,
  hasInvalidDraft,
  permissions,
  feat,
  featId
}: {
  activeFeat?: FeatAuthoredDto
  draft: AuthoredDraftDto | null
  hasInvalidDraft: boolean
  permissions?: {
    canCopy: boolean
    canEdit: boolean
  }
  feat: FeatAuthoringInputDto | FeatAuthoredDto
  featId: string
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const activateMutation = useActivateFeatMutation()
  const discardDraftMutation = useDiscardFeatDraftMutation(featId)
  const draftMutation = useSaveFeatDraftMutation()
  const duplicateMutation = useDuplicateFeatMutation()
  const [formValues] = useState<FeatAuthoringInputDto>(() => normalizeFeatForSubmit(feat))
  const readOnly = Boolean(activeFeat && permissions?.canEdit === false)
  const canCopy = Boolean(permissions?.canCopy && featId)

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/feats' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: FeatAuthoringInputDto) => {
    if (readOnly) return

    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Feat activated.' })

      if (response?.item?.id && response.item.id !== featId) {
        await navigate({
          params: buildFeatRouteParams(response.publicId, response.item.label),
          to: '/feats/$featPublicId/$featSlug'
        })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that feat yet.' })
    }
  }, [
    activateMutation,
    featId,
    navigate,
    readOnly,
    router
  ])

  const form = useAppForm({
    defaultValues: formValues,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeFeatForSubmit(value))
    }
  })

  const handleDiscardDraft = useCallback(async () => {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale feat draft discarded.' })

      if (!activeFeat) {
        await navigate({ to: '/feats' })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }, [
    activeFeat,
    discardDraftMutation,
    navigate,
    router
  ])

  const handleCopy = useCallback(async () => {
    try {
      const copied = await duplicateMutation.mutateAsync(featId)
      notifications.show({ color: 'green', message: 'Feat duplicated as an owned draft.' })

      if (copied?.subjectId) {
        await navigate({
          params: buildFeatRouteParams(copied.publicId, copied.label),
          to: '/feats/$featPublicId/$featSlug/edit'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not duplicate that feat yet.' })
    }
  }, [
    duplicateMutation,
    featId,
    navigate
  ])

  const handleSaveDraft = useCallback(async () => {
    if (readOnly) return

    try {
      await draftMutation.mutateAsync(normalizeFeatForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Feat draft saved.' })
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
    activateLabel: 'Activate Feat',
    canCopy,
    canSaveDraft: !readOnly,
    hasActiveDraft: Boolean(draft && activeFeat),
    mapId: 'feat',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Feat',
    subjectLabel: formValues.label || 'Untitled Feat',
    systemId: formValues.systemId
  }), [
    activeFeat,
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
                domainLabel='feat'
                isDiscarding={discardDraftMutation.isPending}
                onDiscard={() => void handleDiscardDraft()}
              />
            )
          : null}
        <AuthoringFormLayout>
          <FeatAuthoringRenderer form={form} />
        </AuthoringFormLayout>
      </Stack>
    </form.AppForm>
  )
}

function FeatNotFoundState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That feat could not be found.</Alert>
      <Button onClick={() => navigate({ to: '/feats' })}>Back to feats</Button>
    </Stack>
  )
}

function InvalidFeatDraftOnlyState({ featId }: { featId: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardFeatDraftMutation(featId)

  async function handleDiscardDraft() {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale feat draft discarded.' })
      await router.invalidate()
      await navigate({ to: '/feats' })
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }

  return (
    <Stack>
      <InvalidDraftAlert
        domainLabel='feat'
        isDiscarding={discardDraftMutation.isPending}
        onDiscard={() => void handleDiscardDraft()}
      />
      <Button onClick={() => navigate({ to: '/feats' })}>Back to feats</Button>
    </Stack>
  )
}
