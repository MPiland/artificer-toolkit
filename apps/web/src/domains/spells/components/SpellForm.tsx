import { useNavigate } from '@tanstack/react-router'
import type { SpellAuthoredDto, SpellResponseDto } from '@artificer-toolkit/schema'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration
} from '#forms'
import type { SpellReferenceData } from '#app/data/spells/referenceData'
import {
  createEmptySpell,
  normalizeSpellForSubmit
} from '../spellAuthoring.utils'
import { SpellAuthoringRenderer } from './SpellAuthoringRenderer'

type SpellFormMode = 'create' | 'view' | 'edit'

export function SpellForm({
  mode,
  initialSpell,
  response,
  references,
  userId,
  resolveRuntime = true,
  onSubmit,
  onSaveDraft,
  onCopy
}: {
  mode: SpellFormMode
  initialSpell?: SpellAuthoredDto
  response?: SpellResponseDto
  references: SpellReferenceData
  userId: string
  resolveRuntime?: boolean
  onSubmit: (spell: SpellAuthoredDto) => Promise<void>
  onSaveDraft?: (spell: SpellAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const spell = initialSpell ?? response?.item ?? createEmptySpell({ systemId: references.systemId, userId })
  const readOnly = mode === 'view' || response?.permissions.canEdit === false

  return (
    <AuthoringFormProvider>
      <SpellFormController
        mode={mode}
        readOnly={readOnly}
        references={references}
        resolveRuntime={resolveRuntime}
        spell={spell}
        canCopy={Boolean(response?.permissions.canCopy && onCopy)}
        hasActiveDraft={mode === 'edit' && response != null}
        onCopy={onCopy}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </AuthoringFormProvider>
  )
}

function SpellFormController({
  canCopy,
  hasActiveDraft,
  mode,
  readOnly,
  references,
  resolveRuntime,
  spell,
  onCopy,
  onSaveDraft,
  onSubmit
}: {
  canCopy: boolean
  hasActiveDraft: boolean
  mode: SpellFormMode
  readOnly: boolean
  references: SpellReferenceData
  resolveRuntime: boolean
  spell: SpellAuthoredDto
  onCopy?: () => void
  onSaveDraft?: (spell: SpellAuthoredDto) => Promise<void>
  onSubmit: (spell: SpellAuthoredDto) => Promise<void>
}) {
  const navigate = useNavigate()
  const form = useAppForm({
    defaultValues: spell,
    onSubmit: async ({ value }) => {
      if (!readOnly) await onSubmit(normalizeSpellForSubmit(value, references))
    }
  })

  async function handleSaveDraft() {
    if (readOnly || !onSaveDraft) return
    await onSaveDraft(normalizeSpellForSubmit(form.state.values, references))
  }

  useAuthoringFormRegistration({
    activateLabel: 'Activate Spell',
    canCopy,
    canSaveDraft: Boolean(onSaveDraft && !readOnly),
    hasActiveDraft,
    mapId: 'spell',
    mode,
    readOnly,
    resolveModel: resolveRuntime,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Spell',
    subjectLabel: spell.label || 'Untitled Spell',
    systemId: spell.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onCancel: () => navigate({ to: '/spells' }),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy,
    onSaveDraft: onSaveDraft ? handleSaveDraft : undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <SpellAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}
