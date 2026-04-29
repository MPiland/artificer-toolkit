import type { PathDto } from '@artificer-toolkit/schema'
import { useAppForm } from '#components/Form/runtime'
import { PathEditor } from '../steps/PathEditor'
import type { EffectEditorReferenceData } from '../effectEditor.types'

export function PathEditorBridge({
  path,
  references,
  readOnly,
  onChange
}: {
  path: PathDto
  references: EffectEditorReferenceData
  readOnly?: boolean
  onChange: (path: PathDto) => void
}) {
  const form = useAppForm({
    defaultValues: { path },
    onSubmit: () => undefined,
    listeners: {
      onChange: ({ formApi }) => {
        onChange(formApi.state.values.path)
      }
    }
  })

  return (
    <form.AppForm>
      <PathEditor
        form={form}
        fields={{ path: 'path' }}
        references={references}
        readOnly={readOnly ?? false}
      />
    </form.AppForm>
  )
}
