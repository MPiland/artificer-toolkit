import type { EffectDto } from '@artificer-toolkit/schema'
import { useAppForm } from '#components/Form/runtime'
import { EffectInvocationStep } from '../steps/EffectInvocationStep'

export function EffectInvocationBridge({
  invocation,
  index,
  readOnly,
  onChange
}: {
  invocation: EffectDto['invocation']
  index: number
  readOnly?: boolean
  onChange: (invocation: EffectDto['invocation']) => void
}) {
  const form = useAppForm({
    defaultValues: { invocation },
    onSubmit: () => undefined,
    listeners: {
      onChange: ({ formApi }) => {
        onChange(formApi.state.values.invocation)
      }
    }
  })

  return (
    <form.AppForm>
      <EffectInvocationStep
        form={form}
        fields={{ invocation: 'invocation' }}
        index={index}
        readOnly={readOnly ?? false}
      />
    </form.AppForm>
  )
}
