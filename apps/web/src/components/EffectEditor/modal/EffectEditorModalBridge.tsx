import type { EffectDto } from '@artificer-toolkit/schema'
import { useAppForm } from '#components/Form/runtime'
import { EffectEditorModalForm } from './EffectEditorModal'
import type { EffectEditorReferenceData } from '../effectEditor.types'

export function EffectEditorModalBridge({
  effect,
  index,
  references,
  readOnly,
  sourceLabel,
  titleId,
  onChange,
  onClose
}: {
  effect: EffectDto
  index: number
  references: EffectEditorReferenceData
  readOnly?: boolean
  sourceLabel: string
  titleId?: string
  onChange: (effect: EffectDto) => void
  onClose: () => void
}) {
  const form = useAppForm({
    defaultValues: effect,
    onSubmit: () => undefined,
    listeners: {
      onChange: ({ formApi }) => {
        onChange(formApi.state.values)
      }
    }
  })

  return (
    <form.AppForm>
      <EffectEditorModalForm
        form={form}
        index={index}
        references={references}
        readOnly={readOnly ?? false}
        sourceLabel={sourceLabel}
        titleId={titleId}
        onClose={onClose}
      />
    </form.AppForm>
  )
}
