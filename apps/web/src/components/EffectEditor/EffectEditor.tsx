import type { EffectDto } from '@artificer-toolkit/schema'
import { useAppForm } from '#components/Form/runtime'
import { EffectEditorFieldGroup } from './EffectEditorFieldGroup'
import type { EffectEditorReferenceData } from './effectEditor.types'

export type { EffectEditorReferenceData } from './effectEditor.types'

export function EffectEditor({
  effects,
  onEffectsChange,
  references,
  readOnly,
  sourceLabel = 'Content'
}: {
  effects: EffectDto[]
  onEffectsChange: (effects: EffectDto[]) => void
  references: EffectEditorReferenceData
  readOnly?: boolean
  sourceLabel?: string
}) {
  const form = useAppForm({
    defaultValues: {
      effects
    },
    onSubmit: () => undefined,
    listeners: {
      onChange: ({ formApi }) => {
        if (!readOnly) onEffectsChange(formApi.state.values.effects)
      }
    }
  })

  return (
    <form.AppForm>
      <EffectEditorFieldGroup
        form={form}
        fields={{ effects: 'effects' }}
        references={references}
        readOnly={readOnly ?? false}
        sourceLabel={sourceLabel}
      />
    </form.AppForm>
  )
}
