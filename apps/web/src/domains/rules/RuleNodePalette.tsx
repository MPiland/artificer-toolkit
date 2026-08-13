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
  return (
    <aside className={styles.root} aria-label='Rule components'>
      <div className={styles.header}>
        <h2 className={styles.heading}>Components</h2>
        <p className={styles.hint}>Drag onto canvas</p>
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
              <span>{label}</span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
