import { useNavigate } from '@tanstack/react-router'
import type { BackgroundAuthoredDto } from '@artificer-toolkit/schema/subjects/background'
import { BackgroundResponseDto } from '@artificer-toolkit/schema/api/content'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration
} from '#forms'
import {
  createEmptyBackground,
  normalizeBackgroundForSubmit
} from '../backgroundAuthoring.utils'
import { BackgroundAuthoringRenderer } from './BackgroundAuthoringRenderer'

type BackgroundFormMode = 'create' | 'view' | 'edit'

export function BackgroundForm({
  mode,
  initialBackground,
  response,
  systemId,
  userId,
  resolveRuntime = true,
  onSubmit,
  onSaveDraft,
  onCopy
}: {
  mode: BackgroundFormMode
  initialBackground?: BackgroundAuthoredDto
  response?: BackgroundResponseDto
  systemId: string
  userId: string
  resolveRuntime?: boolean
  onSubmit: (background: BackgroundAuthoredDto) => Promise<void>
  onSaveDraft?: (background: BackgroundAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const background = initialBackground ?? response?.item ?? createEmptyBackground({ systemId, userId })
  const readOnly = mode === 'view' || response?.permissions.canEdit === false

  return (
    <AuthoringFormProvider>
      <BackgroundFormController
        background={background}
        canCopy={Boolean(response?.permissions.canCopy && onCopy)}
        hasActiveDraft={mode === 'edit' && response != null}
        mode={mode}
        readOnly={readOnly}
        resolveRuntime={resolveRuntime}
        onCopy={onCopy}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </AuthoringFormProvider>
  )
}

function BackgroundFormController({
  background,
  canCopy,
  hasActiveDraft,
  mode,
  readOnly,
  resolveRuntime,
  onCopy,
  onSaveDraft,
  onSubmit
}: {
  background: BackgroundAuthoredDto
  canCopy: boolean
  hasActiveDraft: boolean
  mode: BackgroundFormMode
  readOnly: boolean
  resolveRuntime: boolean
  onCopy?: () => void
  onSaveDraft?: (background: BackgroundAuthoredDto) => Promise<void>
  onSubmit: (background: BackgroundAuthoredDto) => Promise<void>
}) {
  const navigate = useNavigate()
  const form = useAppForm({
    defaultValues: background,
    onSubmit: async ({ value }) => {
      if (!readOnly) await onSubmit(normalizeBackgroundForSubmit(value))
    }
  })

  async function handleSaveDraft() {
    if (readOnly || !onSaveDraft) return
    await onSaveDraft(normalizeBackgroundForSubmit(form.state.values))
  }

  useAuthoringFormRegistration({
    activateLabel: 'Activate Background',
    canCopy,
    canSaveDraft: Boolean(onSaveDraft && !readOnly),
    hasActiveDraft,
    mapId: 'background',
    mode,
    readOnly,
    resolveModel: resolveRuntime,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Background',
    subjectLabel: background.label || 'Untitled Background',
    systemId: background.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onCancel: () => navigate({ to: '/backgrounds' }),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy,
    onSaveDraft: onSaveDraft ? handleSaveDraft : undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <BackgroundAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}
