import type { DeepKeys } from '@tanstack/react-form'
import type { NodeRuntimeInputNodeDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { withForm } from '../app-form/AppForm'
import { getRequiredValidators } from './FormRenderer.utils'
import { ResolvedInputControl } from './ResolvedInputControl'

type ResolvedInputFieldProps<TValues extends object> = {
  fieldName: DeepKeys<TValues>
  node: NodeRuntimeInputNodeDto
  readOnly: boolean
}

export function createResolvedInputField<TValues extends object>(defaultValues: TValues) {
  return withForm({
    defaultValues,
    props: {} as ResolvedInputFieldProps<TValues>,
    render: function ResolvedInputField({ fieldName, form, node, readOnly }) {
      const validators = node.required ? getRequiredValidators(node.type, node.label) : undefined

      return (
        <form.AppField name={fieldName} validators={validators}>
          {() => <ResolvedInputControl node={node} readOnly={readOnly} />}
        </form.AppField>
      )
    }
  })
}
