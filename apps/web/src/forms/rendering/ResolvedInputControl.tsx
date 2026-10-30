import type { NodeRuntimeInputNodeDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { useFieldContext } from '../app-form/AppForm'
import {
  MultiSelectField,
  NumberField,
  NumberSelectField,
  RichTextField,
  SelectField,
  TextField,
  ToggleField
} from '../fields/AppFormFields'
import { useAuthoringSession } from '../layout/AuthoringFormContext'
import { toAuthoringFieldName } from '../utils/pathUtils'
import { useAuthoringRendererScope } from './FormRenderer.context'
import * as styles from './FormRenderer.css'

export function ResolvedInputControl({
  node,
  readOnly
}: {
  node: NodeRuntimeInputNodeDto
  readOnly: boolean
}) {
  const field = useFieldContext<unknown>()
  const { validationIssues } = useAuthoringSession()
  const { structuralChangeGuard } = useAuthoringRendererScope()
  const fieldName = field.name
  const validationError = validationIssues
    .filter((issue) => toAuthoringFieldName(undefined, issue.path) === fieldName)
    .map((issue) => issue.message)
    .join(' ')
  const commonProps = {
    error: validationError || undefined,
    label: node.label,
    maximum: node.constraints?.maximum,
    maximumLength: node.constraints?.maximumLength,
    minimum: node.constraints?.minimum,
    required: node.required,
    readOnly
  }

  switch (node.type) {
    case 'TEXT':
      return <TextField {...commonProps} />
    case 'NUMBER':
      return <NumberField {...commonProps} />
    case 'TOGGLE':
      return (
        <ToggleField
          {...commonProps}
          changePending={structuralChangeGuard.blocked}
          onChangeRequest={(nextValue, commit) =>
            structuralChangeGuard.request({
              commit,
              fieldName,
              label: node.label,
              nextValue
            })
          }
        />
      )
    case 'RICH_TEXT':
      return (
        <div className={styles.wideField}>
          <RichTextField {...commonProps} />
        </div>
      )
    case 'SELECT_SINGLE':
      return (
        <SelectField
          {...commonProps}
          changePending={structuralChangeGuard.blocked}
          data={node.options}
          onChangeRequest={(nextValue, commit) =>
            structuralChangeGuard.request({
              commit,
              fieldName,
              label: node.label,
              nextValue
            })
          }
        />
      )
    case 'SELECT_NUMBER':
      return (
        <NumberSelectField
          {...commonProps}
          changePending={structuralChangeGuard.blocked}
          data={node.options}
          onChangeRequest={(nextValue, commit) =>
            structuralChangeGuard.request({
              commit,
              fieldName,
              label: node.label,
              nextValue
            })
          }
        />
      )
    case 'SELECT_MULTI':
      return (
        <MultiSelectField
          {...commonProps}
          changePending={structuralChangeGuard.blocked}
          data={node.options}
          onChangeRequest={(nextValue, commit) =>
            structuralChangeGuard.request({
              commit,
              fieldName,
              label: node.label,
              nextValue
            })
          }
        />
      )
  }
}
