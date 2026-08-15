import './rules.css'
import { ActionIcon, useComputedColorScheme } from '@mantine/core'
import { DecisionGraph, JdmConfigProvider, type DecisionGraphType } from '@gorules/jdm-editor'
import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react'
import { RuleNodePalette } from './RuleNodePalette'
import * as styles from './RuleGraphEditor.css'

export function RuleGraphEditor({
  disabled,
  focused,
  value,
  onChange,
  onToggleFocus
}: {
  disabled: boolean
  focused: boolean
  value: DecisionGraphType
  onChange: (value: DecisionGraphType) => void
  onToggleFocus: () => void
}) {
  const colorScheme = useComputedColorScheme('dark')

  return (
    <JdmConfigProvider theme={{ mode: colorScheme }}>
      <div className={styles.root}>
        <div className={styles.canvas}>
          <DecisionGraph disabled={disabled} hideLeftToolbar value={value} onChange={onChange} />
          <ActionIcon
            className={styles.focusControl}
            aria-label={focused ? 'Restore Rule Studio controls' : 'Focus graph'}
            aria-pressed={focused}
            title={focused ? 'Restore Rule Studio controls' : 'Focus graph'}
            variant='default'
            onClick={onToggleFocus}
          >
            {focused ? (
              <IconArrowsMinimize aria-hidden='true' size={16} />
            ) : (
              <IconArrowsMaximize aria-hidden='true' size={16} />
            )}
          </ActionIcon>
          <RuleNodePalette
            disabled={disabled}
            hasInputNode={value.nodes.some((node) => node.type === 'inputNode')}
          />
        </div>
      </div>
    </JdmConfigProvider>
  )
}
