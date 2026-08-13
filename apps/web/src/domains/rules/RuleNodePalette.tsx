import { useState, type CSSProperties } from 'react'
import { ActionIcon } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { nodeSpecification } from '@gorules/jdm-editor'
import { ruleNodePaletteItems } from './ruleNodePaletteModel'
import * as styles from './RuleNodePalette.css'

export function RuleNodePalette({
  disabled,
  hasInputNode
}: {
  disabled: boolean
  hasInputNode: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={styles.root}
      aria-label='Rule components'
      data-collapsed={collapsed || undefined}
    >
      <div className={styles.header}>
        {collapsed ? null : (
          <div>
            <h2 className={styles.heading}>Components</h2>
            <p className={styles.hint}>Drag onto canvas</p>
          </div>
        )}
        <ActionIcon
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand components' : 'Collapse components'}
          size='sm'
          title={collapsed ? 'Expand components' : 'Collapse components'}
          variant='subtle'
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
        </ActionIcon>
      </div>
      <div className={styles.list} role='list'>
        {ruleNodePaletteItems.map(({ label, type }) => {
          const itemDisabled = disabled || (type === 'inputNode' && hasInputNode)
          const specification = nodeSpecification[type]

          return (
            <div
              key={type}
              className={styles.item}
              role='listitem'
              aria-disabled={itemDisabled}
              data-disabled={itemDisabled || undefined}
              draggable={!itemDisabled}
              style={
                {
                  [styles.nodeColor]: specification.color ?? 'currentColor'
                } as CSSProperties
              }
              title={itemDisabled ? `${label} is unavailable` : `Drag ${label} onto the canvas`}
              onDragStart={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect()
                const relativePosition = {
                  x: bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5,
                  y: bounds.height > 0 ? (event.clientY - bounds.top) / bounds.height : 0.5
                }
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('nodeType', type)
                event.dataTransfer.setData('relativePosition', JSON.stringify(relativePosition))
              }}
            >
              <span className={styles.icon} aria-hidden='true'>
                {specification.icon}
              </span>
              {collapsed ? null : <span className={styles.label}>{label}</span>}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
