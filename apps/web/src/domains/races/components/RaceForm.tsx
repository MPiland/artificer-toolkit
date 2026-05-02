import { useNavigate } from '@tanstack/react-router'
import type { NodeRuntimeResolveResponseDto, RaceAuthoredDto, RaceResponseDto } from '@artificer-toolkit/schema'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration
} from '#forms'
import {
  createEmptyRace,
  normalizeRaceForSubmit,
  toRaceFormValues,
  type RaceFormValues
} from '../raceAuthoring.utils'
import { RaceAuthoringRenderer } from './RaceAuthoringRenderer'

type RaceFormMode = 'create' | 'view' | 'edit'

export function RaceForm({
  mode,
  initialRace,
  response,
  systemId,
  userId,
  resolveRuntime = true,
  runtimeModel,
  onSubmit,
  onSaveDraft,
  onCopy
}: {
  mode: RaceFormMode
  initialRace?: RaceAuthoredDto | RaceFormValues
  response?: RaceResponseDto
  systemId: string
  userId: string
  resolveRuntime?: boolean
  runtimeModel?: NodeRuntimeResolveResponseDto
  onSubmit: (race: RaceAuthoredDto) => Promise<void>
  onSaveDraft?: (race: RaceAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const race = toRaceFormValues(initialRace ?? response?.item ?? createEmptyRace({ systemId, userId }))
  const readOnly = mode === 'view' || response?.permissions.canEdit === false

  return (
    <AuthoringFormProvider>
      <RaceFormController
        canCopy={Boolean(response?.permissions.canCopy && onCopy)}
        hasActiveDraft={mode === 'edit' && response != null}
        mode={mode}
        race={race}
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

function RaceFormController({
  canCopy,
  hasActiveDraft,
  mode,
  race,
  readOnly,
  resolveRuntime,
  runtimeModel,
  onCopy,
  onSaveDraft,
  onSubmit
}: {
  canCopy: boolean
  hasActiveDraft: boolean
  mode: RaceFormMode
  race: RaceFormValues
  readOnly: boolean
  resolveRuntime: boolean
  runtimeModel?: NodeRuntimeResolveResponseDto
  onCopy?: () => void
  onSaveDraft?: (race: RaceAuthoredDto) => Promise<void>
  onSubmit: (race: RaceAuthoredDto) => Promise<void>
}) {
  const navigate = useNavigate()
  const form = useAppForm({
    defaultValues: race,
    onSubmit: async ({ value }) => {
      if (!readOnly) await onSubmit(normalizeRaceForSubmit(value))
    }
  })

  async function handleSaveDraft() {
    if (readOnly || !onSaveDraft) return
    await onSaveDraft(normalizeRaceForSubmit(form.state.values))
  }

  useAuthoringFormRegistration({
    activateLabel: 'Activate Race',
    canCopy,
    canSaveDraft: Boolean(onSaveDraft && !readOnly),
    hasActiveDraft,
    mapId: 'race',
    mode,
    providedModel: runtimeModel,
    readOnly,
    resolveModel: resolveRuntime,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Race',
    subjectLabel: race.label || 'Untitled Race',
    systemId: race.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onCancel: () => navigate({ to: '/races' }),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy,
    onSaveDraft: onSaveDraft ? handleSaveDraft : undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <RaceAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}
