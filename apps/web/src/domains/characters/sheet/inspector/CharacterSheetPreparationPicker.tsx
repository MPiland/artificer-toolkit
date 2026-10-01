import { Button, Text } from '@mantine/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { CharacterSheetManageSpellRow } from './CharacterSheetManageSpellRow'
import * as editorStyles from './inspectorEditor.css'
import * as shellStyles from './inspectorShell.css'

export function CharacterSheetPreparationPicker({
  rows,
  disabled,
  preparationDisabled,
  canManageKnown,
  onPreparedChange,
  onKnownChange,
  onTargetChange
}: {
  rows: Array<ComponentProps<typeof CharacterSheetManageSpellRow>['spell']>
  disabled: boolean
  preparationDisabled: boolean
  canManageKnown: boolean
  onPreparedChange: ComponentProps<typeof CharacterSheetManageSpellRow>['onPreparedChange']
  onKnownChange: ComponentProps<typeof CharacterSheetManageSpellRow>['onKnownChange']
  onTargetChange: ComponentProps<typeof CharacterSheetManageSpellRow>['onTargetChange']
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState(40)
  const [scrollMargin, setScrollMargin] = useState(0)
  const getScrollElement = () =>
    listRef.current?.closest<HTMLElement>('[role="dialog"]') ?? listRef.current
  const virtualizer = useVirtualizer({
    count: Math.min(pageSize, rows.length),
    getScrollElement,
    getItemKey: (index) => rows[index]!.rowId,
    estimateSize: () => 64,
    measureElement: (element) => element.getBoundingClientRect().height || 64,
    overscan: 4,
    initialRect: { width: 400, height: 640 },
    scrollMargin
  })
  const virtualRows = virtualizer.getVirtualItems()

  useLayoutEffect(() => {
    const list = listRef.current
    const owner = getScrollElement()
    if (!list || !owner) return
    owner.scrollTop = 0
    const updateMargin = () =>
      setScrollMargin(
        list.getBoundingClientRect().top - owner.getBoundingClientRect().top + owner.scrollTop
      )
    updateMargin()
    const observer = new ResizeObserver(updateMargin)
    observer.observe(list)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const last = virtualRows.at(-1)
    if (last && last.index >= pageSize - 5 && pageSize < rows.length) {
      setPageSize((size) => Math.min(size + 40, rows.length))
    }
  }, [pageSize, rows.length, virtualRows])

  return (
    <section aria-label='Preparation options' className={shellStyles.section}>
      <Text component='h3' className={shellStyles.sectionTitle}>
        Available spells
      </Text>
      <div
        aria-label='Eligible spells'
        className={editorStyles.preparationList}
        ref={listRef}
        role='region'
        tabIndex={0}
        onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key))
            return
          // Native scrolling keeps keyboard users on the same inspector scroll surface.
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          const owner = getScrollElement()
          if (!owner) return
          const distance = event.key.startsWith('Page') ? owner.clientHeight : 64
          if (event.key === 'Home') virtualizer.scrollToIndex(0)
          else if (event.key === 'End') {
            setPageSize(rows.length)
            requestAnimationFrame(() => virtualizer.scrollToIndex(rows.length - 1))
          } else owner.scrollTop += ['ArrowUp', 'PageUp'].includes(event.key) ? -distance : distance
        }}
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualRows.map((virtualRow) => {
          const option = rows[virtualRow.index]!
          return (
            <div
              aria-label={option.label}
              className={editorStyles.preparationRow}
              data-index={virtualRow.index}
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              role='group'
              style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
            >
              <CharacterSheetManageSpellRow
                spell={option}
                disabled={disabled}
                preparationDisabled={preparationDisabled}
                canManageKnown={canManageKnown}
                onPreparedChange={onPreparedChange}
                onKnownChange={onKnownChange}
                onTargetChange={onTargetChange}
              />
            </div>
          )
        })}
      </div>
      {pageSize < rows.length ? (
        <Button
          size='xs'
          variant='default'
          onClick={() => setPageSize((size) => Math.min(size + 40, rows.length))}
        >
          Show more spells
        </Button>
      ) : null}
    </section>
  )
}
