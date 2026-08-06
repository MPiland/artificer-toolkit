import { Button, Drawer, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { SlidersHorizontal } from 'lucide-react'
import { AppSelect } from '#ui/primitives/Select'
import * as inputStyles from '#ui/primitives/Select/Select.css'
import type { AuthoredListFilter, AuthoredListSortOption } from './AuthoredList.types'
import type { AuthoredListFilterValues } from './AuthoredList.filters'
import * as styles from './AuthoredList.css'

interface MobileAuthoredListToolsProps {
  title: string
  query: string
  filters: AuthoredListFilter[]
  filterOptions: Record<string, AuthoredListFilter['options']>
  filterValues: AuthoredListFilterValues
  sortOptions: AuthoredListSortOption[]
  sort: string
  defaultSort: string
  defaultSortLabel: string
  resultCount: number
  onQueryChange: (query: string) => void
  onFilterChange: (key: string, value: string | null) => void
  onClearFilters: () => void
  onSortChange: (sort: string) => void
}

export function MobileAuthoredListTools({
  title,
  query,
  filters,
  filterOptions,
  filterValues,
  sortOptions,
  sort,
  defaultSort,
  defaultSortLabel,
  resultCount,
  onQueryChange,
  onFilterChange,
  onClearFilters,
  onSortChange
}: MobileAuthoredListToolsProps) {
  const [opened, { close, open }] = useDisclosure(false)
  const activeFilterCount = Object.values(filterValues).filter(Boolean).length
  const filterButtonLabel = activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'
  const resultLabel = `${resultCount} ${resultCount === 1 ? 'result' : 'results'}`

  return (
    <>
      <div className={styles.mobileToolbar} aria-label={`${title} list tools`}>
        <TextInput
          aria-label={`Search ${title.toLowerCase()}`}
          classNames={{ input: inputStyles.input }}
          placeholder='Search...'
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
        />
        <Button
          className={styles.mobileFiltersButton}
          leftSection={<SlidersHorizontal size={16} aria-hidden='true' />}
          variant='default'
          onClick={open}
        >
          {filterButtonLabel}
        </Button>
      </div>

      <Drawer
        aria-label={`${title} filters and sort`}
        classNames={{
          body: styles.mobileDrawerBody,
          content: styles.mobileDrawerContent,
          header: styles.mobileDrawerHeader
        }}
        closeButtonProps={{ 'aria-label': 'Close filters' }}
        opened={opened}
        onClose={close}
        position='bottom'
        size='auto'
        title={`${title} filters and sort`}
        withinPortal
      >
        <div className={styles.mobileDrawerStack}>
          <div className={styles.mobileDrawerFields}>
            {filters.map((filter) => (
              <AppSelect
                key={filter.key}
                label={filter.label}
                placeholder={filter.placeholder}
                data={filterOptions[filter.key] ?? filter.options}
                value={filterValues[filter.key]}
                clearable
                onChange={(value) => onFilterChange(filter.key, value)}
              />
            ))}
            <AppSelect
              label='Sort'
              data={sortOptions}
              placeholder={defaultSortLabel}
              value={sort === defaultSort ? null : sort}
              allowDeselect={false}
              onChange={(value) => onSortChange(value ?? defaultSort)}
            />
          </div>
          <div className={styles.mobileDrawerActions}>
            <Button
              type='button'
              variant='default'
              disabled={activeFilterCount === 0}
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
            <Button type='button' onClick={close}>
              Show {resultLabel}
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  )
}
