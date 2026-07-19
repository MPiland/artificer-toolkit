import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { withFieldGroup } from '../app-form/AppForm'
import { toTypedAuthoringFieldName } from '../utils/pathUtils'
import { getRequiredValidators, isRenderableNode } from './FormRenderer.utils'
import { ResolvedInputControl } from './ResolvedInputControl'
import * as styles from './FormRenderer.css'

export const ResolvedLeafFieldGroup = withFieldGroup({
  defaultValues: {} as Record<string, unknown>,
  props: {} as { model: NodeRuntimeResolveResponseDto; readOnly: boolean },
  render: function ResolvedLeafFieldGroupContent({ group, model, readOnly }) {
    const nodes = model.steps.flatMap((step) =>
      step.sections.flatMap((section) => section.nodes.filter(isRenderableNode))
    )

    return (
      <div className={styles.fieldGrid}>
        {nodes.map((node) => {
          if (node.kind !== 'INPUT') return null
          const fieldName = toTypedAuthoringFieldName<Record<string, unknown>>(undefined, node.path)
          const validators = node.required
            ? getRequiredValidators(node.type, node.label)
            : undefined

          return (
            <group.AppField key={node.id} name={fieldName} validators={validators}>
              {() => <ResolvedInputControl node={node} readOnly={readOnly} />}
            </group.AppField>
          )
        })}
      </div>
    )
  }
})
