import { useId, useMemo, useState } from 'react'
import { VisuallyHidden } from '@mantine/core'
import { GripVertical } from 'lucide-react'
import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import {
  ManualCollectionOrderingContext,
  useManualCollectionOrderingContext
} from './manualCollectionOrderingContext'
import type {
  ManualCollectionOrderingProviderProps,
  ManualCollectionOrderingRowProps
} from './manualCollectionOrdering.types'
import * as styles from './CollectionField.css'

export function ManualCollectionOrderingProvider({
  children,
  disabled,
  enabled,
  items,
  onMove
}: ManualCollectionOrderingProviderProps) {
  const generatedId = useId().replace(/:/g, '')
  const instructionsId = `manual-collection-ordering-${generatedId}`
  const [announcement, setAnnouncement] = useState('')
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const context = useMemo(() => ({ instructionsId }), [instructionsId])

  if (!enabled) return children

  return (
    <ManualCollectionOrderingContext.Provider value={context}>
      <DragDropProvider
        onDragStart={({ operation }) => {
          const source = operation.source
          if (!source || !isSortable(source)) return
          const item = itemById.get(String(source.id))
          setAnnouncement(
            `Picked up ${item?.label ?? 'item'}, position ${source.index + 1} of ${items.length}.`
          )
        }}
        onDragOver={({ operation }) => {
          const source = operation.source
          const target = operation.target
          if (!source || !target || !isSortable(source) || !isSortable(target)) return
          const item = itemById.get(String(source.id))
          setAnnouncement(
            `${item?.label ?? 'Item'} moved to position ${target.index + 1} of ${items.length}.`
          )
        }}
        onDragEnd={(event) => {
          const source = event.operation.source
          const target = event.operation.target
          if (event.canceled) {
            setAnnouncement('Reordering cancelled. The collection order was not changed.')
            return
          }
          if (!source || !target || !isSortable(source) || !isSortable(target)) return
          const item = itemById.get(String(source.id))
          if (!disabled && source.initialIndex !== target.index) {
            onMove(source.initialIndex, target.index)
          }
          setAnnouncement(
            `${item?.label ?? 'Item'} placed at position ${target.index + 1} of ${items.length}.`
          )
        }}
      >
        {children}
      </DragDropProvider>
      <VisuallyHidden id={instructionsId}>
        To reorder this collection, focus a drag handle and press Space or Enter. Use the arrow keys
        to move the item, press Space or Enter to place it, or press Escape to cancel.
      </VisuallyHidden>
      <VisuallyHidden aria-live='assertive' aria-atomic='true'>
        {announcement}
      </VisuallyHidden>
    </ManualCollectionOrderingContext.Provider>
  )
}

export function ManualCollectionOrderingRow({
  children,
  disabled,
  id,
  index,
  label
}: ManualCollectionOrderingRowProps) {
  const { instructionsId } = useManualCollectionOrderingContext()
  const { handleRef, isDragging, ref } = useSortable({ disabled, id, index })

  return (
    <div className={styles.manualOrderingRow} data-dragging={isDragging || undefined} ref={ref}>
      <button
        aria-describedby={instructionsId}
        aria-label={`Reorder ${label}`}
        className={styles.manualOrderingHandle}
        disabled={disabled}
        ref={handleRef}
        type='button'
      >
        <GripVertical aria-hidden='true' size={18} />
      </button>
      <div className={styles.manualOrderingContent}>{children}</div>
    </div>
  )
}
