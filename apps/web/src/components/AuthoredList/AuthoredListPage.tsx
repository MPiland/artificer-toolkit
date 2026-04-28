import { ActionIcon, Button, Group, Menu, Select, Skeleton, Table, Text, TextInput, Tooltip } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import IMore from '#assets/icons/IMore'
import ICreate from '#assets/icons/ICreate'
import ICopy from '#assets/icons/ICopy'
import IEdit from '#assets/icons/IEdit'
import IGrid from '#assets/icons/IGrid'
import IList from '#assets/icons/IList'
import ITrash from '#assets/icons/ITrash'
import { PageHeader } from '#app/shell'
import type { AuthoredListFilter, AuthoredListItem, AuthoredListPageProps, AuthoredListViewMode } from './AuthoredList.types'
import * as styles from './AuthoredList.css'

const mobileQuery = '(max-width: 760px)'
const tabletQuery = '(max-width: 1120px)'

export function AuthoredListPage({
  title,
  summary,
  createLabel,
  items,
  filters,
  emptyState,
  error,
  loading = false,
  initialViewMode,
  onCreate,
  onView,
  onEdit,
  onCopy,
  onDelete
}: AuthoredListPageProps) {
  const isMobile = useMediaQuery(mobileQuery, false)
  const isTablet = useMediaQuery(tabletQuery, false)
  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState<Record<AuthoredListFilter['key'], string | null>>({
    school: null,
    level: null,
    class: null
  })
  const [sort, setSort] = useState('name')
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

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const matchingItems = items.filter((item) => {
      const matchesQuery = normalizedQuery.length === 0 || item.name.toLowerCase().includes(normalizedQuery)
      const matchesSchool = !filterValues.school || item.school === filterValues.school
      const matchesLevel = !filterValues.level || item.level === filterValues.level
      const matchesClass = !filterValues.class || item.classes?.includes(filterValues.class)

      return matchesQuery && matchesSchool && matchesLevel && matchesClass
    })

    return [...matchingItems].sort((left, right) => {
      if (sort === 'level') {
        return Number(left.level ?? 0) - Number(right.level ?? 0) || left.name.localeCompare(right.name)
      }

      return left.name.localeCompare(right.name)
    })
  }, [
    filterValues, items, query, sort
  ])

  const cardColumnCount = viewMode === 'cards'
    ? isMobile ? 1 : isTablet ? 2 : 3
    : 1
  const virtualRowCount = viewMode === 'cards'
    ? Math.ceil(filteredItems.length / cardColumnCount)
    : filteredItems.length
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
    cardColumnCount, filterValues, query, rowVirtualizer, sort, viewMode
  ])

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

      <div className={styles.toolbar} aria-label={`${title} list tools`}>
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
            data={filter.options}
            value={filterValues[filter.key]}
            clearable
            onChange={(value) => {
              setFilterValues((current) => ({ ...current, [filter.key]: value }))
            }}
          />
        ))}
        <Select
          label='Sort'
          data={[
            { value: 'name', label: 'Name A-Z' },
            { value: 'level', label: 'Level' }
          ]}
          classNames={{ input: styles.fieldInput, label: styles.fieldLabel }}
          value={sort}
          allowDeselect={false}
          onChange={(value) => setSort(value ?? 'name')}
        />
        <Group className={styles.viewToggleGroup} gap={4} role='group' aria-label='Choose list layout'>
          <Tooltip label='Table view' withArrow>
            <ActionIcon
              aria-label='Table view'
              aria-pressed={viewMode === 'table'}
              className={`${styles.viewToggleButton} ${viewMode === 'table' ? styles.viewToggleButtonActive : ''}`}
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
          ? (emptyState ?? <StatePanel title={`No ${title.toLowerCase()} found.`} copy='Try a different search or clear a filter.' />)
          : null}
        {!loading && !error && filteredItems.length > 0
          ? (
              viewMode === 'cards'
                ? (
                    <CardList
                      cardColumnCount={cardColumnCount}
                      filteredItems={filteredItems}
                      onView={onView}
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
                      onView={onView}
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
  renderedRows,
  paddingTop,
  paddingBottom,
  viewportRef,
  onView,
  actionHandlers
}: {
  filteredItems: AuthoredListItem[]
  renderedRows: number[]
  paddingTop: number
  paddingBottom: number
  viewportRef: RefObject<HTMLDivElement | null>
  onView?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
}) {
  return (
    <div className={styles.tableScroll} ref={viewportRef}>
      <Table
        aria-label='Authored content table'
        className={styles.table}
        verticalSpacing={0}
        horizontalSpacing={0}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th className={styles.dotCell} aria-label='Provenance' />
            <Table.Th>Name</Table.Th>
            <Table.Th>Lvl</Table.Th>
            <Table.Th>School</Table.Th>
            <Table.Th>Casting Time</Table.Th>
            <Table.Th>Classes</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th className={styles.actionCell}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paddingTop > 0 ? <SpacerRow height={paddingTop} /> : null}
          {renderedRows.map((itemIndex) => (
            <AuthoredListRow
              item={filteredItems[itemIndex]}
              key={filteredItems[itemIndex].id}
              onView={onView}
              actionHandlers={actionHandlers}
            />
          ))}
          {paddingBottom > 0 ? <SpacerRow height={paddingBottom} /> : null}
        </Table.Tbody>
      </Table>
    </div>
  )
}

function CardList({
  cardColumnCount,
  filteredItems,
  renderedRows,
  paddingTop,
  paddingBottom,
  viewportRef,
  onView,
  actionHandlers,
  useMenuActions
}: {
  cardColumnCount: number
  filteredItems: AuthoredListItem[]
  renderedRows: number[]
  paddingTop: number
  paddingBottom: number
  viewportRef: RefObject<HTMLDivElement | null>
  onView?: (item: AuthoredListItem) => void
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
                  key={item.id}
                  onView={onView}
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

function SpacerRow({ height }: { height: number }) {
  return (
    <Table.Tr aria-hidden='true'>
      <Table.Td colSpan={8} style={{ height, padding: 0, border: 0 }} />
    </Table.Tr>
  )
}

function AuthoredListRow({
  item,
  onView,
  actionHandlers
}: {
  item: AuthoredListItem
  onView?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
}) {
  const sourceLabel = item.sourceKind === 'master' ? 'SRD' : item.sourceLabel
  const handleView = () => {
    if (item.permissions.canView) {
      onView?.(item)
    }
  }
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleView()
    }
  }

  return (
    <Table.Tr
      className={styles.listRow}
      tabIndex={item.permissions.canView ? 0 : -1}
      aria-label={`View ${item.name}`}
      onClick={handleView}
      onKeyDown={handleRowKeyDown}
    >
      <Table.Td className={styles.dotCell}>
        <span className={`${styles.sourceDot} ${item.sourceKind === 'master' ? styles.masterDot : ''}`} />
      </Table.Td>
      <Table.Td className={styles.nameCell}>{item.name}</Table.Td>
      <Table.Td className={styles.monoCell}>{item.level ?? '-'}</Table.Td>
      <Table.Td>{item.school ?? '-'}</Table.Td>
      <Table.Td>{item.castingTime ?? '-'}</Table.Td>
      <Table.Td>
        <span className={styles.chipGroup}>
          {item.classes?.slice(0, 3).map((className) => (
            <span key={className} className={styles.classChip}>{className}</span>
          ))}
        </span>
      </Table.Td>
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
  onView,
  actionHandlers,
  useMenuActions
}: {
  item: AuthoredListItem
  onView?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
  useMenuActions: boolean
}) {
  const sourceLabel = item.sourceKind === 'master' ? 'SRD' : item.sourceLabel
  const levelLabel = item.level === '0' ? 'Cantrip' : `Level ${item.level ?? '-'}`
  const handleView = () => {
    if (item.permissions.canView) {
      onView?.(item)
    }
  }
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleView()
    }
  }

  return (
    <article
      aria-label={`View ${item.name}`}
      className={styles.card}
      onClick={handleView}
      onKeyDown={handleCardKeyDown}
      tabIndex={item.permissions.canView ? 0 : -1}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <span className={`${styles.sourceDot} ${item.sourceKind === 'master' ? styles.masterDot : ''}`} />
          <div className={styles.cardTitleStack}>
            <h2 className={styles.cardTitle}>{item.name}</h2>
            <span className={styles.cardSubline}>{item.school ?? 'Unassigned school'}</span>
          </div>
        </div>
        <span className={item.sourceKind === 'master' ? styles.masterSourceChip : styles.sourceChip}>
          {sourceLabel}
        </span>
      </div>
      <div className={styles.cardFeatureRow}>
        <span className={styles.levelBadge}>{levelLabel}</span>
        <span className={styles.cardFeatureText}>{item.castingTime ?? 'Casting time not set'}</span>
      </div>
      <div className={styles.cardFooter} onClick={(event) => event.stopPropagation()}>
        <span className={styles.chipGroup}>
          {item.classes?.slice(0, 3).map((className) => (
            <span key={className} className={styles.classChip}>{className}</span>
          ))}
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
    <Group gap='xs' justify='flex-end'>
      {actions.map((action) => (
        <Tooltip key={action.label} label={`${action.label} ${itemName}`} withArrow>
          <ActionIcon
            aria-label={action.label}
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
