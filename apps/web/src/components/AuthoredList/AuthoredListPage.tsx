import {
  ActionIcon,
  Button,
  Group,
  SegmentedControl,
  Skeleton,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import ICreate from '#assets/icons/ICreate'
import IGrid from '#assets/icons/IGrid'
import IList from '#assets/icons/IList'
import IMore from '#assets/icons/IMore'
import { PageHeader } from '#app/shell'
import { AppSelect } from '#ui/primitives/Select'
import * as inputStyles from '#ui/primitives/Select/Select.css'
import { AuthoredListCards } from './AuthoredListCards'
import { AuthoredListTable } from './AuthoredListTable'
import type {
  AuthoredListActionHandlers,
  AuthoredListFilter,
  AuthoredListPageProps,
  AuthoredListViewMode
} from './AuthoredList.types'
import {
  getFacetedFilterOptionsByKey,
  itemMatchesQuery,
  itemMatchesSelectedFilters,
  type AuthoredListFilterValues
} from './AuthoredList.filters'
import { MobileAuthoredListTools } from './MobileAuthoredListTools'
import {
  hasAuthoredListAccent,
  hasAuthoredListBadges,
  hasAuthoredListStatus,
  sortAuthoredListItems
} from './authoredList.utils'
import * as styles from './AuthoredListPage.css'

const mobileQuery = '(max-width: 760px)'
const tabletQuery = '(max-width: 1120px)'

export function AuthoredListPage({
  title,
  summary,
  createLabel,
  items,
  draftItems = [],
  draftLoading = false,
  filters,
  attributeColumns = [],
  sortOptions = [{ value: 'name', label: 'Name A-Z' }],
  defaultSort = 'name',
  emptyState,
  error,
  loading: activeLoading = false,
  initialViewMode,
  cardOnly = false,
  updating = false,
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
  const [filterValues, setFilterValues] = useState<AuthoredListFilterValues>(() =>
    buildInitialFilters(filters)
  )
  const [sort, setSort] = useState(defaultSort)
  const [contentPanel, setContentPanel] = useState<'active' | 'draft'>('active')
  const loading = contentPanel === 'draft' ? draftLoading : activeLoading
  const [viewMode, setViewMode] = useState<AuthoredListViewMode>(() => {
    if (cardOnly) return 'cards'
    if (initialViewMode) return initialViewMode
    if (typeof window === 'undefined') return 'table'

    return window.matchMedia(mobileQuery).matches ? 'cards' : 'table'
  })
  const viewportRef = useRef<HTMLDivElement>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const hasActiveFilters =
    normalizedQuery.length > 0 || Object.values(filterValues).some((value) => Boolean(value))
  const visibleItems = contentPanel === 'draft' ? draftItems : items
  const draftEmptyState =
    contentPanel === 'draft' && draftItems.length === 0 ? (
      <StatePanel
        title={`No draft ${title.toLowerCase()}.`}
        copy={`There are currently no draft ${title.toLowerCase()}.`}
      />
    ) : null

  const filteredItems = useMemo(() => {
    const matchingItems = visibleItems.filter((item) => {
      return (
        itemMatchesQuery(item, normalizedQuery) &&
        itemMatchesSelectedFilters(item, filters, filterValues)
      )
    })

    return sortAuthoredListItems(matchingItems, sort)
  }, [filterValues, filters, normalizedQuery, sort, visibleItems])
  const facetedFilterOptions = useMemo(
    () =>
      getFacetedFilterOptionsByKey({
        filters,
        filterValues,
        items: visibleItems,
        normalizedQuery
      }),
    [filterValues, filters, normalizedQuery, visibleItems]
  )
  const hasAccentColumn = visibleItems.some(hasAuthoredListAccent)
  const hasStatusColumn = visibleItems.some(hasAuthoredListStatus)
  const hasBadgeColumn = visibleItems.some(hasAuthoredListBadges)
  const defaultSortLabel =
    sortOptions.find((option) => option.value === defaultSort)?.label ??
    sortOptions[0]?.label ??
    'Default'
  const cardColumnCount = viewMode === 'cards' ? (isMobile ? 1 : isTablet ? 2 : 3) : 1
  const virtualRowCount =
    viewMode === 'cards' ? Math.ceil(filteredItems.length / cardColumnCount) : filteredItems.length
  const rowVirtualizer = useVirtualizer({
    count: virtualRowCount,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => (viewMode === 'cards' ? 220 : 64),
    overscan: 8,
    initialRect: { width: 1188, height: 640 }
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const renderedRows =
    virtualRows.length > 0
      ? virtualRows.map((virtualRow) => virtualRow.index)
      : Array.from({ length: virtualRowCount }, (_, index) => index)
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0

  useEffect(() => {
    rowVirtualizer.measure()
    rowVirtualizer.scrollToOffset(0)
  }, [cardColumnCount, contentPanel, filterValues, query, rowVirtualizer, sort, viewMode])

  useEffect(() => {
    if ((cardOnly || isMobile) && viewMode !== 'cards') {
      setViewMode('cards')
    }
  }, [cardOnly, isMobile, viewMode])

  const actionHandlers: AuthoredListActionHandlers = { onEdit, onCopy, onDelete }

  return (
    <div className={styles.listStack}>
      <PageHeader
        title={title}
        description={summary}
        actions={
          <Button aria-label={createLabel} leftSection={<ICreate />} onClick={onCreate}>
            Create
          </Button>
        }
      />

      <div className={styles.contentTabs}>
        <SegmentedControl
          aria-label='Choose content state'
          data={[
            { label: `Active (${items.length})`, value: 'active' },
            { label: `Drafts (${draftLoading ? '…' : draftItems.length})`, value: 'draft' }
          ]}
          value={contentPanel}
          onChange={(value) => setContentPanel(value === 'draft' ? 'draft' : 'active')}
        />
      </div>

      <div aria-live='polite'>
        {updating ? (
          <Text size='sm' c='dimmed'>
            Content was just published and is still updating. This list refreshes on its own.
          </Text>
        ) : null}
      </div>

      {isMobile ? (
        <MobileAuthoredListTools
          title={title}
          query={query}
          filters={filters}
          filterOptions={facetedFilterOptions}
          filterValues={filterValues}
          sortOptions={sortOptions}
          sort={sort}
          defaultSort={defaultSort}
          defaultSortLabel={defaultSortLabel}
          resultCount={filteredItems.length}
          onQueryChange={setQuery}
          onFilterChange={(key, value) =>
            setFilterValues((current) => ({ ...current, [key]: value }))
          }
          onClearFilters={() => setFilterValues(buildInitialFilters(filters))}
          onSortChange={setSort}
        />
      ) : (
        <div className={styles.toolbar} aria-label={`${title} list tools`}>
          <div className={styles.filterControls}>
            <TextInput
              aria-label={`Search ${title.toLowerCase()}`}
              classNames={{ input: inputStyles.input }}
              placeholder='Search...'
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            {filters.map((filter) => (
              <AppSelect
                key={filter.key}
                label={filter.label}
                placeholder={filter.placeholder}
                data={facetedFilterOptions[filter.key] ?? filter.options}
                value={filterValues[filter.key]}
                clearable
                onChange={(value) =>
                  setFilterValues((current) => ({ ...current, [filter.key]: value }))
                }
              />
            ))}
            <AppSelect
              label='Sort'
              data={sortOptions}
              placeholder={defaultSortLabel}
              value={sort === defaultSort ? null : sort}
              allowDeselect={false}
              onChange={(value) => setSort(value ?? defaultSort)}
            />
          </div>
          {!cardOnly ? (
            <Group
              className={styles.viewToggleGroup}
              gap={4}
              role='group'
              aria-label='Choose list layout'
            >
              <Tooltip label='Table view' withArrow>
                <ActionIcon
                  aria-label='Table view'
                  aria-pressed={viewMode === 'table'}
                  className={clsx(
                    styles.viewToggleButton,
                    viewMode === 'table' && styles.viewToggleButtonActive
                  )}
                  variant='subtle'
                  onClick={() => setViewMode('table')}
                >
                  <IList size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label='Card view' withArrow>
                <ActionIcon
                  aria-label='Card view'
                  aria-pressed={viewMode === 'cards'}
                  className={clsx(
                    styles.viewToggleButton,
                    viewMode === 'cards' && styles.viewToggleButtonActive
                  )}
                  variant='subtle'
                  onClick={() => setViewMode('cards')}
                >
                  <IGrid size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : null}
        </div>
      )}

      <section
        className={clsx(
          styles.tableShell,
          viewMode === 'cards' &&
            !loading &&
            !error &&
            filteredItems.length > 0 &&
            styles.cardResultsShell
        )}
        aria-label={`${title} results`}
      >
        {loading ? <LoadingRows title={title} /> : null}
        {!loading && error ? (
          <StatePanel
            title={`Couldn't load ${title.toLowerCase()}.`}
            copy='Refresh the page to try again.'
          />
        ) : null}
        {!loading && !error && filteredItems.length === 0
          ? (draftEmptyState ??
            emptyState ?? (
              <StatePanel
                title={
                  hasActiveFilters
                    ? `No ${title.toLowerCase()} match these filters.`
                    : `No ${title.toLowerCase()} yet.`
                }
                copy={
                  hasActiveFilters
                    ? 'Try a different search or clear a filter.'
                    : `Use ${createLabel} to get started.`
                }
              />
            ))
          : null}
        {!loading && !error && filteredItems.length > 0 ? (
          viewMode === 'cards' ? (
            <AuthoredListCards
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
          ) : (
            <AuthoredListTable
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
        ) : null}
      </section>
    </div>
  )
}

function LoadingRows({ title }: { title: string }) {
  return (
    <div className={styles.statePanel} aria-label='Loading list'>
      <IMore />
      <Text fw={600}>Loading {title.toLowerCase()}...</Text>
      <Skeleton height={16} width='70%' />
      <Skeleton height={16} width='52%' />
    </div>
  )
}

function StatePanel({ title, copy }: { title: string; copy: string }) {
  return (
    <div className={styles.statePanel}>
      <Text fw={700}>{title}</Text>
      <Text size='sm' c='dimmed'>
        {copy}
      </Text>
    </div>
  )
}

function buildInitialFilters(filters: AuthoredListFilter[]): AuthoredListFilterValues {
  return filters.reduce<AuthoredListFilterValues>((values, filter) => {
    values[filter.key] = null
    return values
  }, {})
}
