import { ActionIcon, Button, Group, Menu, SegmentedControl, Select, Skeleton, Table, Text, TextInput, Tooltip } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import IMore from '#assets/icons/IMore'
import ICreate from '#assets/icons/ICreate'
import ICopy from '#assets/icons/ICopy'
import IEdit from '#assets/icons/IEdit'
import IGrid from '#assets/icons/IGrid'
import IList from '#assets/icons/IList'
import ITrash from '#assets/icons/ITrash'
import { PageHeader } from '#app/shell'
import type {
  AuthoredListAttributeColumn,
  AuthoredListAttributeValue,
  AuthoredListFilter,
  AuthoredListItem,
  AuthoredListPageProps,
  AuthoredListViewMode
} from './AuthoredList.types'
import {
  getFacetedFilterOptionsByKey,
  itemMatchesQuery,
  itemMatchesSelectedFilters,
  type AuthoredListFilterValues
} from './AuthoredList.filters'
import * as styles from './AuthoredList.css'

const mobileQuery = '(max-width: 760px)'
const tabletQuery = '(max-width: 1120px)'
const minimumTableWidth = 1188
const accentColumnWidth = 32
const nameColumnWidth = 360
const defaultAttributeColumnWidth = 160
const statusColumnWidth = 124
const badgeColumnWidth = 240
const sourceColumnWidth = 132
const actionColumnWidth = 132

export function AuthoredListPage({
  title,
  summary,
  createLabel,
  items,
  draftItems = [],
  filters,
  attributeColumns = [],
  sortOptions = [{ value: 'name', label: 'Name A-Z' }],
  defaultSort = 'name',
  emptyState,
  error,
  loading = false,
  initialViewMode,
  onCreate,
  onView,
  onViewIntent,
  onEdit,
  onCopy,
  onDelete
}: AuthoredListPageProps) {
  const isMobile = useMediaQuery(mobileQuery, false)
  const isTablet = useMediaQuery(tabletQuery, false)
  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState<AuthoredListFilterValues>(() => buildInitialFilters(filters))
  const [sort, setSort] = useState(defaultSort)
  const [contentPanel, setContentPanel] = useState<'active' | 'draft'>('active')
  const [viewMode, setViewMode] = useState<AuthoredListViewMode>(() => {
    if (initialViewMode) {
      return initialViewMode
    }

    if (typeof window === 'undefined') {
      return 'table'
    }

    return window.matchMedia(mobileQuery).matches ? 'cards' : 'table'
  })
  const viewportRef = useRef<HTMLDivElement>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const visibleItems = contentPanel === 'draft' ? draftItems : items
  const draftEmptyState = contentPanel === 'draft' && draftItems.length === 0
    ? <StatePanel title={`No draft ${title.toLowerCase()}.`} copy={`There are currently no draft ${title.toLowerCase()}.`} />
    : null

  const filteredItems = useMemo(() => {
    const matchingItems = visibleItems.filter((item) => {
      return itemMatchesQuery(item, normalizedQuery) && itemMatchesSelectedFilters(item, filters, filterValues)
    })

    return [...matchingItems].sort((left, right) => {
      const leftValue = left.sortValues?.[sort]
      const rightValue = right.sortValues?.[sort]

      if (typeof leftValue === 'number' || typeof rightValue === 'number') {
        return Number(leftValue ?? 0) - Number(rightValue ?? 0) || left.name.localeCompare(right.name)
      }

      return String(leftValue ?? left.name).localeCompare(String(rightValue ?? right.name))
    })
  }, [
    filterValues, filters, normalizedQuery, sort, visibleItems
  ])
  const facetedFilterOptions = useMemo(() => {
    return getFacetedFilterOptionsByKey({
      filters,
      filterValues,
      items: visibleItems,
      normalizedQuery
    })
  }, [
    filterValues, filters, normalizedQuery, visibleItems
  ])
  const hasAccentColumn = visibleItems.some(hasAuthoredListAccent)
  const hasStatusColumn = visibleItems.some(hasAuthoredListStatus)
  const hasBadgeColumn = visibleItems.some(hasAuthoredListBadges)

  const cardColumnCount = viewMode === 'cards'
    ? isMobile ? 1 : isTablet ? 2 : 3
    : 1
  const virtualRowCount = viewMode === 'cards'
    ? Math.ceil(filteredItems.length / cardColumnCount)
    : filteredItems.length
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual intentionally owns virtualization callbacks here.
  const rowVirtualizer = useVirtualizer({
    count: virtualRowCount,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => viewMode === 'cards' ? 220 : 64,
    overscan: 8,
    initialRect: {
      width: 1188,
      height: 640
    }
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const renderedRows = virtualRows.length > 0
    ? virtualRows.map((virtualRow) => virtualRow.index)
    : Array.from({ length: virtualRowCount }, (_, index) => index)
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0

  useEffect(() => {
    rowVirtualizer.measure()
    rowVirtualizer.scrollToOffset(0)
  }, [
    cardColumnCount, contentPanel, filterValues, query, rowVirtualizer, sort, viewMode
  ])

  useEffect(() => {
    if (isMobile && viewMode !== 'cards') {
      setViewMode('cards')
    }
  }, [isMobile, viewMode])

  const actionHandlers = {
    onEdit,
    onCopy,
    onDelete
  }

  return (
    <div className={styles.listStack}>
      <PageHeader
        title={title}
        description={summary}
        actions={(
          <Button leftSection={<ICreate />} onClick={onCreate}>
            {createLabel}
          </Button>
        )}
      />

      <div className={styles.contentTabs}>
        <SegmentedControl
          aria-label='Choose content state'
          data={[
            { label: `Active (${items.length})`, value: 'active' },
            { label: `Drafts (${draftItems.length})`, value: 'draft' }
          ]}
          value={contentPanel}
          onChange={(value) => setContentPanel(value === 'draft' ? 'draft' : 'active')}
        />
      </div>

      <div className={styles.toolbar} aria-label={`${title} list tools`}>
        <div className={styles.filterControls}>
          <TextInput
            aria-label={`Search ${title.toLowerCase()}`}
            classNames={{ input: styles.fieldInput }}
            placeholder='Search...'
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          {filters.map((filter) => (
            <Select
              key={filter.key}
              label={filter.label}
              placeholder={filter.placeholder}
              classNames={{ input: styles.fieldInput, label: styles.fieldLabel }}
              data={facetedFilterOptions[filter.key] ?? filter.options}
              value={filterValues[filter.key]}
              clearable
              onChange={(value) => {
                setFilterValues((current) => ({ ...current, [filter.key]: value }))
              }}
            />
          ))}
          <Select
            label='Sort'
            data={sortOptions}
            classNames={{ input: styles.fieldInput, label: styles.fieldLabel }}
            value={sort}
            allowDeselect={false}
            onChange={(value) => setSort(value ?? 'name')}
          />
        </div>
        <Group className={styles.viewToggleGroup} gap={4} role='group' aria-label='Choose list layout'>
          <Tooltip label='Table view' withArrow>
            <ActionIcon
              aria-label='Table view'
              aria-pressed={viewMode === 'table'}
              className={`${styles.viewToggleButton} ${viewMode === 'table' ? styles.viewToggleButtonActive : ''}`}
              disabled={isMobile}
              variant='subtle'
              onClick={() => setViewMode('table')}
            >
              <IList />
            </ActionIcon>
          </Tooltip>
          <Tooltip label='Card view' withArrow>
            <ActionIcon
              aria-label='Card view'
              aria-pressed={viewMode === 'cards'}
              className={`${styles.viewToggleButton} ${viewMode === 'cards' ? styles.viewToggleButtonActive : ''}`}
              variant='subtle'
              onClick={() => setViewMode('cards')}
            >
              <IGrid />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      <section className={styles.tableShell} aria-label={`${title} results`}>
        {loading ? <LoadingRows /> : null}
        {!loading && error ? <StatePanel title='Something went sideways.' copy={error} /> : null}
        {!loading && !error && filteredItems.length === 0
          ? (draftEmptyState ?? emptyState ?? <StatePanel title={`No ${title.toLowerCase()} found.`} copy='Try a different search or clear a filter.' />)
          : null}
        {!loading && !error && filteredItems.length > 0
          ? (
              viewMode === 'cards'
                ? (
                    <CardList
                      cardColumnCount={cardColumnCount}
                      filteredItems={filteredItems}
                      attributeColumns={attributeColumns}
                      onView={onView}
                      onViewIntent={onViewIntent}
                      paddingBottom={paddingBottom}
                      paddingTop={paddingTop}
                      renderedRows={renderedRows}
                      viewportRef={viewportRef}
                      actionHandlers={actionHandlers}
                      useMenuActions={isMobile}
                    />
                  )
                : (
                    <TableList
                      filteredItems={filteredItems}
                      attributeColumns={attributeColumns}
                      hasAccentColumn={hasAccentColumn}
                      hasStatusColumn={hasStatusColumn}
                      hasBadgeColumn={hasBadgeColumn}
                      onView={onView}
                      onViewIntent={onViewIntent}
                      paddingBottom={paddingBottom}
                      paddingTop={paddingTop}
                      renderedRows={renderedRows}
                      viewportRef={viewportRef}
                      actionHandlers={actionHandlers}
                    />
                  )
            )
          : null}
      </section>
    </div>
  )
}

function TableList({
  filteredItems,
  attributeColumns,
  hasAccentColumn,
  hasStatusColumn,
  hasBadgeColumn,
  renderedRows,
  paddingTop,
  paddingBottom,
  viewportRef,
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
  viewportRef: RefObject<HTMLDivElement | null>
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
  const tableMinWidth = Math.max(minimumTableWidth, columnWidths.reduce((sum, width) => sum + width, 0))

  return (
    <div className={styles.tableScroll} ref={viewportRef}>
      <Table
        aria-label='Authored content table'
        className={styles.table}
        style={{ minWidth: tableMinWidth }}
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
            {hasAccentColumn ? <Table.Th className={styles.dotCell} aria-label='Accent' /> : null}
            <Table.Th className={!hasAccentColumn ? styles.nameColumnNoAccent : undefined}>Name</Table.Th>
            {attributeColumns.map((column) => (
              <Table.Th key={column.key}>{column.label}</Table.Th>
            ))}
            {hasStatusColumn ? <Table.Th>Status</Table.Th> : null}
            {hasBadgeColumn ? <Table.Th>Tags</Table.Th> : null}
            <Table.Th>Source</Table.Th>
            <Table.Th className={styles.actionCell}>Actions</Table.Th>
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
          {paddingBottom > 0 ? <SpacerRow height={paddingBottom} columnCount={columnCount} /> : null}
        </Table.Tbody>
      </Table>
    </div>
  )
}

function CardList({
  cardColumnCount,
  filteredItems,
  attributeColumns,
  renderedRows,
  paddingTop,
  paddingBottom,
  viewportRef,
  onView,
  onViewIntent,
  actionHandlers,
  useMenuActions
}: {
  cardColumnCount: number
  filteredItems: AuthoredListItem[]
  attributeColumns: AuthoredListAttributeColumn[]
  renderedRows: number[]
  paddingTop: number
  paddingBottom: number
  viewportRef: RefObject<HTMLDivElement | null>
  onView?: (item: AuthoredListItem) => void
  onViewIntent?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
  useMenuActions: boolean
}) {
  return (
    <div className={styles.cardViewport} ref={viewportRef}>
      {paddingTop > 0 ? <div aria-hidden='true' style={{ height: paddingTop }} /> : null}
      <div className={styles.cardStack}>
        {renderedRows.map((rowIndex) => {
          const rowItems = filteredItems.slice(rowIndex * cardColumnCount, rowIndex * cardColumnCount + cardColumnCount)

          return (
            <div
              className={styles.cardRow}
              data-testid='authored-list-card-row'
              key={rowIndex}
              style={{ '--authored-list-card-columns': cardColumnCount } as CSSProperties}
            >
              {rowItems.map((item) => (
                <AuthoredListCard
                  item={item}
                  attributeColumns={attributeColumns}
                  key={item.id}
                  onView={onView}
                  onViewIntent={onViewIntent}
                  actionHandlers={actionHandlers}
                  useMenuActions={useMenuActions}
                />
              ))}
            </div>
          )
        })}
      </div>
      {paddingBottom > 0 ? <div aria-hidden='true' style={{ height: paddingBottom }} /> : null}
    </div>
  )
}

function SpacerRow({ height, columnCount }: { height: number, columnCount: number }) {
  return (
    <Table.Tr aria-hidden='true'>
      <Table.Td colSpan={columnCount} style={{ height, padding: 0, border: 0 }} />
    </Table.Tr>
  )
}

function AuthoredListAccentDot({ item }: { item: AuthoredListItem }) {
  if (!hasAuthoredListAccent(item)) {
    return null
  }

  const style = { '--authored-list-accent': item.accentColor } as CSSProperties

  return <span aria-hidden='true' className={styles.sourceDot} style={style} title={item.accentLabel} />
}

function hasAuthoredListAccent(
  item: AuthoredListItem
): item is AuthoredListItem & { accentColor: string, accentLabel: string } {
  return Boolean(item.accentColor && item.accentLabel)
}

function hasAuthoredListStatus(item: AuthoredListItem): item is AuthoredListItem & { statusLabel: string } {
  return Boolean(item.statusLabel)
}

function hasAuthoredListBadges(item: AuthoredListItem): item is AuthoredListItem & { badges: string[] } {
  return Boolean(item.badges?.length)
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
  const sourceLabel = item.sourceKind === 'master' ? 'SRD' : item.sourceLabel
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
      {hasAccentColumn
        ? (
            <Table.Td className={styles.dotCell}>
              <AuthoredListAccentDot item={item} />
            </Table.Td>
          )
        : null}
      <Table.Td className={`${styles.nameCell} ${!hasAccentColumn ? styles.nameColumnNoAccent : ''}`}>
        {item.permissions.canView
          ? (
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
            )
          : item.name}
      </Table.Td>
      {attributeColumns.map((column) => (
        <Table.Td
          key={column.key}
          className={Array.isArray(item.attributes?.[column.key]) ? styles.chipCell : styles.monoCell}
        >
          <AuthoredListAttributeContent value={item.attributes?.[column.key]} fallback={column.fallback} />
        </Table.Td>
      ))}
      {hasStatusColumn
        ? (
            <Table.Td className={styles.statusCell}>
              <AuthoredListStatusChip item={item} />
            </Table.Td>
          )
        : null}
      {hasBadgeColumn
        ? (
            <Table.Td className={styles.chipCell}>
              <AuthoredListBadges item={item} />
            </Table.Td>
          )
        : null}
      <Table.Td>
        <span className={item.sourceKind === 'master' ? styles.masterSourceChip : styles.sourceChip}>
          {sourceLabel}
        </span>
      </Table.Td>
      <Table.Td className={styles.actionCell} onClick={(event) => event.stopPropagation()}>
        <AuthoredListActions item={item} actionHandlers={actionHandlers} itemName={item.name} />
      </Table.Td>
    </Table.Tr>
  )
}

function AuthoredListCard({
  item,
  attributeColumns,
  onView,
  onViewIntent,
  actionHandlers,
  useMenuActions
}: {
  item: AuthoredListItem
  attributeColumns: AuthoredListAttributeColumn[]
  onView?: (item: AuthoredListItem) => void
  onViewIntent?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
  useMenuActions: boolean
}) {
  const sourceLabel = item.sourceKind === 'master' ? 'SRD' : item.sourceLabel
  const primaryAttribute = attributeColumns[0]
  const secondaryAttribute = attributeColumns[1]
  const primaryLabel = primaryAttribute
    ? formatAttributeValue(item.attributes?.[primaryAttribute.key], primaryAttribute.fallback ?? primaryAttribute.label)
    : item.description ?? 'Details not set'
  const secondaryLabel = secondaryAttribute
    ? formatAttributeValue(item.attributes?.[secondaryAttribute.key], secondaryAttribute.fallback ?? secondaryAttribute.label)
    : item.description ?? 'Summary not set'
  const primaryAttributeInHeader = primaryAttribute?.key === 'level'
  const sourceChipClass = item.sourceKind === 'master' ? styles.masterSourceChip : styles.sourceChip
  const handleView = () => {
    if (item.permissions.canView) {
      onView?.(item)
    }
  }

  return (
    <article
      aria-label={`View ${item.name}`}
      className={styles.card}
      onClick={handleView}
      onPointerEnter={() => {
        if (item.permissions.canView) {
          onViewIntent?.(item)
        }
      }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <AuthoredListAccentDot item={item} />
          <div className={styles.cardTitleStack}>
            <h2 className={styles.cardTitle}>
              {item.permissions.canView
                ? (
                    <button
                      aria-label={`Open ${item.name}`}
                      className={styles.cardTitleButton}
                      onFocus={() => onViewIntent?.(item)}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleView()
                      }}
                      type='button'
                    >
                      {item.name}
                    </button>
                  )
                : item.name}
            </h2>
            {secondaryAttribute ? <span className={styles.cardSubline}>{secondaryLabel}</span> : null}
          </div>
        </div>
        <span className={styles.cardMetaGroup}>
          <AuthoredListStatusChip item={item} />
          {primaryAttributeInHeader ? <span className={styles.levelBadge}>{primaryLabel}</span> : null}
        </span>
      </div>
      <div className={styles.cardFeatureRow}>
        {primaryAttribute && !primaryAttributeInHeader ? <span className={styles.levelBadge}>{primaryLabel}</span> : null}
        <span className={styles.cardFeatureText}>{item.description ?? 'No description yet.'}</span>
      </div>
      <div className={styles.cardFooter} onClick={(event) => event.stopPropagation()}>
        <span className={styles.cardFooterMeta}>
          <span className={sourceChipClass}>
            {sourceLabel}
          </span>
          <AuthoredListBadges item={item} />
        </span>
        <AuthoredListActions item={item} actionHandlers={actionHandlers} itemName={item.name} menu={useMenuActions} />
      </div>
    </article>
  )
}

interface AuthoredListActionHandlers {
  onEdit?: (item: AuthoredListItem) => void
  onCopy?: (item: AuthoredListItem) => void
  onDelete?: (item: AuthoredListItem) => void
}

interface AuthoredListAction {
  label: string
  icon: ReactNode
  tone?: 'danger'
  onSelect: () => void
}

function AuthoredListActions({
  item,
  actionHandlers,
  itemName,
  menu = false
}: {
  item: AuthoredListItem
  actionHandlers: AuthoredListActionHandlers
  itemName: string
  menu?: boolean
}) {
  const actions = getAvailableActions(item, actionHandlers)

  if (actions.length === 0) {
    return null
  }

  if (menu) {
    return (
      <Menu position='bottom-end' width={180}>
        <Menu.Target>
          <ActionIcon
            aria-label={`More actions for ${item.name}`}
            className={styles.moreActionButton}
            variant='default'
          >
            <IMore />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {actions.map((action) => (
            <Menu.Item key={action.label} leftSection={action.icon} onClick={action.onSelect}>
              {action.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    )
  }

  return (
    <Group gap='xs' justify='flex-start'>
      {actions.map((action) => (
        <Tooltip key={action.label} label={`${action.label} ${itemName}`} withArrow>
          <ActionIcon
            aria-label={`${action.label} ${itemName}`}
            className={`${styles.rowActionButton} ${action.tone === 'danger' ? styles.dangerActionButton : ''}`}
            variant='default'
            onClick={(event) => {
              event.stopPropagation()
              action.onSelect()
            }}
          >
            {action.icon}
          </ActionIcon>
        </Tooltip>
      ))}
    </Group>
  )
}

function getAvailableActions(item: AuthoredListItem, actionHandlers: AuthoredListActionHandlers) {
  const actions: AuthoredListAction[] = []

  if (item.permissions.canEdit) {
    actions.push({ label: 'Edit', icon: <IEdit />, onSelect: () => actionHandlers.onEdit?.(item) })
  }

  if (item.permissions.canCopy) {
    actions.push({ label: 'Duplicate', icon: <ICopy />, onSelect: () => actionHandlers.onCopy?.(item) })
  }

  if (item.permissions.canDelete) {
    actions.push({ label: 'Delete', icon: <ITrash />, tone: 'danger', onSelect: () => actionHandlers.onDelete?.(item) })
  }

  return actions
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
      <span className={styles.chipGroup}>
        {value.slice(0, 4).map((entry, index) => (
          <span key={`${entry}-${index}`} className={styles.classChip}>{entry}</span>
        ))}
      </span>
    )
  }

  return value ?? fallback ?? '-'
}

function AuthoredListBadges({ item }: { item: AuthoredListItem }) {
  if (!hasAuthoredListBadges(item)) {
    return null
  }

  return (
    <span className={styles.chipGroup}>
      {item.badges.slice(0, 4).map((badge) => (
        <span key={badge} className={styles.classChip}>{badge}</span>
      ))}
    </span>
  )
}

function AuthoredListStatusChip({ item }: { item: AuthoredListItem }) {
  if (!hasAuthoredListStatus(item)) {
    return null
  }

  return (
    <span className={`${styles.statusChip} ${item.statusTone === 'draft' ? styles.statusChipDraft : ''}`}>
      {item.statusLabel}
    </span>
  )
}

function formatAttributeValue(value: AuthoredListAttributeValue, fallback: string) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : fallback
  return value ?? fallback
}

function getAuthoredListColumnWidths(
  attributeColumns: AuthoredListAttributeColumn[],
  options: {
    hasAccentColumn: boolean
    hasStatusColumn: boolean
    hasBadgeColumn: boolean
  }
) {
  return [
    ...(options.hasAccentColumn ? [accentColumnWidth] : []),
    nameColumnWidth,
    ...attributeColumns.map((column) => column.width ?? defaultAttributeColumnWidth),
    ...(options.hasStatusColumn ? [statusColumnWidth] : []),
    ...(options.hasBadgeColumn ? [badgeColumnWidth] : []),
    sourceColumnWidth,
    actionColumnWidth
  ]
}

function LoadingRows() {
  return (
    <div className={styles.statePanel} aria-label='Loading list'>
      <IMore />
      <Text fw={600}>Loading content...</Text>
      <Skeleton height={16} width='70%' />
      <Skeleton height={16} width='52%' />
    </div>
  )
}

function StatePanel({ title, copy }: { title: string, copy: string }) {
  return (
    <div className={styles.statePanel}>
      <Text fw={700}>{title}</Text>
      <Text size='sm' c='dimmed'>{copy}</Text>
    </div>
  )
}

function buildInitialFilters(filters: AuthoredListFilter[]): AuthoredListFilterValues {
  return filters.reduce<AuthoredListFilterValues>((values, filter) => {
    values[filter.key] = null
    return values
  }, {})
}
