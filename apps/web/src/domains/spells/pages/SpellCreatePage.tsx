import {
  useCallback,
  useMemo,
  useState
} from 'react'
import { notifications } from '@mantine/notifications'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  AuthoringFormProvider,
  AuthoringWorkspaceLayout,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import {
  useActivateSpellMutation,
  useSaveSpellDraftMutation
} from '#app/data/spells/mutations'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import type { SpellReferenceData } from '#app/data/spells/referenceData'
import {
  createEmptySpell,
  normalizeSpellForSubmit
} from '../spellAuthoring.utils'
import { SpellAuthoringRenderer } from '../components/SpellAuthoringRenderer'

export function SpellCreatePage() {
  const route = getRouteApi('/_authed/spells/new')
  const references = route.useLoaderData()

  return (
    <AuthoringFormProvider>
      <SpellCreateAuthoring
        references={references}
        systemId={references.systemId}
      />
    </AuthoringFormProvider>
  )
}

function SpellCreateAuthoring({
  references,
  systemId
}: {
  references: SpellReferenceData
  systemId: string
}) {
  const navigate = useNavigate()
  const activateMutation = useActivateSpellMutation()
  const draftMutation = useSaveSpellDraftMutation()
  const [spell] = useState(() => createEmptySpell({ systemId }))

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/spells' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: ReturnType<typeof normalizeSpellForSubmit>) => {
    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Spell activated.' })

      if (response?.item?.id) {
        await navigate({
          params: buildSpellRouteParams(response.publicId, response.item.label),
          to: '/spells/$spellPublicId/$spellSlug'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that spell yet.' })
    }
  }, [
    activateMutation,
    navigate
  ])

  const form = useAppForm({
    defaultValues: spell,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeSpellForSubmit(value, references))
    }
  })

  const handleSaveDraft = useCallback(async () => {
    try {
      const draft = await draftMutation.mutateAsync(normalizeSpellForSubmit(form.state.values, references))
      notifications.show({ color: 'green', message: 'Spell draft saved.' })
      await navigate({
        params: buildSpellRouteParams(draft.publicId, draft.label),
        to: '/spells/$spellPublicId/$spellSlug/edit'
      })
    } catch {
      notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
    }
  }, [
    draftMutation,
    form,
    navigate,
    references
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Spell',
    canSaveDraft: true,
    hasActiveDraft: false,
    mapId: 'spell',
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Spell',
    subjectLabel: spell.label || 'Untitled Spell',
    systemId: spell.systemId
  }), [
    spell.label,
    spell.systemId
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
      <AuthoringWorkspaceLayout>
        <SpellAuthoringRenderer form={form} />
      </AuthoringWorkspaceLayout>
    </form.AppForm>
  )
}
