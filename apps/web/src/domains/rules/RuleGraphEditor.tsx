import './rules.css'
import { useComputedColorScheme } from '@mantine/core'
import { DecisionGraph, JdmConfigProvider, type DecisionGraphType } from '@gorules/jdm-editor'
import { RuleNodePalette } from './RuleNodePalette'
import * as styles from './RuleGraphEditor.css'

export function RuleGraphEditor({
  disabled,
  value,
  onChange
}: {
  disabled: boolean
  value: DecisionGraphType
  onChange: (value: DecisionGraphType) => void
}) {
  const colorScheme = useComputedColorScheme('dark')

  return (
    <JdmConfigProvider theme={{ mode: colorScheme }}>
      <div className={styles.root}>
        <div className={styles.canvas}>
          <DecisionGraph disabled={disabled} hideLeftToolbar value={value} onChange={onChange} />
          <RuleNodePalette
            disabled={disabled}
            hasInputNode={value.nodes.some((node) => node.type === 'inputNode')}
          />
        </div>
      </div>
    </JdmConfigProvider>
  )
}
