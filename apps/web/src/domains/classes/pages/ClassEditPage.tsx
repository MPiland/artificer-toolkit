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
import { classAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import type {
  ClassAuthoringInputDto,
  ClassAuthoredDto
} from '@artificer-toolkit/schema/subjects/class'
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
  useActivateClassMutation,
  useDiscardClassDraftMutation,
  useDuplicateClassMutation,
  useSaveClassDraftMutation
} from '#app/data/classes/mutations'
import {
  normalizeClassForSubmit,
  resolveClassEditReadOnly,
  toClassFormValues
} from '../classAuthoring.utils'
import { ClassAuthoringRenderer } from '../components/ClassAuthoringRenderer'

type ParsedClassDraft = {
  draft: AuthoredDraftDto | null
  isInvalid: boolean
  item: ClassAuthoringInputDto | undefined
}

export function ClassEditPage() {
  const route = getRouteApi('/_authed/classes/$classId/edit')
  const { response, draft } = route.useLoaderData()
  const classId = route.useParams().classId
  const parsedDraft: ParsedClassDraft = parseAuthoredDraftPayload(draft ?? null, classAuthoringInputDtoSchema)
  const draftClass = parsedDraft.item
  const activeClass = response?.item

  if (!response) {
    if (!draftClass) {
      return <ClassNotFoundState />
    }
    if (parsedDraft.isInvalid && classId) {
      return <InvalidClassDraftOnlyState classId={classId} />
    }
  }

  const classRecord = draftClass ?? activeClass ?? null

  if (!classRecord) {
    return <ClassNotFoundState />
  }

  if (!classRecord.systemId) {
    return <ClassMissingSystemState />
  }

  const formKey = `edit:${classId}:${draft?.updatedAt ?? classId ?? 'missing'}:${draft ? 'draft' : 'active'}`

  return (
    <AuthoringFormProvider>
      <ClassEditAuthoring
        key={formKey}
        activeClass={activeClass}
        draft={parsedDraft.draft}
        hasInvalidDraft={Boolean(draft && parsedDraft.isInvalid)}
        permissions={response?.permissions}
        classRecord={classRecord}
        classId={classId}
      />
    </AuthoringFormProvider>
  )
}

function ClassEditAuthoring({
  activeClass,
  draft,
  hasInvalidDraft,
  permissions,
  classRecord,
  classId
}: {
  activeClass?: ClassAuthoredDto
  draft: AuthoredDraftDto | null
  hasInvalidDraft: boolean
  permissions?: {
    canCopy: boolean
    canEdit: boolean
  }
  classRecord: ClassAuthoringInputDto | ClassAuthoredDto
  classId: string
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const activateMutation = useActivateClassMutation()
  const discardDraftMutation = useDiscardClassDraftMutation(classId)
  const draftMutation = useSaveClassDraftMutation()
  const duplicateMutation = useDuplicateClassMutation()
  const [formValues] = useState(() => toClassFormValues(classRecord))
  const readOnly = resolveClassEditReadOnly({
    canEdit: permissions?.canEdit,
    hasActiveClass: Boolean(activeClass)
  })
  const canCopy = Boolean(permissions?.canCopy && classId)

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/classes' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: ClassAuthoringInputDto) => {
    if (readOnly) return

    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Class activated.' })

      if (response?.item.id && response.item.id !== classId) {
        await navigate({ to: '/classes/$classId/edit', params: { classId: response.item.id } })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that class yet.' })
    }
  }, [
    activateMutation,
    classId,
    navigate,
    readOnly,
    router
  ])

  const form = useAppForm({
    defaultValues: formValues,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeClassForSubmit(value))
    }
  })

  const handleDiscardDraft = useCallback(async () => {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale class draft discarded.' })

      if (!activeClass) {
        await navigate({ to: '/classes' })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }, [
    activeClass,
    discardDraftMutation,
    navigate,
    router
  ])

  const handleCopy = useCallback(async () => {
    try {
      const copied = await duplicateMutation.mutateAsync(classId)
      notifications.show({ color: 'green', message: 'Class duplicated as an owned draft.' })

      if (copied?.subjectId) {
        await navigate({ to: '/classes/$classId/edit', params: { classId: copied.subjectId } })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not duplicate that class yet.' })
    }
  }, [
    classId,
    duplicateMutation,
    navigate
  ])

  const handleSaveDraft = useCallback(async () => {
    if (readOnly) return

    try {
      await draftMutation.mutateAsync(normalizeClassForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Class draft saved.' })
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
    activateLabel: 'Activate Class',
    canCopy,
    canSaveDraft: !readOnly,
    hasActiveDraft: Boolean(draft && activeClass),
    mapId: 'class',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Class',
    subjectLabel: formValues.label || 'Untitled Class',
    systemId: formValues.systemId
  }), [
    activeClass,
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
                domainLabel='class'
                isDiscarding={discardDraftMutation.isPending}
                onDiscard={() => void handleDiscardDraft()}
              />
            )
          : null}
        <AuthoringFormLayout>
          <ClassAuthoringRenderer form={form} />
        </AuthoringFormLayout>
      </Stack>
    </form.AppForm>
  )
}

function ClassMissingSystemState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That class is missing a system and cannot be edited.</Alert>
      <Button onClick={() => navigate({ to: '/classes' })}>Back to classes</Button>
    </Stack>
  )
}

function ClassNotFoundState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That class could not be found.</Alert>
      <Button onClick={() => navigate({ to: '/classes' })}>Back to classes</Button>
    </Stack>
  )
}

function InvalidClassDraftOnlyState({ classId }: { classId: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardClassDraftMutation(classId)

  async function handleDiscardDraft() {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale class draft discarded.' })
      await router.invalidate()
      await navigate({ to: '/classes' })
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }

  return (
    <Stack>
      <InvalidDraftAlert
        domainLabel='class'
        isDiscarding={discardDraftMutation.isPending}
        onDiscard={() => void handleDiscardDraft()}
      />
      <Button onClick={() => navigate({ to: '/classes' })}>Back to classes</Button>
    </Stack>
  )
}
