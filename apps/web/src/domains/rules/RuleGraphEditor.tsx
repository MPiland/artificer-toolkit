import './rules.css'
import {
  DecisionGraph,
  JdmConfigProvider,
  nodeSpecification,
  type DecisionGraphType
} from '@gorules/jdm-editor'
import { editorNodeComponents } from './ruleDocument'

const components = editorNodeComponents.map((key) => nodeSpecification[key])

export function RuleGraphEditor({
  disabled,
  value,
  onChange
}: {
  disabled: boolean
  value: DecisionGraphType
  onChange: (value: DecisionGraphType) => void
}) {
  return (
    <JdmConfigProvider>
      <DecisionGraph
        components={components}
        disabled={disabled}
        value={value}
        onChange={onChange}
      />
    </JdmConfigProvider>
  )
}
