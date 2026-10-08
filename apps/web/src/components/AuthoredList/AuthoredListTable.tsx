import { Table } from '@mantine/core'
import clsx from 'clsx'
import type { CSSProperties, RefObject } from 'react'
import { AuthoredListActions } from './AuthoredListActions'
import {
  AuthoredListAccentDot,
  AuthoredListBadges,
  AuthoredListStatusChip
} from './AuthoredListItemMeta'
import type {
  AuthoredListActionHandlers,
  AuthoredListAttributeColumn,
  AuthoredListAttributeValue,
  AuthoredListItem
} from './AuthoredList.types'
import { getAuthoredListColumnWidths, getAuthoredListSourceLabel } from './authoredList.utils'
import * as itemMetaStyles from './AuthoredListItemMeta.css'
import * as styles from './AuthoredListTable.css'

const minimumTableWidth = 1188

export function AuthoredListTable({
  filteredItems,
  attributeColumns,
  hasAccentColumn,
  hasStatusColumn,
  hasBadgeColumn,
  renderedRows,
  paddingTop,
  paddingBottom,
  viewportRef,
  embedded = false,
  onView,
  onViewIntent,
  actionHandlers
}: {
  filteredItems: AuthoredListItem[]
  attributeColumns: AuthoredListAttributeColumn[]
  hasAccentColumn: boolean
  hasStatusColumn: boolean
  hasBadgeColumn: boolean
  renderedRows: number[]
  paddingTop: number
  paddingBottom: number
  viewportRef?: RefObject<HTMLDivElement | null>
  embedded?: boolean
  onView?: (item: AuthoredListItem) => void
  onViewIntent?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
}) {
  const columnWidths = getAuthoredListColumnWidths(attributeColumns, {
    hasAccentColumn,
    hasStatusColumn,
    hasBadgeColumn
  })
  const columnCount = columnWidths.length
  const tableMinWidth = Math.max(
    minimumTableWidth,
    columnWidths.reduce((sum, width) => sum + width, 0)
  )

  return (
    <div className={embedded ? undefined : styles.tableScroll} ref={viewportRef}>
      <Table
        aria-label='Authored content table'
        classNames={{
          thead: styles.tableHead,
          th: styles.tableHeaderCell,
          td: styles.tableBodyCell
        }}
        className={styles.table}
        style={{ minWidth: tableMinWidth }}
        stickyHeader
        verticalSpacing={0}
        horizontalSpacing={0}
      >
        <colgroup>
          {columnWidths.map((width, index) => (
            <col key={`${width}-${index}`} style={{ width }} />
          ))}
        </colgroup>
        <Table.Thead>
          <Table.Tr>
            {hasAccentColumn ? (
              <Table.Th
                className={clsx(styles.dotCell, styles.tableHeaderEdgeStart)}
                aria-label='Accent'
              />
            ) : null}
            <Table.Th
              className={clsx(
                !hasAccentColumn && styles.nameColumnNoAccent,
                !hasAccentColumn && styles.tableHeaderEdgeStart
              )}
            >
              Name
            </Table.Th>
            {attributeColumns.map((column) => (
              <Table.Th key={column.key}>{column.label}</Table.Th>
            ))}
            {hasStatusColumn ? <Table.Th>Status</Table.Th> : null}
            {hasBadgeColumn ? <Table.Th>Tags</Table.Th> : null}
            <Table.Th>Source</Table.Th>
            <Table.Th className={clsx(styles.actionCell, styles.tableHeaderEdgeEnd)}>
              Actions
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paddingTop > 0 ? <SpacerRow height={paddingTop} columnCount={columnCount} /> : null}
          {renderedRows.map((itemIndex) => (
            <AuthoredListRow
              item={filteredItems[itemIndex]}
              attributeColumns={attributeColumns}
              hasAccentColumn={hasAccentColumn}
              hasStatusColumn={hasStatusColumn}
              hasBadgeColumn={hasBadgeColumn}
              key={filteredItems[itemIndex].id}
              onView={onView}
              onViewIntent={onViewIntent}
              actionHandlers={actionHandlers}
            />
          ))}
          {paddingBottom > 0 ? (
            <SpacerRow height={paddingBottom} columnCount={columnCount} />
          ) : null}
        </Table.Tbody>
      </Table>
    </div>
  )
}

function SpacerRow({ height, columnCount }: { height: number; columnCount: number }) {
  return (
    <Table.Tr aria-hidden='true'>
      <Table.Td className={styles.spacerCell} colSpan={columnCount} style={{ height }} />
    </Table.Tr>
  )
}

function AuthoredListRow({
  item,
  attributeColumns,
  hasAccentColumn,
  hasStatusColumn,
  hasBadgeColumn,
  onView,
  onViewIntent,
  actionHandlers
}: {
  item: AuthoredListItem
  attributeColumns: AuthoredListAttributeColumn[]
  hasAccentColumn: boolean
  hasStatusColumn: boolean
  hasBadgeColumn: boolean
  onView?: (item: AuthoredListItem) => void
  onViewIntent?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
}) {
  const sourceLabel = getAuthoredListSourceLabel(item)
  const handleView = () => {
    if (item.permissions.canView) {
      onView?.(item)
    }
  }

  return (
    <Table.Tr
      className={styles.listRow}
      aria-label={`View ${item.name}`}
      onClick={handleView}
      onPointerEnter={() => {
        if (item.permissions.canView) {
          onViewIntent?.(item)
        }
      }}
    >
      {hasAccentColumn ? (
        <Table.Td className={clsx(styles.dotCell, styles.tableBodyEdgeStart)}>
          <AuthoredListAccentDot item={item} />
        </Table.Td>
      ) : null}
      <Table.Td
        className={clsx(
          styles.nameCell,
          !hasAccentColumn && styles.nameColumnNoAccent,
          !hasAccentColumn && styles.tableBodyEdgeStart
        )}
      >
        <NameContent item={item} onViewIntent={onViewIntent} handleView={handleView} />
      </Table.Td>
      {attributeColumns.map((column) => (
        <Table.Td
          key={column.key}
          className={
            Array.isArray(item.attributes?.[column.key]) ? styles.chipCell : styles.monoCell
          }
        >
          <AuthoredListAttributeContent
            value={item.attributes?.[column.key]}
            fallback={column.fallback}
          />
        </Table.Td>
      ))}
      {hasStatusColumn ? (
        <Table.Td className={styles.statusCell}>
          <AuthoredListStatusChip item={item} />
        </Table.Td>
      ) : null}
      {hasBadgeColumn ? (
        <Table.Td className={styles.chipCell}>
          <AuthoredListBadges item={item} />
        </Table.Td>
      ) : null}
      <Table.Td>
        <span
          className={
            item.sourceKind === 'master'
              ? itemMetaStyles.masterSourceChip
              : itemMetaStyles.sourceChip
          }
        >
          {sourceLabel}
        </span>
      </Table.Td>
      <Table.Td
        className={clsx(styles.actionCell, styles.tableBodyEdgeEnd)}
        onClick={(event) => event.stopPropagation()}
      >
        <AuthoredListActions item={item} actionHandlers={actionHandlers} itemName={item.name} />
      </Table.Td>
    </Table.Tr>
  )
}

function NameContent({
  item,
  onViewIntent,
  handleView
}: {
  item: AuthoredListItem
  onViewIntent?: (item: AuthoredListItem) => void
  handleView: () => void
}) {
  const hierarchyLevel = item.hierarchy?.level ?? 0
  const hierarchyStyle = { '--authored-list-hierarchy-level': hierarchyLevel } as CSSProperties
  const name = item.permissions.canView ? (
    <button
      aria-label={`Open ${item.name}`}
      className={styles.itemNameButton}
      onFocus={() => onViewIntent?.(item)}
      onClick={(event) => {
        event.stopPropagation()
        handleView()
      }}
      type='button'
    >
      {item.name}
    </button>
  ) : (
    item.name
  )

  return (
    <span className={styles.nameHierarchy} style={hierarchyStyle}>
      {hierarchyLevel > 0 ? <span aria-hidden='true' className={styles.hierarchyMarker} /> : null}
      {name}
    </span>
  )
}

function AuthoredListAttributeContent({
  value,
  fallback
}: {
  value: AuthoredListAttributeValue
  fallback?: string
}) {
  if (Array.isArray(value)) {
    if (value.length === 0) return fallback ?? '-'

    return (
      <span className={itemMetaStyles.chipGroup}>
        {value.slice(0, 4).map((entry, index) => (
          <span key={`${entry}-${index}`} className={itemMetaStyles.classChip}>
            {entry}
          </span>
        ))}
      </span>
    )
  }

  return value ?? fallback ?? '-'
}
