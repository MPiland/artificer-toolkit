import { useNavigate } from '@tanstack/react-router'
import type {
  CreatureAuthoredDto,
  CreatureResponseDto,
  NodeRuntimeResolveResponseDto
} from '#app/lib/api'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration
} from '#forms'
import {
  createEmptyCreature,
  normalizeCreatureForSubmit,
  toCreatureFormValues,
  type CreatureFormValues
} from '../creatureAuthoring.utils'
import { CreatureAuthoringRenderer } from './CreatureAuthoringRenderer'

type CreatureFormMode = 'create' | 'view' | 'edit'

export function CreatureForm({
  mode,
  initialCreature,
  response,
  systemId,
  userId,
  resolveRuntime = true,
  runtimeModel,
  onSubmit,
  onSaveDraft,
  onCopy
}: {
  mode: CreatureFormMode
  initialCreature?: CreatureAuthoredDto | CreatureFormValues
  response?: CreatureResponseDto
  systemId: string
  userId: string
  resolveRuntime?: boolean
  runtimeModel?: NodeRuntimeResolveResponseDto
  onSubmit: (creature: CreatureAuthoredDto) => Promise<void>
  onSaveDraft?: (creature: CreatureAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const creature = toCreatureFormValues(initialCreature ?? response?.item ?? createEmptyCreature({ systemId, userId }))
  const readOnly = mode === 'view' || response?.permissions.canEdit === false

  return (
    <AuthoringFormProvider>
      <CreatureFormController
        canCopy={Boolean(response?.permissions.canCopy && onCopy)}
        creature={creature}
        hasActiveDraft={mode === 'edit' && response != null}
        mode={mode}
        readOnly={readOnly}
        resolveRuntime={resolveRuntime}
        runtimeModel={runtimeModel}
        onCopy={onCopy}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </AuthoringFormProvider>
  )
}

function CreatureFormController({
  canCopy,
  creature,
  hasActiveDraft,
  mode,
  readOnly,
  resolveRuntime,
  runtimeModel,
  onCopy,
  onSaveDraft,
  onSubmit
}: {
  canCopy: boolean
  creature: CreatureFormValues
  hasActiveDraft: boolean
  mode: CreatureFormMode
  readOnly: boolean
  resolveRuntime: boolean
  runtimeModel?: NodeRuntimeResolveResponseDto
  onCopy?: () => void
  onSaveDraft?: (creature: CreatureAuthoredDto) => Promise<void>
  onSubmit: (creature: CreatureAuthoredDto) => Promise<void>
}) {
  const navigate = useNavigate()
  const form = useAppForm({
    defaultValues: creature,
    onSubmit: async ({ value }) => {
      if (!readOnly) await onSubmit(normalizeCreatureForSubmit(value))
    }
  })

  async function handleSaveDraft() {
    if (readOnly || !onSaveDraft) return
    await onSaveDraft(normalizeCreatureForSubmit(form.state.values))
  }

  useAuthoringFormRegistration({
    activateLabel: 'Activate Creature',
    canCopy,
    canSaveDraft: Boolean(onSaveDraft && !readOnly),
    hasActiveDraft,
    mapId: 'creature',
    mode,
    providedModel: runtimeModel,
    readOnly,
    resolveModel: resolveRuntime,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Creature',
    subjectLabel: creature.label || 'Untitled Creature',
    systemId: creature.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onCancel: () => navigate({ to: '/creatures' }),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy,
    onSaveDraft: onSaveDraft ? handleSaveDraft : undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <CreatureAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}
