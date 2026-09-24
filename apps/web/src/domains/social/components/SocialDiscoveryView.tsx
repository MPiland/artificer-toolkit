import { Alert, Button, Drawer, Group, Loader, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { usePaginatedQuery } from 'convex/react'
import { CatchBoundary } from '@tanstack/react-router'
import * as inputStyles from '#ui/primitives/Select/Select.css'
import type { SocialHubSearch } from '../socialSearch'
import { toSocialDiscoveryInput } from '../socialDiscovery'
import { SocialDiscoveryFilters } from './SocialDiscoveryFilters'
import { SocialEmptyState } from './SocialEmptyState'
import { SocialListingRow } from './SocialListingRow'
import * as styles from './SocialDiscoveryView.css'
import * as listStyles from './SocialHubViews.css'

export function SocialDiscoveryView({
  search,
  onSearchChange
}: {
  search: SocialHubSearch
  onSearchChange: (next: SocialHubSearch) => void
}) {
  const [drawerOpened, { close: closeDrawer, open: openDrawer }] = useDisclosure(false)
  const filters = toSocialDiscoveryInput(search)
  const activeFilterCount = [
    search.systemId,
    search.format,
    search.contentMaturity,
    search.toneTags?.length ? search.toneTags : undefined,
    search.playMode,
    search.timeZone,
    search.scheduleKind,
    search.weekday === undefined ? undefined : search.weekday,
    search.stateCode,
    search.city,
    search.minimumAvailableSeats,
    search.safetyPractice
  ].filter((value) => value !== undefined).length
  const clearFilters = () => onSearchChange({ query: search.query, view: 'discover' })
  const normalizedQuery = search.query?.trim()

  return (
    <>
      <div className={styles.discoveryTools} aria-label='Discovery search and filters'>
        <TextInput
          aria-label='Search table titles and summaries'
          classNames={{
            input: inputStyles.input,
            label: inputStyles.label,
            root: styles.searchField
          }}
          label='Search tables'
          placeholder='Title or summary'
          value={search.query ?? ''}
          onChange={(event) =>
            onSearchChange({
              ...search,
              query: event.currentTarget.value || undefined
            })
          }
        />
        <Button
          aria-haspopup='dialog'
          className={styles.filterButton}
          variant='default'
          onClick={openDrawer}
        >
          {activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}
        </Button>
        {activeFilterCount ? (
          <Button className={styles.clearFilters} variant='subtle' onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
      <Drawer
        classNames={{
          body: styles.drawerBody,
          content: styles.drawerContent,
          header: styles.drawerHeader,
          title: styles.drawerTitle
        }}
        opened={drawerOpened}
        position='right'
        size='min(24rem, 92vw)'
        title='Discovery filters'
        closeButtonProps={{ 'aria-label': 'Close discovery filters' }}
        onClose={closeDrawer}
      >
        <div className={styles.drawerFields}>
          <SocialDiscoveryFilters search={search} onSearchChange={onSearchChange} />
          <Group justify='space-between'>
            <Button disabled={!activeFilterCount} variant='subtle' onClick={clearFilters}>
              Clear filters
            </Button>
            <Button onClick={closeDrawer}>Show results</Button>
          </Group>
        </div>
      </Drawer>
      <CatchBoundary
        getResetKey={() => JSON.stringify(search)}
        errorComponent={SocialDiscoveryError}
      >
        <SocialDiscoveryResults filters={filters} query={normalizedQuery} />
      </CatchBoundary>
    </>
  )
}

function SocialDiscoveryError({ reset }: { reset: () => void }) {
  return (
    <Alert color='red'>
      Could not load listings. Try again.
      <Button mt='sm' size='xs' variant='default' onClick={reset}>
        Retry search
      </Button>
    </Alert>
  )
}

function SocialDiscoveryResults({
  filters,
  query
}: {
  filters: ReturnType<typeof toSocialDiscoveryInput>
  query?: string
}) {
  const browse = usePaginatedQuery(
    convexApi.social.discoveryLists.browse,
    query ? 'skip' : filters,
    {
      initialNumItems: 8
    }
  )
  const search = usePaginatedQuery(
    convexApi.social.discoveryLists.search,
    query ? { ...filters, query } : 'skip',
    { initialNumItems: 8 }
  )
  const listings = query ? search : browse
  const exhaustedEmpty = listings.status === 'Exhausted' && listings.results.length === 0

  return (
    <>
      {listings.status === 'LoadingFirstPage' ? (
        <Loader aria-label='Loading listings' size='sm' />
      ) : null}
      {exhaustedEmpty ? (
        <SocialEmptyState
          title='No tables match'
          body='Try clearing a filter or checking again later.'
        />
      ) : null}
      {listings.results.length ? (
        <div className={listStyles.rows} aria-label='Open public tables'>
          {listings.results.map((listing) => (
            <SocialListingRow listing={listing} key={listing.listingPublicId} />
          ))}
        </div>
      ) : null}
      {listings.status === 'CanLoadMore' ? (
        <Button variant='default' onClick={() => listings.loadMore(8)}>
          Load more tables
        </Button>
      ) : null}
      {listings.status === 'LoadingMore' ? (
        <Loader aria-label='Loading more listings' size='sm' />
      ) : null}
      <span className={styles.srStatus} aria-live='polite'>
        {listings.status === 'LoadingFirstPage' || listings.status === 'LoadingMore'
          ? 'Updating table results.'
          : 'Table results updated.'}
      </span>
    </>
  )
}
