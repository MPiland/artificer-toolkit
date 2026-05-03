import { useNavigate } from '@tanstack/react-router'
import type { FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import { FeatResponseDto } from '@artificer-toolkit/schema/api/content'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration
} from '#forms'
import type { EffectEditorReferenceData } from '#components/editors'
import {
  createEmptyFeat,
  normalizeFeatForSubmit
} from '../featAuthoring.utils'
import { FeatAuthoringRenderer } from './FeatAuthoringRenderer'

type FeatFormMode = 'create' | 'view' | 'edit'

export function FeatForm({
  mode,
  initialFeat,
  response,
  references,
  systemId,
  userId,
  resolveRuntime = true,
  onSubmit,
  onSaveDraft,
  onCopy
}: {
  mode: FeatFormMode
  initialFeat?: FeatAuthoredDto
  response?: FeatResponseDto
  references: EffectEditorReferenceData
  systemId: string
  userId: string
  resolveRuntime?: boolean
  onSubmit: (feat: FeatAuthoredDto) => Promise<void>
  onSaveDraft?: (feat: FeatAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  void references
  const feat = initialFeat ?? response?.item ?? createEmptyFeat({ systemId, userId })
  const readOnly = mode === 'view' || response?.permissions.canEdit === false

  return (
    <AuthoringFormProvider>
      <FeatFormController
        canCopy={Boolean(response?.permissions.canCopy && onCopy)}
        feat={feat}
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

function FeatFormController({
  canCopy,
  feat,
  hasActiveDraft,
  mode,
  readOnly,
  resolveRuntime,
  onCopy,
  onSaveDraft,
  onSubmit
}: {
  canCopy: boolean
  feat: FeatAuthoredDto
  hasActiveDraft: boolean
  mode: FeatFormMode
  readOnly: boolean
  resolveRuntime: boolean
  onCopy?: () => void
  onSaveDraft?: (feat: FeatAuthoredDto) => Promise<void>
  onSubmit: (feat: FeatAuthoredDto) => Promise<void>
}) {
  const navigate = useNavigate()
  const form = useAppForm({
    defaultValues: feat,
    onSubmit: async ({ value }) => {
      if (!readOnly) await onSubmit(normalizeFeatForSubmit(value))
    }
  })

  async function handleSaveDraft() {
    if (readOnly || !onSaveDraft) return
    await onSaveDraft(normalizeFeatForSubmit(form.state.values))
  }

  useAuthoringFormRegistration({
    activateLabel: 'Activate Feat',
    canCopy,
    canSaveDraft: Boolean(onSaveDraft && !readOnly),
    hasActiveDraft,
    mapId: 'feat',
    mode,
    readOnly,
    resolveModel: resolveRuntime,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Feat',
    subjectLabel: feat.label || 'Untitled Feat',
    systemId: feat.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onCancel: () => navigate({ to: '/feats' }),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy,
    onSaveDraft: onSaveDraft ? handleSaveDraft : undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <FeatAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}
