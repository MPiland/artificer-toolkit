import { useAppForm } from '#components/Form/runtime'
import { OutcomeEditor } from './OutcomeEditor'
import type { EffectEditorReferenceData, OutcomeDraft } from '../effectEditor.types'

export function OutcomeEditorItem({
  outcome,
  references,
  readOnly,
  defaultExpanded,
  onChange,
  onRemove
}: {
  outcome: OutcomeDraft
  references: EffectEditorReferenceData
  readOnly?: boolean
  defaultExpanded?: boolean
  onChange: (outcome: OutcomeDraft) => void
  onRemove: () => void
}) {
  const form = useAppForm({
    defaultValues: { outcome },
    onSubmit: () => undefined,
    listeners: {
      onChange: ({ formApi }) => {
        onChange(formApi.state.values.outcome)
      }
    }
  })

  return (
    <form.AppForm>
      <OutcomeEditor
        form={form}
        fields={{ outcome: 'outcome' }}
        references={references}
        readOnly={readOnly ?? false}
        defaultExpanded={defaultExpanded ?? false}
        onRemove={onRemove}
      />
    </form.AppForm>
  )
}
